import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [FormsModule, CommonModule],
    templateUrl: './login.html',
    styleUrl: './login.css'
})
export class Login implements OnInit {
    username = signal('');
    password = signal('');
    errorMessage = signal('');
    isLoading = signal(false);

    constructor(private authService: AuthService) { }

    ngOnInit() {
        // Limpiamos cualquier sesión residual para que no se muestre el Sidebar general
        if (this.authService.isLoggedIn()) {
            this.authService.logout();
        }
    }

    async login() {
        if (!this.username() || !this.password()) {
            this.errorMessage.set('Por favor ingrese usuario y contrasena');
            return;
        }

        this.errorMessage.set('');
        this.isLoading.set(true);

        try {
            const success = await this.authService.login(this.username(), this.password());
            if (!success) {
                this.errorMessage.set('Usuario o contrasena incorrectos');
            }
        } catch (error: any) {
            if (error?.status === 401) {
                this.errorMessage.set(error.error?.message || 'Usuario o contrasena incorrectos');
            } else if (error?.status === 0 || error?.status === 503) {
                this.errorMessage.set('No se pudo conectar con el servidor. Verifique su conexion.');
            } else {
                this.errorMessage.set('Error al iniciar sesion. Intente nuevamente.');
            }
        } finally {
            this.isLoading.set(false);
        }
    }
}
