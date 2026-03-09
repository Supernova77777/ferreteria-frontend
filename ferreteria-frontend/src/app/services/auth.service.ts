import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

export type UserRole = 'admin' | 'administrator' | 'employee' | null;

export interface User {
    username: string;
    password?: string; // Optional for security measure in frontend, but here used for mock auth
    role: UserRole;
    name: string;
    phone?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    currentUser = signal<User | null>(null);

    private usersKey = 'ferreteria_users';

    constructor(private router: Router) {
        this.initializeUsers();
    }

    private initializeUsers() {
        const existingUsers = localStorage.getItem(this.usersKey);
        if (!existingUsers) {
            const defaultUsers: User[] = [
                { username: 'admin', password: '123', role: 'admin', name: '' },
                { username: 'empleado', password: '123', role: 'employee', name: 'Juan (Emp)' }
            ];
            localStorage.setItem(this.usersKey, JSON.stringify(defaultUsers));
        } else {
            // No migration needed anymore; respect whatever name the user sets.
        }
    }

    getUsers(): User[] {
        const users = localStorage.getItem(this.usersKey);
        return users ? JSON.parse(users) : [];
    }

    addUser(user: User) {
        const users = this.getUsers();
        // Check if user already exists
        if (users.find(u => u.username === user.username)) {
            return false; // User exists
        }
        users.push(user);
        localStorage.setItem(this.usersKey, JSON.stringify(users));
        return true;
    }

    updateUser(originalUsername: string, updatedUser: User) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.username === originalUsername);
        if (index !== -1) {
            // Check if changing to a username that already exists (and is not self)
            if (updatedUser.username !== originalUsername && users.find(u => u.username === updatedUser.username)) {
                return false; // Target username already exists
            }
            users[index] = updatedUser;
            localStorage.setItem(this.usersKey, JSON.stringify(users));

            const current = this.currentUser();
            if (current && current.username === originalUsername) {
                const safeUser = { ...updatedUser };
                delete safeUser.password;
                this.currentUser.set(safeUser);
            }
            return true;
        }
        return false;
    }

    deleteUser(username: string) {
        const users = this.getUsers();
        const filteredUsers = users.filter(u => u.username !== username);
        localStorage.setItem(this.usersKey, JSON.stringify(filteredUsers));

        // Return true if a user was actually removed
        return users.length !== filteredUsers.length;
    }

    login(username: string, password: string): boolean {
        const users = this.getUsers();
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            // Create a safe user object without password to store in state
            const safeUser = { ...user };
            delete safeUser.password;

            this.currentUser.set(safeUser);

            if (user.role === 'admin' || user.role === 'administrator') {
                this.router.navigate(['/dashboard']);
            } else {
                this.router.navigate(['/inventory']);
            }
            return true;
        }
        return false;
    }

    logout() {
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }

    isLoggedIn() {
        return this.currentUser() !== null;
    }

    hasRole(allowedRoles: UserRole[]) {
        const user = this.currentUser();
        return user && allowedRoles.includes(user.role);
    }
}
