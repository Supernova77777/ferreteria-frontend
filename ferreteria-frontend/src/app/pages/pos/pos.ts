import { Component, computed, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from '../../services/product.service';
import { MarcaIconService } from '../../services/marca-icon.service';
import { AuthService } from '../../services/auth.service';
import { SaleService } from '../../services/sale.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../../../config/api.base';

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
  http = inject(HttpClient);
  cdr = inject(ChangeDetectorRef);

  crossSellingSuggestion: Product | null = null;

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

  async onSearchInput() {
    this.showAutocomplete = true;
    await this.productService.searchProducts(this.searchQuery);
  }

  // Computed products for Autocomplete - filtra localmente por nombre, codigo o marca
  get autocompleteResults() {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return [];
    return this.productService.products()
      .filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.codigo && p.codigo.toLowerCase().includes(query)) ||
        p.marca.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }

  // Computed products grouped by marca
  get groupedProducts() {
    const products = this.productService.products();

    const filtered = products.filter(p => {
      return this.selectedBrand ? p.marca === this.selectedBrand : true;
    });

    const grouped: { [marca: string]: Product[] } = {};
    for (const p of filtered) {
      if (!grouped[p.marca]) {
        grouped[p.marca] = [];
      }
      grouped[p.marca].push(p);
    }

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
  checkoutError = '';

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

  onSearchBlur() {
    setTimeout(() => {
      this.showAutocomplete = false;
    }, 200);
  }

  executeSearch() {
    this.showAutocomplete = false;
    this.productService.searchProducts(this.searchQuery);
  }

  selectAutocompleteItem(product: Product) {
    this.addToCart(product);
    this.searchQuery = '';
    this.showAutocomplete = false;
    this.productService.loadProducts();
  }

  addToCart(product: Product) {
    if (product.stock <= 0) return;

    this.crossSellingSuggestion = null;

    const existing = this.cart.find(i => i.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        existing.quantity++;
      }
    } else {
      this.cart.push({ product, quantity: 1 });
    }

    // Ejecutar petición en segundo plano para no bloquear a la cajera
    this.fetchCrossSellingSuggestion(product.id);
  }

  private async fetchCrossSellingSuggestion(productId: string) {
    try {
      const endpoint = `${API_BASE}/ai/cross-selling/${productId}`;
      const rec = await firstValueFrom(this.http.get<Product>(endpoint));
      if (rec && rec.name) {
         this.crossSellingSuggestion = rec;
         this.cdr.detectChanges();
      }
    } catch (e) {
      // Silenciar error (ej. 404 si no hay recomendación)
    }
  }

  addSuggestedToCart() {
    if (this.crossSellingSuggestion) {
      this.addToCart(this.crossSellingSuggestion);
      this.crossSellingSuggestion = null; // Hide after adding
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

  async checkout() {
    if (this.cart.length === 0) return;

    this.checkoutError = '';

    // NOTE: NO llamamos productService.updateProduct() aqui porque el backend
    // ya descuenta el stock automaticamente al registrar la venta (VentaService.registrarVenta).
    // Llamar updateProduct() ademas del addSale() causaria doble deduccion de stock.

    const currentUser = this.authService.currentUser();

    try {
      await this.saleService.addSale({
        items: this.cart.map(item => ({
          product: item.product,
          quantity: item.quantity
        })),
        subtotal: this.cartSubtotal,
        tax: this.cartTax,
        total: this.cartTotal,
        sellerName: currentUser?.name || 'Desconocido',
        sellerRole: currentUser?.role === 'admin' ? 'Coordinador' : (currentUser?.role === 'administrator' ? 'Administrador' : 'Empleado')
      });

      // Recargar productos del backend para mostrar el stock actualizado
      await this.productService.loadProducts();

      this.showSuccessModal = true;
      this.cart = [];
      this.searchQuery = '';
      this.showAutocomplete = false;

    } catch (error: any) {
      console.error('Error en checkout:', error);
      if (error?.error?.message) {
        this.checkoutError = error.error.message;
      } else {
        this.checkoutError = 'Error al procesar la venta. Intente nuevamente.';
      }
    }
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
  }

  getIcon(marca: string) {
    return this.iconService.getIcon(marca);
  }

  editIcon(marca: string) {
    const newIcon = prompt(`Ingresa un nuevo emoji para la categoria "${marca}":`, this.getIcon(marca));
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
