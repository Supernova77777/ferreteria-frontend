import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class MarcaIconService {
    icons = signal<{ [marca: string]: string }>({});
    private storageKey = 'ferreteria_category_icons';

    constructor() {
        this.loadIcons();
    }

    private loadIcons() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            this.icons.set(JSON.parse(stored));
        } else {
            // Default icons
            const defaultIcons: { [marca: string]: string } = {
                'Herramientas Manuales': '🔨',
                'Herramientas Eléctricas': '🔌',
                'Plomería': '🚰',
                'Electricidad': '⚡',
                'Pinturas': '🎨',
                'Construcción': '🧱',
                'Consumibles': '📦',
            };
            this.icons.set(defaultIcons);
            this.saveToStorage();
        }
    }

    private saveToStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.icons()));
    }

    updateIcon(marca: string, newIcon: string) {
        this.icons.update(icons => ({ ...icons, [marca]: newIcon }));
        this.saveToStorage();
    }

    getIcon(marca: string): string {
        return this.icons()[marca] || '📦';
    }
}
