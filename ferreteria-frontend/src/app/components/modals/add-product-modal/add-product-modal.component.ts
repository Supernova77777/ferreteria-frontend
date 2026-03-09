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

    productForm: Partial<Product> & { codigo: string, name: string, marca: string, price: number, stock: number, fechaCompra: string } = {
        codigo: '',
        name: '',
        marca: 'TRUPER', // default
        price: 0,
        stock: 0,
        fechaCompra: new Date().toISOString().split('T')[0] // default to today
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

    save() {
        if (this.editProduct) {
            const success = this.productService.updateProduct(
                { ...this.productForm, id: this.productForm.id || this.editProduct.id } as Product,
                this.editProduct.id
            );
            if (!success) {
                alert('El Código de Producto ingresado ya está en uso.');
                return;
            }
        } else {
            this.productService.addProduct(this.productForm);
        }
        this.close();
    }
}
