import { Component, signal, effect } from '@angular/core';
import { Inventory } from '../inventory/inventory';
import { AuthService, UserRole } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { SaleService } from '../../services/sale.service';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  salesData: any[] = [];
  selectedBrand: string = 'Todas';
  sliderStyle: any = { width: '85px', transform: 'translateX(0px)' };

  chartData: any = {
    labels: [],
    datasets: []
  };

  chartOptions: any = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  constructor(
    private authService: AuthService,
    private saleService: SaleService,
    private productService: ProductService
  ) {
    effect(() => {
      // This will run automatically whenever saleService.sales() changes
      this.updateChartData(this.saleService.sales());
    });
  }

  get availableBrands(): string[] {
    // Get all unique brands from the inventory (ProductService)
    const brands = [...new Set(this.productService.products().map(p => p.marca))];
    return ['Todas', ...brands.sort()];
  }

  selectBrand(brand: string, event?: MouseEvent) {
    this.selectedBrand = brand;
    if (event) {
      const target = event.target as HTMLElement;
      this.sliderStyle = {
        width: `${target.offsetWidth}px`,
        transform: `translateX(${target.offsetLeft - 6}px)` // -6 for container padding
      };
    } else {
      // Default position for 'Todas' (rough estimate to avoid jumps on load)
      this.sliderStyle = { width: '92px', transform: 'translateX(0px)' };
    }
    this.updateChartData(this.saleService.sales());
  }

  isAdmin() {
    return this.authService.hasRole(['admin', 'administrator']);
  }

  updateChartData(sales: any[]) {
    if (this.selectedBrand === 'Todas') {
      // Original logic: Global sales over time
      const salesByDate: { [key: string]: number } = {};
      const itemsByDate: { [key: string]: number } = {};

      sales.forEach((sale: any) => {
        const dateStr = new Date(sale.date).toLocaleDateString();
        if (!salesByDate[dateStr]) {
          salesByDate[dateStr] = 0;
          itemsByDate[dateStr] = 0;
        }
        salesByDate[dateStr] += sale.total;

        const itemsCount = sale.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
        itemsByDate[dateStr] += itemsCount;
      });

      const labels = Object.keys(salesByDate).sort();
      const moneyData = labels.map(label => salesByDate[label]);
      const itemsData = labels.map(label => itemsByDate[label]);

      this.chartData = {
        labels: labels,
        datasets: [
          {
            type: 'line',
            data: moneyData,
            label: 'Ingresos Totales ($)',
            backgroundColor: (context: any) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 400);
              gradient.addColorStop(0, 'rgba(33, 150, 243, 0.4)');
              gradient.addColorStop(1, 'rgba(33, 150, 243, 0.05)');
              return gradient;
            },
            borderColor: '#2196F3',
            borderWidth: 3,
            pointBackgroundColor: '#2196F3',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#2196F3',
            pointRadius: 4,
            pointHoverRadius: 6,
            yAxisID: 'y',
            fill: true,
            tension: 0.4
          },
          {
            type: 'bar', // Changed from line to bar for the secondary metric to look cooler
            data: itemsData,
            label: 'Artículos Vendidos',
            backgroundColor: 'rgba(76, 175, 80, 0.8)',
            borderColor: 'rgba(76, 175, 80, 1)',
            borderWidth: 0,
            borderRadius: 6,
            yAxisID: 'y1',
          }
        ]
      };

      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            labels: { color: '#e2e8f0', font: { family: "'Inter', sans-serif", size: 13 } }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 4,
            usePointStyle: true
          }
        },
        scales: {
          x: {
            display: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: 'Fecha', color: '#94a3b8' }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: 'Ingresos ($)', color: '#94a3b8' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { display: false },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: 'Cantidad (Unidades)', color: '#94a3b8' }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      };
    } else {
      // Logic for selected brand: Products sold for this brand
      const productSales: { [key: string]: { quantity: number, revenue: number, dates: Date[] } } = {};

      sales.forEach((sale: any) => {
        sale.items.forEach((item: any) => {
          if (item.product.marca === this.selectedBrand) {
            const prodName = item.product.name;
            if (!productSales[prodName]) {
              productSales[prodName] = { quantity: 0, revenue: 0, dates: [] };
            }
            productSales[prodName].quantity += item.quantity;
            productSales[prodName].revenue += (item.quantity * item.product.price);
            productSales[prodName].dates.push(new Date(sale.date));
          }
        });
      });

      // Sort products by revenue descending
      const sortedProducts = Object.keys(productSales).sort((a, b) => productSales[b].revenue - productSales[a].revenue);
      const labels = sortedProducts;
      const quantityData = labels.map(label => productSales[label].quantity);
      const revenueData = labels.map(label => productSales[label].revenue);

      this.chartData = {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            data: revenueData,
            label: `Ingresos ($) - ${this.selectedBrand}`,
            backgroundColor: (context: any) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 400);
              gradient.addColorStop(0, 'rgba(33, 150, 243, 0.9)');
              gradient.addColorStop(1, 'rgba(33, 150, 243, 0.2)');
              return gradient;
            },
            borderColor: '#2196F3',
            borderWidth: 0,
            borderRadius: 6,
            hoverBackgroundColor: '#4dabf5',
            yAxisID: 'y'
          },
          {
            type: 'line',
            data: quantityData,
            label: `Unidades Vendidas - ${this.selectedBrand}`,
            backgroundColor: 'rgba(255, 107, 0, 0.1)',
            borderColor: '#ff6b00',
            borderWidth: 3,
            pointBackgroundColor: '#ff6b00',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#ff6b00',
            pointRadius: 5,
            pointHoverRadius: 7,
            yAxisID: 'y1',
            fill: true,
            tension: 0.3
          }
        ]
      };

      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            labels: { color: '#e2e8f0', font: { family: "'Inter', sans-serif", size: 13 } }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              afterLabel: function (context: any) {
                const prodName = context.label;
                const saleDates = productSales[prodName]?.dates || [];
                if (saleDates.length > 0) {
                  // Mostrar las últimas 3 fechas de venta (o todas si son menos) para no saturar el tooltip
                  const recentDates = saleDates.slice(-3).map((d: Date) => new Date(d).toLocaleString());
                  let dateStr = 'Fechas de Venta: ' + recentDates.join(', ');
                  if (saleDates.length > 3) {
                    dateStr += ` (+${saleDates.length - 3} más)`;
                  }
                  return dateStr;
                }
                return 'Fechas de Venta: No disponibles';
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: 'Ingresos ($)', color: '#94a3b8' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { display: false },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: 'Cantidad (Unidades)', color: '#94a3b8' },
            beginAtZero: true
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      };
    }

  }
}