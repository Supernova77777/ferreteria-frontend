import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from '../../services/product.service';
import { MarcaIconService } from '../../services/marca-icon.service';
import { AuthService } from '../../services/auth.service';
import { SaleService } from '../../services/sale.service';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos.html',
  styleUrl: './pos.css',
})
export class Pos {
  productService = inject(ProductService);
  iconService = inject(MarcaIconService);
  authService = inject(AuthService);
  saleService = inject(SaleService);

  searchQuery = '';
  showAutocomplete = false;

  selectedBrand: string | null = null;
  brands = ['TRUPER', 'PRETUL', 'FOSET', 'VOLTECK', 'FIERO', 'HERMEX', 'Klintek'];

  selectBrand(marca: string) {
    if (this.selectedBrand === marca) {
      this.selectedBrand = null;
    } else {
      this.selectedBrand = marca;
    }
  }

  // Global Config for IVA (Simulated stored locally)
  ivaPercentage = Number(localStorage.getItem('ferreteria_iva')) || 16;

  // Computed products for Autocomplete
  get autocompleteResults() {
    if (!this.searchQuery.trim()) return [];
    const query = this.searchQuery.toLowerCase();
    return this.productService.products()
      .filter(p => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query))
      .slice(0, 5); // Max 5 results
  }

  // Computed products grouped by marca
  get groupedProducts() {
    const products = this.productService.products();
    const query = this.searchQuery.toLowerCase();

    // Filter first
    const filtered = products.filter(p => {
      const matchesQuery = p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query);
      const matchesBrand = this.selectedBrand ? p.marca === this.selectedBrand : true;
      return matchesQuery && matchesBrand;
    });

    // Group by marca
    const grouped: { [marca: string]: Product[] } = {};
    for (const p of filtered) {
      if (!grouped[p.marca]) {
        grouped[p.marca] = [];
      }
      grouped[p.marca].push(p);
    }

    // Convert to array of objects for easier iteration
    return Object.keys(grouped).sort().map(marca => ({
      marca,
      products: grouped[marca]
    }));
  }

  // Simple cart state
  cart: { product: Product, quantity: number }[] = [];

  showIvaModal = false;
  tempIvaPercentage = 0;
  showSuccessModal = false;

  get cartSubtotal() {
    return this.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }

  get cartTax() {
    return this.cartSubtotal * (this.ivaPercentage / 100);
  }

  get cartTotal() {
    return this.cartSubtotal + this.cartTax;
  }

  onSearchFocus() {
    this.showAutocomplete = true;
  }

  // To allow click on autocomplete item before blur hides it
  onSearchBlur() {
    setTimeout(() => {
      this.showAutocomplete = false;
    }, 200);
  }

  executeSearch() {
    this.showAutocomplete = false;
  }

  selectAutocompleteItem(product: Product) {
    this.addToCart(product);
    this.searchQuery = ''; // Clear search after adding
    this.showAutocomplete = false;
  }

  addToCart(product: Product) {
    if (product.stock <= 0) return;

    const existing = this.cart.find(i => i.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        existing.quantity++;
      }
    } else {
      this.cart.push({ product, quantity: 1 });
    }
  }

  increaseQuantity(index: number) {
    const item = this.cart[index];
    if (item.quantity < item.product.stock) {
      item.quantity++;
    }
  }

  decreaseQuantity(index: number) {
    const item = this.cart[index];
    if (item.quantity > 1) {
      item.quantity--;
    } else {
      this.removeFromCart(index);
    }
  }

  removeFromCart(index: number) {
    this.cart.splice(index, 1);
  }

  checkout() {
    if (this.cart.length === 0) return;

    // Subtract stock from products
    for (const item of this.cart) {
      this.productService.updateProduct({
        ...item.product,
        stock: item.product.stock - item.quantity
      });
    }

    // Register sale in history
    const currentUser = this.authService.currentUser();

    this.saleService.addSale({
      items: [...this.cart],  // Clone cart
      subtotal: this.cartSubtotal,
      tax: this.cartTax,
      total: this.cartTotal,
      sellerName: currentUser?.name || 'Desconocido',
      sellerRole: currentUser?.role === 'admin' ? 'Coordinador' : (currentUser?.role === 'administrator' ? 'Administrador' : 'Empleado')
    });

    this.showSuccessModal = true;
    this.cart = [];
    this.searchQuery = '';
    this.showAutocomplete = false;
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
  }

  getIcon(marca: string) {
    return this.iconService.getIcon(marca);
  }

  editIcon(marca: string) {
    const newIcon = prompt(`Ingresa un nuevo emoji para la categoría "${marca}":`, this.getIcon(marca));
    if (newIcon && newIcon.trim() !== '') {
      this.iconService.updateIcon(marca, newIcon.trim());
    }
  }

  isAdmin() {
    return this.authService.hasRole(['admin', 'administrator']);
  }

  editIVA() {
    if (!this.isAdmin()) return;
    this.tempIvaPercentage = this.ivaPercentage;
    this.showIvaModal = true;
  }

  cancelIva() {
    this.showIvaModal = false;
  }

  confirmIva() {
    if (this.tempIvaPercentage !== null && this.tempIvaPercentage >= 0) {
      this.ivaPercentage = this.tempIvaPercentage;
      localStorage.setItem('ferreteria_iva', this.ivaPercentage.toString());
      this.showIvaModal = false;
    }
  }
}
