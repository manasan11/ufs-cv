import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'cvs' },
  {
    path: 'cvs',
    loadComponent: () =>
      import('./features/cv-list/cv-list').then((m) => m.CvListComponent),
    title: 'CVs',
  },
  {
    path: 'cvs/new',
    loadComponent: () =>
      import('./features/cv-form/cv-form').then((m) => m.CvFormComponent),
    title: 'New CV',
  },
  {
    path: 'cvs/:id/edit',
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
  { path: '**', redirectTo: 'cvs' },
];
