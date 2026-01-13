import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const auswertungenRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./auswertungen.component').then(m => m.AuswertungenComponent),
    canActivate: [authGuard],
    title: 'Auswertungen'
  }
];
