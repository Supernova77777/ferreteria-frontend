import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';
import { Inventory } from './pages/inventory/inventory';
import { Pos } from './pages/pos/pos';
import { Login } from './pages/login/login';
import { History } from './pages/history/history';
import { Users } from './pages/users/users';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'inventory', component: Inventory, canActivate: [authGuard] },
  { path: 'pos', component: Pos, canActivate: [authGuard] },
  { path: 'history', component: History, canActivate: [authGuard] },
  { path: 'users', component: Users, canActivate: [authGuard] },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
