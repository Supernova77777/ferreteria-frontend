import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserRole, User } from '../../services/auth.service';

@Component({
    selector: 'app-users',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './users.html',
    styleUrl: './users.css',
})
export class Users {
    showUserModal = signal(false);
    modalError = signal('');
    modalSuccess = signal('');
    isEditing = signal(false);
    originalEditingUsername = signal('');

    newUser = {
        name: '',
        username: '',
        password: '',
        role: 'employee' as UserRole,
        phone: ''
    };

    users = signal<User[]>([]);
    visiblePasswords = new Set<string>();

    constructor(private authService: AuthService) {
        this.loadUsers();
    }

    loadUsers() {
        this.users.set(this.authService.getUsers());
    }

    isAdmin() {
        return this.authService.hasRole(['admin', 'administrator']);
    }

    openUserModal() {
        this.showUserModal.set(true);
        this.resetForm();
    }

    closeUserModal() {
        this.showUserModal.set(false);
    }

    resetForm() {
        this.newUser = {
            name: '',
            username: '',
            password: '',
            role: 'employee',
            phone: ''
        };
        this.modalError.set('');
        this.modalSuccess.set('');
        this.isEditing.set(false);
        this.originalEditingUsername.set('');
    }

    editUser(user: { username: string; name: string; role: UserRole; password?: string; phone?: string }) {
        const fullUsers = this.authService.getUsers() as any[];
        const fullUser = fullUsers.find(u => u.username === user.username);

        this.isEditing.set(true);
        this.originalEditingUsername.set(user.username);
        this.newUser = {
            name: fullUser?.name || '',
            username: fullUser?.username || '',
            password: fullUser?.password || '',
            role: fullUser?.role || 'employee',
            phone: fullUser?.phone || ''
        };
        this.showUserModal.set(true);
        this.modalError.set('');
        this.modalSuccess.set('');
    }

    saveUser() {
        if (!this.newUser.username || !this.newUser.password) {
            this.modalError.set('El usuario y contraseña son obligatorios');
            return;
        }

        if (this.isEditing()) {
            const success = this.authService.updateUser(this.originalEditingUsername(), {
                name: this.newUser.name,
                username: this.newUser.username,
                password: this.newUser.password,
                role: this.newUser.role,
                phone: this.newUser.phone
            } as User);

            if (success) {
                this.modalSuccess.set('Usuario actualizado exitosamente');
                this.modalError.set('');
                this.loadUsers(); // Refresh list
                setTimeout(() => this.closeUserModal(), 1500);
            } else {
                this.modalError.set('El nombre de usuario ya está en uso');
            }
        } else {
            const success = this.authService.addUser({
                name: this.newUser.name,
                username: this.newUser.username,
                password: this.newUser.password,
                role: this.newUser.role,
                phone: this.newUser.phone
            } as User);

            if (success) {
                this.modalSuccess.set('Usuario creado exitosamente');
                this.modalError.set('');
                this.loadUsers(); // Refresh list
                setTimeout(() => this.closeUserModal(), 1500);
            } else {
                this.modalError.set('El nombre de usuario ya existe');
            }
        }
    }

    deleteUser(username: string) {
        if (confirm('¿Está seguro de eliminar este usuario?')) {
            const deleted = this.authService.deleteUser(username);
            if (deleted) {
                this.loadUsers(); // Refresh list
            } else {
                alert('No se pudo eliminar el usuario');
            }
        }
    }

    togglePasswordVisibility(username: string) {
        if (this.visiblePasswords.has(username)) {
            this.visiblePasswords.delete(username);
        } else {
            this.visiblePasswords.add(username);
        }
    }
}
