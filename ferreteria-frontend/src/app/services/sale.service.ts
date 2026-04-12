import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from './product.service';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../../config/api.base';
import { saveAs } from 'file-saver';
import * as ExcelJS from 'exceljs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export interface SaleItem {
    product: Product;
    quantity: number;
}

export interface Sale {
    id: string;
    date: Date;
    items: SaleItem[];
    subtotal: number;
    tax: number;
    total: number;
    sellerName: string;
    sellerRole: string;
}

@Injectable({
    providedIn: 'root'
})
export class SaleService {
    private apiUrl = `${API_BASE}/ventas`;
    sales = signal<Sale[]>([]);

    constructor(private http: HttpClient) {
        this.loadSales();
    }

    async loadSales() {
        try {
            const data = await firstValueFrom(this.http.get<Sale[]>(this.apiUrl));
            // Asegurarse de convertir string a Date
            const formatted = data.map(s => ({
                ...s,
                date: new Date(s.date)
            }));
            this.sales.set(formatted);
        } catch (error) {
            console.error('Error cargando ventas', error);
        }
    }

    async addSale(saleData: Omit<Sale, 'id' | 'date'>) {
        try {
            const newSale = await firstValueFrom(this.http.post<Sale>(this.apiUrl, saleData));
            const formatted = { ...newSale, date: new Date(newSale.date) };

            const currentSales = this.sales();
            this.sales.set([formatted, ...currentSales]);
            return formatted;
        } catch (error: any) {
            console.error('Error agregando venta', error);
            if (error.error && error.error.message) {
                alert('Error al registrar venta: ' + error.error.message);
            }
            throw error;
        }
    }

    getSales(): Sale[] {
        return this.sales();
    }

    async clearSales() {
        try {
            await firstValueFrom(this.http.delete(`${this.apiUrl}/clear`));
            this.sales.set([]);
        } catch (error: any) {
            console.error('Error al borrar el historial de ventas', error);
            alert('No se pudo vaciar el historial.');
        }
    }

    private numeroALetras(num: number): string {
        const intPart = Math.floor(num);
        const decPart = Math.round((num - intPart) * 100);
        return `${intPart} PESOS ${decPart.toString().padStart(2, '0')}/100`;
    }

