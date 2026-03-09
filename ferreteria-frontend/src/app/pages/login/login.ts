import { Component, signal } from '@angular/core';
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
export class Login {
    username = signal('');
    password = signal('');
    errorMessage = signal('');

    constructor(private authService: AuthService) { }

    login() {
        if (!this.username() || !this.password()) {
            this.errorMessage.set('Por favor ingrese usuario y contraseña');
            return;
        }

        const success = this.authService.login(this.username(), this.password());

        if (!success) {
            this.errorMessage.set('Credenciales inválidas');
        } else {
            this.errorMessage.set('');
        }
    }
}
