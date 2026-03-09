import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService, Sale } from '../../services/sale.service';

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './history.html',
    styleUrl: './history.css'
})
export class History {
    saleService = inject(SaleService);

    get sales() {
        return this.saleService.getSales();
    }

    // To track which sale details are currently expanded
    expandedSaleId: string | null = null;

    toggleDetails(saleId: string) {
        if (this.expandedSaleId === saleId) {
            this.expandedSaleId = null;
        } else {
            this.expandedSaleId = saleId;
        }
    }

    showClearModal = false;

    clearHistory() {
        if (this.sales.length === 0) return;
        this.showClearModal = true;
    }

    cancelClear() {
        this.showClearModal = false;
    }

    confirmClear() {
        this.saleService.clearSales();
        this.showClearModal = false;
    }

    descargarReporte(sale: Sale, event: Event) {
        event.stopPropagation(); // Prevent toggling the accordion
        this.saleService.generarReporteVenta(sale);
    }

    descargarReporteExcel(sale: Sale, event: Event) {
        event.stopPropagation(); // Prevent toggling the accordion
        this.saleService.generarReporteVentaExcel(sale);
    }

    tipoReporteGlobal: 'global' | 'dia' | 'semana' | 'mes' = 'global';
    selectedDay = '';
    selectedWeek = '';
    selectedMonth = '';

    get availableDays() {
        const set = new Set<string>();
        this.sales.forEach(s => {
            const d = new Date(s.date);
            const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            set.add(str);
        });
        return Array.from(set).sort().reverse();
    }

    get availableWeeks() {
        const set = new Set<string>();
        this.sales.forEach(s => {
            const d = new Date(s.date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.getFullYear(), d.getMonth(), diff);
            const str = monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
            set.add(str);
        });
        return Array.from(set).sort().reverse();
    }

    get availableMonths() {
        const set = new Set<string>();
        this.sales.forEach(s => {
            const d = new Date(s.date);
            const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            set.add(str);
        });
        return Array.from(set).sort().reverse();
    }

    descargarReporteGlobal() {
        let param = undefined;
        if (this.tipoReporteGlobal === 'dia') param = this.selectedDay || this.availableDays[0];
        if (this.tipoReporteGlobal === 'semana') param = this.selectedWeek || this.availableWeeks[0];
        if (this.tipoReporteGlobal === 'mes') param = this.selectedMonth || this.availableMonths[0];

        this.saleService.generarReporteGlobal(this.tipoReporteGlobal, param);
    }

    descargarReporteGlobalExcel() {
        let param = undefined;
        if (this.tipoReporteGlobal === 'dia') param = this.selectedDay || this.availableDays[0];
        if (this.tipoReporteGlobal === 'semana') param = this.selectedWeek || this.availableWeeks[0];
        if (this.tipoReporteGlobal === 'mes') param = this.selectedMonth || this.availableMonths[0];

        this.saleService.generarReporteGlobalExcel(this.tipoReporteGlobal, param);
    }
}
