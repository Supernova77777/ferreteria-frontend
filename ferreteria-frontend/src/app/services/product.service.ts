import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export interface Product {
    id: string; // Puede ser devuelto como número desde backend pero lo mantendremos as string para interface
    codigo: string;
    name: string;
    marca: string;
    stock: number;
    price: number;
    fechaCompra: string;
}

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    products = signal<Product[]>([]);
    private apiUrl = 'http://localhost:8080/api/productos';

    constructor(private http: HttpClient) {
        this.loadProducts();
    }

    async loadProducts() {
        try {
            const data = await firstValueFrom(this.http.get<Product[]>(this.apiUrl));
            // Asegurar que el id es string para la UI si el backend devuelve un Long
            const formatted = data.map(p => ({ ...p, id: String(p.id) }));
            this.products.set(formatted);
        } catch (error) {
            console.error('Error cargando productos', error);
        }
    }

    async searchProducts(termino: string) {
        if (!termino || termino.trim() === '') {
            await this.loadProducts();
            return;
        }
        try {
            const data = await firstValueFrom(this.http.get<Product[]>(`${this.apiUrl}/buscar?termino=${termino}`));
            const formatted = data.map(p => ({ ...p, id: String(p.id) }));
            this.products.set(formatted);
        } catch (error) {
            console.error('Error buscando productos', error);
        }
    }

    async addProduct(product: Omit<Product, 'id'>) {
        try {
            const newProduct = await firstValueFrom(this.http.post<Product>(this.apiUrl, product));
            const formatted = { ...newProduct, id: String(newProduct.id) };
            this.products.update(products => [...products, formatted]);
        } catch (error: any) {
            console.error('Error agregando producto', error);
            if (error.error && error.error.message) {
                alert('Error: ' + error.error.message);
            }
        }
    }

    async updateProduct(updatedProduct: Product, originalId?: string) {
        const targetId = originalId || updatedProduct.id;
        try {
            const result = await firstValueFrom(this.http.put<Product>(`${this.apiUrl}/${targetId}`, updatedProduct));
            const formatted = { ...result, id: String(result.id) };
            
            this.products.update(products =>
                products.map(p => p.id === targetId ? formatted : p)
            );
            return true;
        } catch (error: any) {
            console.error('Error actualizando producto', error);
            if (error.error && error.error.message) {
                alert('Error: ' + error.error.message);
            }
            return false;
        }
    }

    async deleteProduct(id: string) {
        try {
            await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
            this.products.update(products => products.filter(p => p.id !== id));
        } catch (error) {
            console.error('Error eliminando producto', error);
            alert('Error al eliminar el producto.');
        }
    }

    async generarReporteInventario(marcaFiltrada?: string) {
        try {
            let inventarioActual = this.products();

            if (marcaFiltrada) {
                inventarioActual = inventarioActual.filter(p => p.marca === marcaFiltrada);
            }

            if (inventarioActual.length === 0) {
                alert(`El inventario ${marcaFiltrada ? 'de la marca ' + marcaFiltrada : ''} está vacío. No hay nada que exportar.`);
                return;
            }

            // Fetch template
            const url = '/reportes/' + encodeURIComponent('inventario.docx');
            console.log(`Fetching inventory template from:`, url);

            const templateBuffer = await firstValueFrom(
                this.http.get(url, { responseType: 'arraybuffer' })
            );

            if (!templateBuffer) throw new Error('El archivo de la plantilla está vacío o no se encontró.');

            const zip = new PizZip(templateBuffer);
            // Notice: We don't override delimiters here because the user specifically requested single braces: {#productos}
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true
            });

            // Re-map format if necessary (e.g. price)
            const productosParaReporte = inventarioActual.map(p => ({
                id: p.id,
                codigo: p.codigo || '',
                nombre: p.name,
                marca: p.marca,
                categoria: p.marca, // Fallback for the old DOCX template
                stock: p.stock,
                precio: p.price.toFixed(2),
                fechaCompra: p.fechaCompra || ''
            }));

            // Set data
            doc.render({
                productos: productosParaReporte,
                fecha_exportacion: new Date().toLocaleDateString()
            });

            const out = doc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = marcaFiltrada
                ? `Reporte_Inventario_${marcaFiltrada}_${dateStr}.docx`
                : `Reporte_Inventario_Global_${dateStr}.docx`;

            saveAs(out, fileName);
        } catch (error: any) {
            console.error('Error al generar el reporte de inventario:', error);

            let errorMessage = 'Hubo un error al generar el reporte de inventario.';

            if (error.properties && error.properties.errors instanceof Array) {
                const errorDetails = error.properties.errors.map((e: any) => {
                    return e.properties?.explanation || e.message || 'Error desconocido';
                }).join('\n');
                errorMessage += '\n\nErrores de formato en la plantilla Word:\n' + errorDetails;
            } else if (error.status === 404) {
                errorMessage = 'No se encontró la plantilla en /reportes/inventario.docx. Asegúrate de que existe este archivo.';
            } else if (error.message) {
                errorMessage += '\nDetalle: ' + error.message;
            }

            alert(errorMessage);
        }
    }

    async generarReporteExcel(marcaFiltrada?: string) {
        let inventarioActual = this.products();

        if (marcaFiltrada) {
            inventarioActual = inventarioActual.filter(p => p.marca === marcaFiltrada);
        }

        if (inventarioActual.length === 0) {
            alert(`El inventario ${marcaFiltrada ? 'de la marca ' + marcaFiltrada : ''} está vacío. No hay nada que exportar.`);
            return;
        }

        try {
            // Import exceljs dynamically to avoid issues with SSR or bundle size when not used
            const ExcelJS = await import('exceljs');

            const url = '/reportes/' + encodeURIComponent('inventario EXCEL.xlsx');
            console.log(`Fetching Excel template from:`, url);

            const templateBuffer = await firstValueFrom(
                this.http.get(url, { responseType: 'arraybuffer' })
            );

            if (!templateBuffer) throw new Error('El archivo de la plantilla Excel está vacío o no se encontró.');

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(templateBuffer);

            // Assuming the first sheet is the one we want to write to
            const worksheet = workbook.worksheets[0];

            if (!worksheet) throw new Error('No se encontró ninguna hoja en el archivo Excel.');

            // Start inserting AT row 12
            let currentRow = 12;

            // Explicitly set column widths so text doesn't forcefully wrap in narrow columns
            worksheet.getColumn(2).width = 30; // Producto
            worksheet.getColumn(3).width = 15; // Marca
            worksheet.getColumn(4).width = 15; // Precio
            worksheet.getColumn(5).width = 15; // Stock
            worksheet.getColumn(6).width = 20; // Código
            worksheet.getColumn(7).width = 20; // Fecha Compra

            // Capture the style of the template row to duplicate it (B, D, E, F as they correspond to the visible columns in the template)
            const templateRowStyle = worksheet.getRow(12);
            const styles = {
                B: Object.assign({}, templateRowStyle.getCell(2).style, { alignment: { vertical: 'middle', horizontal: 'center', wrapText: false } }),
                D: Object.assign({}, templateRowStyle.getCell(4).style, { alignment: { vertical: 'middle', horizontal: 'center', wrapText: false } }),
                E: Object.assign({}, templateRowStyle.getCell(5).style, { alignment: { vertical: 'middle', horizontal: 'center', wrapText: false } }),
                F: Object.assign({}, templateRowStyle.getCell(6).style, { alignment: { vertical: 'middle', horizontal: 'center', wrapText: false } })
            };

            // Add headers for the new columns at row 11 (template header row)
            const headerRow = worksheet.getRow(11);
            if (!headerRow.getCell(8).value) headerRow.getCell(8).value = 'Código';
            if (!headerRow.getCell(9).value) headerRow.getCell(9).value = 'Fecha Compra';
            headerRow.getCell(8).style = headerRow.getCell(6).style; // Copy stock header style
            headerRow.getCell(9).style = headerRow.getCell(6).style;

            for (const p of inventarioActual) {
                // Insert a new row, shifting others down
                // This prevents overwriting other parts of the template below
                const rowValues: any = [];
                rowValues[2] = p.name;               // B: Producto (merged with C)
                rowValues[4] = p.marca;              // D: Marca
                rowValues[5] = Number(p.price.toFixed(2)); // E: Precio
                rowValues[6] = p.stock;              // F: Stock (merged with G)
                rowValues[8] = p.codigo || '';       // H: Código
                rowValues[9] = p.fechaCompra || '';  // I: Fecha Compra

                const row = worksheet.insertRow(currentRow, rowValues);

                // Merges for the template structure. Wrap in try-catch because `insertRow` might inherit merges automatically from the template row.
                try {
                    // Check if already merged to avoid error
                    const cellB = worksheet.getCell(`B${currentRow}`);
                    if (!cellB.isMerged) {
                        worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
                    }
                } catch (e) { console.warn('B-C Merge skipped:', e); }

                try {
                    const cellF = worksheet.getCell(`F${currentRow}`);
                    if (!cellF.isMerged) {
                        worksheet.mergeCells(`F${currentRow}:G${currentRow}`);
                    }
                } catch (e) { console.warn('F-G Merge skipped:', e); }

                // Apply the extracted styles to ALL cells involved in the merge
                // B is merged with C, F is merged with G. Both need styles (borders specifically) 
                // to render the full box.
                row.getCell(2).style = styles.B; // B
                row.getCell(3).style = styles.B; // C (copy B's style for the right border of the merge)

                row.getCell(4).style = styles.D; // D
                row.getCell(5).style = styles.E; // E

                row.getCell(6).style = styles.F; // F
                row.getCell(7).style = styles.F; // G (copy F's style for the right border of the merge)

                // Style new columns
                row.getCell(8).style = styles.F; // H
                row.getCell(9).style = styles.F; // I

                row.commit();
                currentRow++;
            }

            // Since we inserted rows, the original template row (with the {#productos} tags)
            // got pushed down to `currentRow`. We should delete it.
            worksheet.spliceRows(currentRow, 1);

            const excelBuffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = marcaFiltrada
                ? `Reporte_Inventario_${marcaFiltrada}_${dateStr}.xlsx`
                : `Reporte_Inventario_Global_${dateStr}.xlsx`;

            saveAs(blob, fileName);

        } catch (error: any) {
            console.error('Error al generar el reporte Excel con plantilla:', error);

            let errorMessage = 'Hubo un error al generar el reporte de Excel.';

            if (error.status === 404) {
                errorMessage = 'No se encontró la plantilla en /reportes/inventario EXCEL.xlsx. Asegúrate de que existe este archivo.';
            } else if (error.message) {
                errorMessage += '\nDetalle: ' + error.message;
            }

            alert(errorMessage);
        }
    }
}