    async generarReporteVenta(sale: Sale) {
        try {
            const url = '/reportes/' + encodeURIComponent('HOJA MEMBRETADA 1.docx');
            const templateBuffer = await firstValueFrom(this.http.get(url, { responseType: 'arraybuffer' }));
            if (!templateBuffer) throw new Error('Plantilla vacía');

            const zip = new PizZip(templateBuffer);
            const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: '{{', end: '}}' } });

            const productosVendidos = sale.items.map(item => ({
                cantidad: item.quantity,
                nombre: item.product.name,
                precio: item.product.price.toFixed(2),
                importe: (item.quantity * item.product.price).toFixed(2),
                vendedor: sale.sellerName,
                fechaCompra: item.product.fechaCompra || ''
            }));

            doc.render({
                id_venta: sale.id,
                fecha: new Date(sale.date).toLocaleDateString(),
                vendedor: sale.sellerName,
                subtotal: sale.subtotal.toFixed(2),
                subtota: sale.subtotal.toFixed(2),
                iva: sale.tax.toFixed(2),
                total: sale.total.toFixed(2),
                total_letras: this.numeroALetras(sale.total),
                productos: productosVendidos
            });

            const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            saveAs(out, `Reporte_Venta_${sale.id}.docx`);
        } catch (error: any) {
            console.error('Error al generar el reporte Word de venta:', error);
            alert('Hubo un error al generar la factura Word localmente.');
        }
    }

    async generarReporteGlobal(tipo: 'global' | 'dia' | 'semana' | 'mes' = 'global', param?: string) {
        try {
            let sales = this.getSales();

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (tipo === 'dia' && param) {
                // param format: YYYY-MM-DD
                sales = sales.filter(s => {
                    const d = new Date(s.date);
                    const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                    return dStr === param;
                });
            } else if (tipo === 'semana' && param) {
                // param format: YYYY-MM-DD (Monday of the week)
                sales = sales.filter(s => {
                    const d = new Date(s.date);
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
                    const mondayStr = monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
                    return mondayStr === param;
                });
            } else if (tipo === 'mes' && param) {
                // param format: YYYY-MM
                sales = sales.filter(s => {
                    const d = new Date(s.date);
                    const mStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                    return mStr === param;
                });
            } else if (tipo !== 'global') {
                // If it's not global and no param was provided, fallback to "current" period
                if (tipo === 'dia') {
                    sales = sales.filter(s => {
                        const d = new Date(s.date);
                        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                    });
                } else if (tipo === 'semana') {
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    sales = sales.filter(s => new Date(s.date) >= weekAgo);
                } else if (tipo === 'mes') {
                    sales = sales.filter(s => {
                        const d = new Date(s.date);
                        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
                    });
                }
            }

            if (sales.length === 0) {
                alert(`No hay ventas registradas para generar un reporte del periodo especificado.`);
                return;
            }

            // Calculate global totals
            let globalSubtotal = 0;
            let globalTax = 0;
            let globalTotal = 0;
            let allProductosVendidos: any[] = [];

            for (const sale of sales) {
                globalSubtotal += sale.subtotal;
                globalTax += sale.tax;
                globalTotal += sale.total;

                // Accumulate items for the table
                for (const item of sale.items) {
                    allProductosVendidos.push({
                        cantidad: item.quantity,
                        nombre: item.product.name,
                        precio: item.product.price.toFixed(2),
                        importe: (item.quantity * item.product.price).toFixed(2),
                        vendedor: sale.sellerName,
                        fechaCompra: item.product.fechaCompra || ''
                    });
                }
            }

            // Fetch template
            const url = '/reportes/' + encodeURIComponent('HOJA MEMBRETADA 1.docx');
            console.log(`Fetching ${tipo} template from:`, url);

            const templateBuffer = await firstValueFrom(
                this.http.get(url, { responseType: 'arraybuffer' })
            );

            if (!templateBuffer) throw new Error('El archivo de la plantilla está vacío o no se encontró.');

            const zip = new PizZip(templateBuffer);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '{{', end: '}}' }
            });

            // Set data (using generic global identifiers)
            const typeLabel = tipo === 'global' ? 'Toda la Tienda' : `Periodo: ${tipo}`;
            doc.render({
                id_venta: `${tipo.toUpperCase()}-` + new Date().getTime().toString().slice(-6),
                fecha: new Date().toLocaleDateString(),
                vendedor: typeLabel,
                subtotal: globalSubtotal.toFixed(2),
                subtota: globalSubtotal.toFixed(2), // Fallback map
                iva: globalTax.toFixed(2),
                total: globalTotal.toFixed(2),
                total_letras: this.numeroALetras(globalTotal),
                productos: allProductosVendidos
            });

            const out = doc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });

            const dateStr = new Date().toISOString().split('T')[0];
            const typeName = tipo.charAt(0).toUpperCase() + tipo.slice(1);
            saveAs(out, `Reporte_${typeName}_Ventas_${dateStr}.docx`);
        } catch (error: any) {
            console.error('Error al generar el reporte global:', error);

            let errorMessage = 'Hubo un error al generar el reporte global de Word.';

            if (error.properties && error.properties.errors instanceof Array) {
                const errorDetails = error.properties.errors.map((e: any) => {
                    return e.properties?.explanation || e.message || 'Error desconocido';
                }).join('\n');
                errorMessage += '\n\nErrores de formato en la plantilla Word:\n' + errorDetails;
            } else if (error.status === 404) {
                errorMessage = 'No se encontró la plantilla en /reportes/HOJA MEMBRETADA 1.docx';
            } else if (error.message) {
                errorMessage += '\nDetalle: ' + error.message;
            }

            alert(errorMessage);
        }
    }

    async generarReporteGlobalExcel(tipo: 'global' | 'dia' | 'semana' | 'mes' = 'global', param?: string) {
        let sales = this.getSales();

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (tipo === 'dia' && param) {
            sales = sales.filter(s => {
                const d = new Date(s.date);
                const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                return dStr === param;
            });
        } else if (tipo === 'semana' && param) {
            sales = sales.filter(s => {
                const d = new Date(s.date);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(d.getFullYear(), d.getMonth(), diff);
                const mondayStr = monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
                return mondayStr === param;
            });
        } else if (tipo === 'mes' && param) {
            sales = sales.filter(s => {
                const d = new Date(s.date);
                const mStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                return mStr === param;
            });
        } else if (tipo !== 'global') {
            if (tipo === 'dia') {
                sales = sales.filter(s => {
                    const d = new Date(s.date);
                    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                });
            } else if (tipo === 'semana') {
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                sales = sales.filter(s => new Date(s.date) >= weekAgo);
            } else if (tipo === 'mes') {
                sales = sales.filter(s => {
                    const d = new Date(s.date);
                    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
                });
            }
        }

        if (sales.length === 0) {
            alert(`No hay ventas registradas para generar un reporte Excel del periodo especificado.`);
            return;
        }

        try {
            const ExcelJS = await import('exceljs');

            const url = '/reportes/' + encodeURIComponent('Hoja Membretada EXcel.xlsx');
            console.log(`Fetching Excel template from:`, url);

            const templateBuffer = await firstValueFrom(
                this.http.get(url, { responseType: 'arraybuffer' })
            );

            if (!templateBuffer) throw new Error('El archivo de la plantilla Excel está vacío o no se encontró.');

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(templateBuffer);

            const worksheet = workbook.worksheets[0];
            if (!worksheet) throw new Error('No se encontró ninguna hoja en el archivo Excel.');

            // The Hoja Membretada template has tags in row 11. 
            // We will start inserting at row 11 and use row 11's style.
            let currentRow = 11;

            // Based on screenshot, row 11 is the template data row.
            // Columns: 
            // Vendedor: B & C (merged)
            // Cantidad: D & E (merged)
            // Nombre: F & G & H (merged)
            // Precio: I
            // Importe: J & K (or just J, template header says J is Importe)

            // Generate headers explicitly in case the template lacks them
            const headerRow = worksheet.getRow(currentRow - 1);
            headerRow.getCell(1).value = 'Fecha y Venta';
            headerRow.getCell(3).value = 'Vendedor';
            headerRow.getCell(5).value = 'Cantidad';
            headerRow.getCell(7).value = 'Producto';
            headerRow.getCell(9).value = 'Precio Unt.';
            headerRow.getCell(11).value = 'Importe';
            headerRow.getCell(13).value = 'Fecha Compra';

            try { worksheet.mergeCells(currentRow - 1, 3, currentRow - 1, 4); } catch (e) { } // C-D
            try { worksheet.mergeCells(currentRow - 1, 5, currentRow - 1, 6); } catch (e) { } // E-F
            try { worksheet.mergeCells(currentRow - 1, 7, currentRow - 1, 8); } catch (e) { } // G-H
            try { worksheet.mergeCells(currentRow - 1, 9, currentRow - 1, 10); } catch (e) { } // I-J
            try { worksheet.mergeCells(currentRow - 1, 11, currentRow - 1, 12); } catch (e) { } // K-L
            try { worksheet.mergeCells(currentRow - 1, 13, currentRow - 1, 14); } catch (e) { } // M-N

            const hBorder: any = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
            const hAlign: any = { vertical: 'middle', horizontal: 'center', wrapText: true };
            const hFont: any = { name: 'Calibri', size: 12, bold: true };
            const hFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].forEach(colIndex => {
                const cell = headerRow.getCell(colIndex);
                cell.border = hBorder; cell.alignment = hAlign; cell.font = hFont; cell.fill = hFill;
            });
            headerRow.height = 30;
            headerRow.commit();

            for (const sale of sales) {
                for (const item of sale.items) {
                    const row = worksheet.getRow(currentRow);

                    // Clear any raw tags that might be in the template cells
                    for (let c = 1; c <= 15; c++) {
                        row.getCell(c).value = null;
                    }

                    // Write values to specific columns natively, disregarding any corrupt template formatting
                    row.getCell(1).value = `${sale.id} - ${new Date(sale.date).toLocaleDateString()}`;
                    row.getCell(3).value = sale.sellerName;                 // C
                    row.getCell(5).value = item.quantity;                   // E
                    row.getCell(7).value = item.product.name;               // G
                    row.getCell(9).value = Number(item.product.price.toFixed(2)); // I
                    row.getCell(11).value = Number((item.quantity * item.product.price).toFixed(2)); // K
                    row.getCell(13).value = item.product.fechaCompra || ''; // M

                    // Safely apply new horizontal merges per line (1 row tall, 2 cols wide)
                    try { worksheet.mergeCells(currentRow, 3, currentRow, 4); } catch (e) { } // C-D
                    try { worksheet.mergeCells(currentRow, 5, currentRow, 6); } catch (e) { } // E-F
                    try { worksheet.mergeCells(currentRow, 7, currentRow, 8); } catch (e) { } // G-H
                    try { worksheet.mergeCells(currentRow, 9, currentRow, 10); } catch (e) { } // I-J
                    try { worksheet.mergeCells(currentRow, 11, currentRow, 12); } catch (e) { } // K-L
                    try { worksheet.mergeCells(currentRow, 13, currentRow, 14); } catch (e) { } // M-N

                    // Apply robust styles explicitly AFTER merging to ensure Excel displays them
                    const borderStyle: any = {
                        top: { style: 'thin' }, left: { style: 'thin' },
                        bottom: { style: 'thin' }, right: { style: 'thin' }
                    };
                    const centerAlign: any = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    const fontStyle: any = { name: 'Calibri', size: 11 };

                    const colsToStyle = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
                    colsToStyle.forEach(colIndex => {
                        const cell = row.getCell(colIndex);
                        cell.border = borderStyle;
                        cell.alignment = centerAlign;
                        cell.font = fontStyle;
                    });

                    // Set row height to match the header visually a bit better
                    row.height = 45;
                    row.commit();
                    currentRow++;
                }
            }

            // Clean up any remaining blank formatted rows the user might have left in their template below the data
            for (let i = 0; i < 5; i++) {
                worksheet.spliceRows(currentRow, 1);
            }

            const excelBuffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const dateStr = new Date().toISOString().split('T')[0];
            const typeName = tipo.charAt(0).toUpperCase() + tipo.slice(1);
            saveAs(blob, `Reporte_${typeName}_Ventas_${dateStr}.xlsx`);

        } catch (error: any) {
            console.error('Error al generar el reporte Excel con plantilla:', error);

            let errorMessage = 'Hubo un error al generar el reporte de Excel.';

            if (error.status === 404) {
                errorMessage = 'No se encontró la plantilla en /reportes/Hoja Membretada EXcel.xlsx. Asegúrate de que existe este archivo.';
            } else if (error.message) {
                errorMessage += '\nDetalle: ' + error.message;
            }

            alert(errorMessage);
        }
    }

    async generarReporteVentaExcel(sale: Sale) {
        try {
            const ExcelJS = await import('exceljs');
            const url = '/reportes/' + encodeURIComponent('Hoja Membretada EXcel.xlsx');
            const templateBuffer = await firstValueFrom(this.http.get(url, { responseType: 'arraybuffer' }));

            if (!templateBuffer) throw new Error('Plantilla vacía');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(templateBuffer);
            const worksheet = workbook.worksheets[0];

            let currentRow = 11;
            const headerRow = worksheet.getRow(10);
            headerRow.getCell(1).value = 'Venta';
            headerRow.getCell(3).value = 'Vendedor';
            headerRow.getCell(5).value = 'Cantidad';
            headerRow.getCell(7).value = 'Producto';
            headerRow.getCell(9).value = 'Precio Unt.';
            headerRow.getCell(11).value = 'Importe';
            headerRow.getCell(13).value = 'Fecha Compra';

            for (const item of sale.items) {
                const row = worksheet.getRow(currentRow);
                for (let c = 1; c <= 15; c++) row.getCell(c).value = null;

                row.getCell(1).value = sale.id;
                row.getCell(3).value = sale.sellerName;
                row.getCell(5).value = item.quantity;
                row.getCell(7).value = item.product.name;
                row.getCell(9).value = Number(item.product.price.toFixed(2));
                row.getCell(11).value = Number((item.quantity * item.product.price).toFixed(2));
                row.getCell(13).value = item.product.fechaCompra || '';

                const colsToMerge = [[3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14]];
                for (const [start, end] of colsToMerge) {
                    try { worksheet.mergeCells(currentRow, start, currentRow, end); } catch (e) { }
                }

                const borderStyle: any = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                const centerAlign: any = { vertical: 'middle', horizontal: 'center', wrapText: true };

                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].forEach(colIndex => {
                    const cell = row.getCell(colIndex);
                    cell.border = borderStyle; cell.alignment = centerAlign;
                    cell.font = { name: 'Calibri', size: 11 };
                });
                row.height = 45;
                row.commit();
                currentRow++;
            }
            const excelBuffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Recibo_Venta_${sale.id}.xlsx`);
        } catch (error: any) {
            console.error('Error al generar Excel de Venta:', error);
            alert('Hubo un error al generar el archivo Excel.');
        }
    }
}
