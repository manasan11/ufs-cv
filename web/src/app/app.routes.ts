import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'cvs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/cv-list/cv-list').then((m) => m.CvListComponent),
    title: 'CVs',
  },
  {
    path: 'cvs/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/cv-form/cv-form').then((m) => m.CvFormComponent),
    title: 'New CV',
  },
  {
    path: 'cvs/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/cv-form/cv-form').then((m) => m.CvFormComponent),
    title: 'Edit CV',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginComponent),
    title: 'Sign in',
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register').then((m) => m.RegisterComponent),
    title: 'Create account',
  },
  { path: '**', redirectTo: 'login' },
];
