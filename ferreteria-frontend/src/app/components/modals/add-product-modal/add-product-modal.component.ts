import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from '../../../services/product.service';

@Component({
    selector: 'app-add-product-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './add-product-modal.component.html',
    styleUrl: './add-product-modal.component.css'
})
export class AddProductModalComponent implements OnInit {
    @Input() editProduct: Product | null = null;
    @Output() closeModal = new EventEmitter<void>();

    productService = inject(ProductService);
    isSaving = false;
    errorMsg = '';

    productForm: Partial<Product> & { codigo: string, name: string, marca: string, price: number, stock: number, fechaCompra: string } = {
        codigo: '',
        name: '',
        marca: 'TRUPER',
        price: 0,
        stock: 0,
        fechaCompra: new Date().toISOString().split('T')[0]
    };

    ngOnInit() {
        if (this.editProduct) {
            this.productForm = {
                id: this.editProduct.id,
                codigo: this.editProduct.codigo || '',
                name: this.editProduct.name,
                marca: this.editProduct.marca,
                price: this.editProduct.price,
                stock: this.editProduct.stock,
                fechaCompra: this.editProduct.fechaCompra || ''
            };
        }
    }

    close() {
        this.closeModal.emit();
    }

    async save() {
        if (!this.productForm.name || !this.productForm.marca) {
            this.errorMsg = 'El nombre y la marca son obligatorios.';
            return;
        }

        this.isSaving = true;
        this.errorMsg = '';

        try {
            if (this.editProduct) {
                const success = await this.productService.updateProduct(
                    { ...this.productForm, id: this.productForm.id || this.editProduct.id } as Product,
                    this.editProduct.id
                );
                if (!success) {
                    this.errorMsg = 'Error al actualizar el producto. Verifique los datos.';
                    return;
                }
            } else {
                await this.productService.addProduct(this.productForm);
            }
            this.close();
        } catch (e: any) {
            this.errorMsg = e?.error?.message || 'Error al guardar el producto.';
        } finally {
            this.isSaving = false;
        }
    }
}
