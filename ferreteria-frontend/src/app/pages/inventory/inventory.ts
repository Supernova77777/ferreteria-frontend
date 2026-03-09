import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddProductModalComponent } from '../../components/modals/add-product-modal/add-product-modal.component';
import { AuthService } from '../../services/auth.service';
import { ProductService, Product } from '../../services/product.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, AddProductModalComponent],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css',
})
export class Inventory {
  authService = inject(AuthService);
  productService = inject(ProductService);
  currentUser = this.authService.currentUser;
  products = this.productService.products;

  showModal = false;
  productToEdit: Product | null = null;
  selectedMarca: string = 'todas';
  searchQuery: string = '';

  get marcasDisponibles() {
    return [...new Set(this.products().map(p => p.marca))].sort();
  }

  get filteredProducts() {
    let result = this.products();

    if (this.selectedMarca !== 'todas') {
      result = result.filter(p => p.marca === this.selectedMarca);
    }

    if (this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
      );
    }

    return result;
  }

  openModal(product?: Product) {
    this.productToEdit = product || null;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.productToEdit = null;
  }

  deleteProduct(id: string) {
    if (confirm('¿Está seguro de eliminar este producto?')) {
      this.productService.deleteProduct(id);
    }
  }

  descargarInventario() {
    const filter = this.selectedMarca === 'todas' ? undefined : this.selectedMarca;
    this.productService.generarReporteInventario(filter);
  }

  descargarInventarioExcel() {
    const filter = this.selectedMarca === 'todas' ? undefined : this.selectedMarca;
    this.productService.generarReporteExcel(filter);
  }

  isAdmin() {
    return this.authService.hasRole(['admin', 'administrator']);
  }
}
