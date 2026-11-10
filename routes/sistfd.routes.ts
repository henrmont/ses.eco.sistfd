import { Routes } from '@angular/router';
import { Professionals } from '../enums/professionals';
import { sistfdGuard } from '../guards/sistfd.guard';

export const sistfdRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./../pages/index-page/index.page').then(m => m.IndexPage)
  },
  {
    path: 'usuarios',
    loadComponent: () => import('./../pages/users-page/users.page').then(m => m.UsersPage),
    canActivate: [sistfdGuard],
    data: { 
      permission: 'sistfd/usuário listar', 
      types: [Professionals.ADMINISTRADOR] 
    }
  },
  {
    path: 'regras',
    loadComponent: () => import('./../pages/roles-page/roles.page').then(m => m.RolesPage),
    canActivate: [sistfdGuard],
    data: { 
      permission: 'sistfd/regra listar', 
      types: [Professionals.ADMINISTRADOR] 
    }
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];