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
    originalEditingId = signal<number | undefined>(undefined);

    // Modal de confirmacion de eliminacion
    showDeleteModal = signal(false);
    userToDelete = signal<User | null>(null);

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

    async loadUsers() {
        const userList = await this.authService.getUsers();
        this.users.set(userList);
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
        this.originalEditingId.set(undefined);
    }

    editUser(user: User) {
        this.isEditing.set(true);
        this.originalEditingUsername.set(user.username);
        this.originalEditingId.set(user.id);
        this.newUser = {
            name: user.name || '',
            username: user.username || '',
            password: '',
            role: user.role || 'employee',
            phone: user.phone || ''
        };
        this.showUserModal.set(true);
        this.modalError.set('');
        this.modalSuccess.set('');
    }

    async saveUser() {
        if (!this.newUser.username) {
            this.modalError.set('El usuario es obligatorio');
            return;
        }
        // Al crear, la contrasena es obligatoria; al editar, es opcional (si se deja vacia, no se cambia)
        if (!this.isEditing() && !this.newUser.password) {
            this.modalError.set('La contrasena es obligatoria al crear un usuario');
            return;
        }

        if (this.isEditing()) {
            try {
                const success = await this.authService.updateUser(this.originalEditingId(), {
                    name: this.newUser.name,
                    username: this.newUser.username,
                    password: this.newUser.password || undefined,
                    role: this.newUser.role,
                    phone: this.newUser.phone
                } as User);

                if (success) {
                    this.modalSuccess.set('Usuario actualizado exitosamente');
                    this.modalError.set('');
                    await this.loadUsers();
                    setTimeout(() => this.closeUserModal(), 1500);
                }
            } catch (error: any) {
                const msg = error?.error?.message || error?.message || 'Error al actualizar el usuario';
                this.modalError.set(msg);
            }
        } else {
            try {
                const success = await this.authService.addUser({
                    name: this.newUser.name,
                    username: this.newUser.username,
                    password: this.newUser.password,
                    role: this.newUser.role,
                    phone: this.newUser.phone
                } as User);

                if (success) {
                    this.modalSuccess.set('Usuario creado exitosamente');
                    this.modalError.set('');
                    await this.loadUsers();
                    setTimeout(() => this.closeUserModal(), 1500);
                }
            } catch (error: any) {
                const msg = error?.error?.message || error?.message || 'El nombre de usuario ya existe';
                this.modalError.set(msg);
            }
        }
    }

    // Muestra el modal de confirmacion de eliminacion
    confirmDeleteUser(user: User) {
        this.userToDelete.set(user);
        this.showDeleteModal.set(true);
    }

    cancelDeleteUser() {
        this.userToDelete.set(null);
        this.showDeleteModal.set(false);
    }

    async executeDeleteUser() {
        const user = this.userToDelete();
        this.showDeleteModal.set(false);
        this.userToDelete.set(null);
        if (!user) return;
        try {
            const deleted = await this.authService.deleteUser(user.id);
            if (deleted) {
                await this.loadUsers();
            }
        } catch (error: any) {
            alert('No se pudo eliminar: ' + (error?.error?.message || 'Error desconocido'));
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
