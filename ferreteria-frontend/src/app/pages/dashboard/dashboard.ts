import { Component, signal, effect, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
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
  isLoadingChart = false;

  chartData: any = {
    labels: [],
    datasets: []
  };

  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true }
    }
  };

  constructor(
    private authService: AuthService,
    private saleService: SaleService,
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) {
    // Cargar datos al inicio
    this.updateChartData(this.saleService.sales());

    // Actualiza el chart automaticamente cuando cambian las ventas
    effect(() => {
      this.updateChartData(this.saleService.sales());
    });
  }

  get availableBrands(): string[] {
    const brands = [...new Set(this.productService.products().map(p => p.marca))];
    return ['Todas', ...brands.sort()];
  }

  selectBrand(brand: string, event?: MouseEvent) {
    this.selectedBrand = brand;
    if (event) {
      const target = event.target as HTMLElement;
      this.sliderStyle = {
        width: `${target.offsetWidth}px`,
        transform: `translateX(${target.offsetLeft - 6}px)`
      };
    } else {
      this.sliderStyle = { width: '92px', transform: 'translateX(0px)' };
    }
    this.updateChartData(this.saleService.sales());
  }

  isAdmin() {
    return this.authService.hasRole(['admin', 'administrator']);
  }

  async updateChartData(sales: any[]) {
    this.isLoadingChart = true;

    if (this.selectedBrand === 'Todas') {
      try {
        const response = await fetch('http://localhost:8080/api/ventas/dashboard');
        const data = await response.json();

        const labels = data.map((d: any) => d.dia);
        const moneyData = data.map((d: any) => Number(d.total));

        if (labels.length === 0) {
          // Si no hay ventas en el backend, mostrar mensaje vacio con ejes vacios
          this.chartData = {
            labels: ['Sin ventas registradas'],
            datasets: [{
              type: 'bar',
              data: [0],
              label: 'Ingresos Totales ($)',
              backgroundColor: 'rgba(33, 150, 243, 0.4)',
              borderColor: '#2196F3',
              borderWidth: 2
            }]
          };
        } else {
          this.chartData = {
            labels: labels,
            datasets: [
              {
                type: 'line',
                data: moneyData,
                label: 'Ingresos Totales ($)',
                backgroundColor: 'rgba(33, 150, 243, 0.15)',
                borderColor: '#2196F3',
                borderWidth: 3,
                pointBackgroundColor: '#2196F3',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#2196F3',
                pointRadius: 5,
                pointHoverRadius: 7,
                yAxisID: 'y',
                fill: true,
                tension: 0.4
              }
            ]
          };
        }

        this.chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
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
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8' },
              title: { display: true, text: 'Fecha', color: '#94a3b8' }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8' },
              title: { display: true, text: 'Ingresos ($)', color: '#94a3b8' }
            }
          },
          animation: { duration: 800, easing: 'easeOutQuart' }
        };

        // Forzar deteccion de cambios en Angular
        this.cdr.detectChanges();

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        this.chartData = {
          labels: ['Error al cargar datos'],
          datasets: [{ type: 'bar', data: [0], label: 'Sin datos', backgroundColor: 'rgba(255,0,0,0.2)' }]
        };
      }
    } else {
      // Filtro por marca: usar ventas del signal (locales/backend)
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

      const sortedProducts = Object.keys(productSales).sort((a, b) => productSales[b].revenue - productSales[a].revenue);
      const labels = sortedProducts;
      const quantityData = labels.map(label => productSales[label].quantity);
      const revenueData = labels.map(label => productSales[label].revenue);

      if (labels.length === 0) {
        this.chartData = {
          labels: ['Sin ventas de ' + this.selectedBrand],
          datasets: [{ type: 'bar', data: [0], label: 'Sin datos', backgroundColor: 'rgba(255, 107, 0, 0.2)' }]
        };
      } else {
        this.chartData = {
          labels: labels,
          datasets: [
            {
              type: 'bar',
              data: revenueData,
              label: `Ingresos ($) - ${this.selectedBrand}`,
              backgroundColor: 'rgba(33, 150, 243, 0.8)',
              borderColor: '#2196F3',
              borderWidth: 0,
              borderRadius: 6,
              hoverBackgroundColor: '#4dabf5',
              yAxisID: 'y'
            },
            {
              type: 'line',
              data: quantityData,
              label: `Unidades - ${this.selectedBrand}`,
              backgroundColor: 'rgba(255, 107, 0, 0.1)',
              borderColor: '#ff6b00',
              borderWidth: 3,
              pointBackgroundColor: '#ff6b00',
              pointBorderColor: '#fff',
              pointRadius: 5,
              pointHoverRadius: 7,
              yAxisID: 'y1',
              fill: true,
              tension: 0.3
            }
          ]
        };
      }

      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
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
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: 'Ingresos ($)', color: '#94a3b8' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: 'Unidades', color: '#94a3b8' }
          }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      };

      this.cdr.detectChanges();
    }

    this.isLoadingChart = false;
  }
}