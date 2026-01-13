import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard, permissionGuard, featureGuard, anyAppGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./login/reset-password/reset-password.page').then(
        (m) => m.ResetPasswordPage
      ),
  },
  {
    path: 'set-password/:uid/:token',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./login/set-password/set-password.page').then(
        (m) => m.SetPasswordPage
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.page').then(
            (m) => m.DashboardPage
          ),
      },
      {
        path: 'apps',
        canActivate: [anyAppGuard],
        loadComponent: () =>
          import('./pages/apps/apps.page').then((m) => m.AppsPage),
      },
      {
        path: 'apps/sofo',
        canActivate: [featureGuard('can_view_sofo')],
        loadComponent: () =>
          import('./pages/apps/sofo/sofo.page').then((m) => m.SofoPage),
      },
      {
        path: 'apps/sofortmeldung',
        canActivate: [featureGuard('can_view_sofo')],
        loadComponent: () => 
          import('./features/sofortmeldung-form.component').then(m => m.SofortmeldungFormComponent),
      },
      {
        path: 'apps/sofortmeldung-dashboard',
        canActivate: [featureGuard('can_view_sofo')],
        loadComponent: () => 
          import('./features/sofortmeldung-dashboard.component').then(m => m.SofortmeldungDashboardComponent),
      },
      {
        path: 'apps/work-tickets',
        canActivate: [featureGuard('can_view_work_tickets')],
        loadComponent: () =>
          import('./pages/apps/work-tickets/work-tickets.page').then(
            (m) => m.WorkTicketsPage
          ),
      },
      {
        path: 'apps/work-tickets/create',
        canActivate: [featureGuard('can_view_work_tickets')],
        loadComponent: () =>
          import('./pages/apps/work-tickets/work-ticket-form/work-ticket-form.page').then(
            (m) => m.WorkTicketFormPage
          ),
      },
      {
        path: 'apps/work-tickets/templates',
        canActivate: [featureGuard('can_view_work_tickets')],
        loadComponent: () =>
          import('./pages/apps/work-tickets/templates/work-ticket-templates.page').then(
            (m) => m.WorkTicketTemplatesPage
          ),
      },
      {
        path: 'apps/work-tickets/templates/create',
        canActivate: [featureGuard('can_view_work_tickets')],
        loadComponent: () =>
          import('./pages/apps/work-tickets/templates/work-ticket-template-form.page').then(
            (m) => m.WorkTicketTemplateFormPage
          ),
      },
      {
        path: 'apps/work-tickets/templates/:id',
        canActivate: [featureGuard('can_view_work_tickets')],
        loadComponent: () =>
          import('./pages/apps/work-tickets/templates/work-ticket-template-form.page').then(
            (m) => m.WorkTicketTemplateFormPage
          ),
      },
      {
        path: 'apps/work-tickets/:id',
        canActivate: [featureGuard('can_view_work_tickets')],
        loadComponent: () =>
          import('./pages/apps/work-tickets/work-ticket-form/work-ticket-form.page').then(
            (m) => m.WorkTicketFormPage
          ),
      },
      {
        path: 'apps/workorders',
        canActivate: [featureGuard('can_view_workorders')],
        loadComponent: () =>
          import('./pages/apps/workorders/workorders.page').then(
            (m) => m.WorkordersPage
          ),
      },
      {
        path: 'apps/workorders/checklist',
        canActivate: [featureGuard('can_view_workorders')],
        loadComponent: () =>
          import('./pages/apps/workorders/checklist/checklist.page').then(
            (m) => m.ChecklistPage
          ),
      },
      {
        path: 'apps/contacts-list',
        canActivate: [featureGuard('can_view_contacts')],
        loadComponent: () =>
          import('./pages/apps/contacts-list/contacts-list.page').then(
            (m) => m.ContactsListPage
          ),
      },
      {
        path: 'apps/absences',
        canActivate: [featureGuard('can_view_absences')],
        loadComponent: () =>
          import('./pages/apps/absences/absences.page').then(
            (m) => m.AbsencesPage
          ),
      },
      {
        path: 'apps/absences/approval',
        canActivate: [featureGuard('can_view_absences')],
        loadComponent: () =>
          import('./pages/apps/absences/approval/absences.approval.page').then(
            (m) => m.AbsencesApprovalPage
          ),
      },
      {
        path: 'hr/dashboard',
        canActivate: [permissionGuard],
        data: { permissions: ['hr_management'] },
        loadComponent: () =>
          import('./pages/hr/hr-dashboard.page').then(
            (m) => m.HRDashboardPage
          ),
      },

      {
        path: 'external-links',
        canActivate: [featureGuard('can_view_external_links')],
        loadComponent: () =>
          import('./pages/external-links/external-links.page').then(
            (m) => m.ExternalLinksPage
          ),
      },
      {
        path: 'auswertungen',
        canActivate: [featureGuard('can_view_analytics')],
        loadComponent: () =>
          import('./pages/evaluations/evaluations.page').then(
            (m) => m.EvaluationsPage
          ),
      },
      {
        path: 'auswertungen/blink-nutzung',
        canActivate: [featureGuard('can_view_analytics')],
        loadChildren: () =>
          import('./pages/auswertungen/auswertungen.routes').then(
            (m) => m.auswertungenRoutes
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/admin.page').then((m) => m.AdminPage),
      },
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'admin/permissions/:userId',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/permissions/permission-matrix.page').then((m) => m.PermissionMatrixPage),
      },
      {
        path: 'admin/permission-config',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/permission-config/permission-config.page').then((m) => m.PermissionConfigPage),
      },
      {
        path: 'admin/departments',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/departments/departments.page').then((m) => m.DepartmentsPage),
      },
      {
        path: 'admin/companies',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/companies/companies.page').then((m) => m.CompaniesPage),
      },
      {
        path: 'admin/roles',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'admin/absence-types',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/absence-types/absence-types.page').then((m) => m.AbsenceTypesPage),
      },
      {
        path: 'admin/specialties',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/specialties/specialties.page').then((m) => m.SpecialtiesPage),
      },
      {
        path: 'admin/member-specialties/:memberId',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/member-specialties/member-specialties.page').then((m) => m.MemberSpecialtiesPage),
      },
      {
        path: 'admin/search-analytics',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/search-analytics/search-analytics.page').then((m) => m.SearchAnalyticsPage),
      },
      // Chat (Hauptnavigation)
      {
        path: 'chat',
        canActivate: [featureGuard('can_view_chat')],
        loadComponent: () =>
          import('./pages/intranet/chat-list/chat-list.page').then((m) => m.ChatListPage),
      },
      {
        path: 'chat/:conversationId',
        canActivate: [featureGuard('can_view_chat')],
        loadComponent: () =>
          import('./components/chat/chat.component').then((m) => m.ChatComponent),
      },
      // Organigramm (jetzt bei Apps)
      {
        path: 'apps/organigramm',
        canActivate: [featureGuard('can_view_organigramm')],
        loadComponent: () =>
          import('./pages/intranet/organigramm/organigramm.page').then((m) => m.OrganigrammPage),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  { path: '**', redirectTo: 'login' },
  // {
  //   path: 'blink-usage',
  //   loadComponent: () => import('./pages/evaluations/blink-usage/blink-usage.page').then( m => m.BlinkUsagePage)
  // },
];
