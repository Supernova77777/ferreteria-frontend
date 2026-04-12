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

  // Modal de confirmacion de eliminacion
  showDeleteModal = false;
  productToDelete: Product | null = null;
  isDeleting = false;
  deleteErrorMsg = '';

  get marcasDisponibles() {
    return [...new Set(this.products().map(p => p.marca))].sort();
  }

  // Filtra localmente por texto y marca de forma instantanea
  get filteredProducts() {
    let result = this.products();
    const query = this.searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.codigo && p.codigo.toLowerCase().includes(query)) ||
        p.marca.toLowerCase().includes(query) ||
        String(p.id).toLowerCase().includes(query)
      );
    }

    if (this.selectedMarca !== 'todas') {
      result = result.filter(p => p.marca === this.selectedMarca);
    }

    return result;
  }

  openModal(product?: Product) {
    this.productToEdit = product || null;
    this.showModal = true;
  }

  async onCloseModal() {
    this.showModal = false;
    this.productToEdit = null;
    // Recargar productos del backend para reflejar los cambios
    await this.productService.loadProducts();
  }

  confirmDeleteProduct(product: Product) {
    this.productToDelete = product;
    this.showDeleteModal = true;
    this.deleteErrorMsg = '';
    this.isDeleting = false;
  }

  cancelDeleteProduct() {
    this.productToDelete = null;
    this.showDeleteModal = false;
    this.deleteErrorMsg = '';
    this.isDeleting = false;
  }

  async executeDeleteProduct() {
    if (!this.productToDelete) return;
    this.isDeleting = true;
    this.deleteErrorMsg = '';
    try {
      await this.productService.deleteProduct(this.productToDelete.id);
      this.cancelDeleteProduct(); // success: close and clear
    } catch (e: any) {
      this.deleteErrorMsg = e.message;
    } finally {
      this.isDeleting = false;
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
