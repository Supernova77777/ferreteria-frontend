import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

export type UserRole = 'admin' | 'administrator' | 'employee' | null;

export interface User {
    id?: number;
    username: string;
    password?: string;
    role: UserRole;
    name: string;
    phone?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    currentUser = signal<User | null>(null);
    private apiUrl = 'http://localhost:8081/api/auth';

    constructor(private router: Router, private http: HttpClient) {
        this.initializeUserSession();
    }

    private initializeUserSession() {
        const storedUser = localStorage.getItem('ferreteria_current_user');
        if (storedUser) {
            try {
                this.currentUser.set(JSON.parse(storedUser));
            } catch (e) {
                console.error("Error parsing stored user");
            }
        }
    }

    async getUsers(): Promise<User[]> {
        try {
            return await firstValueFrom(this.http.get<User[]>(`${this.apiUrl}/users`));
        } catch (error) {
            console.error('Error fetching users', error);
            return [];
        }
    }

    async addUser(user: User) {
        try {
            await firstValueFrom(this.http.post<User>(`${this.apiUrl}/users`, user));
            return true;
        } catch (error: any) {
            console.error('Error adding user', error);
            if (error.error && error.error.message) {
                alert('Error: ' + error.error.message);
            }
            return false;
        }
    }

    async updateUser(id: number | undefined, updatedUser: User) {
        if (!id) return false;
        const result = await firstValueFrom(this.http.put<User>(`${this.apiUrl}/users/${id}`, updatedUser));

        const current = this.currentUser();
        if (current && current.id === id) {
            const safeUser = { ...result };
            delete safeUser.password;
            this.currentUser.set(safeUser);
            localStorage.setItem('ferreteria_current_user', JSON.stringify(safeUser));
        }
        return true;
    }

    async deleteUser(id: number | undefined) {
        if (!id) return false;
        await firstValueFrom(this.http.delete(`${this.apiUrl}/users/${id}`));
        return true;
    }

    async login(username: string, password: string): Promise<boolean> {
        const user = await firstValueFrom(this.http.post<User>(`${this.apiUrl}/login`, { username, password }));

        this.currentUser.set(user);
        localStorage.setItem('ferreteria_current_user', JSON.stringify(user));

        if (user.role === 'admin' || user.role === 'administrator') {
            this.router.navigate(['/dashboard']);
        } else {
            this.router.navigate(['/inventory']);
        }
        return true;
    }

    async logout() {
        const current = this.currentUser();
        if (current && current.id) {
            try {
                await firstValueFrom(this.http.post(`${this.apiUrl}/logout/${current.id}`, {}));
            } catch (e) {
                console.error("Error logging out from backend", e);
            }
        }
        this.currentUser.set(null);
        localStorage.removeItem('ferreteria_current_user');
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
