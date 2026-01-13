import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { JwtUtilsService } from '../services/jwt-utils.service';
import { OrganizationService } from '../services/organization.service';
import { UserFeaturesService } from '../../services/user-features.service';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

/**
 * Guard für Admin-Routen
 * Prüft ob Benutzer Superuser-Berechtigung hat
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const jwtUtils = inject(JwtUtilsService);
  const router = inject(Router);

  // Erst prüfen ob überhaupt eingeloggt
  if (!authService.isLoggedIn) {
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }

  // Token holen und Superuser-Status prüfen
  const token = authService.accessToken();
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  const userInfo = jwtUtils.getUserFromToken(token);
  if (userInfo?.is_superuser) {
    return true;
  }

  // Zugriff verweigert - zurück zur Home-Seite
  router.navigate(['/home']);
  return false;
};

/**
 * Permission Guard für spezifische Berechtigungen
 * Kann erweitert werden für rollenbasierte Zugriffskontrolle
 */
export const permissionGuard = (requiredPermission: string): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const jwtUtils = inject(JwtUtilsService);
    const router = inject(Router);

    if (!authService.isLoggedIn) {
      router.navigate(['/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    const token = authService.accessToken();
    if (!token) {
      router.navigate(['/login']);
      return false;
    }

    const userInfo = jwtUtils.getUserFromToken(token);
    
    // Superuser hat alle Berechtigungen
    if (userInfo?.is_superuser) {
      return true;
    }

    // Helper-Funktionen
    const hasPermission = (user: any, permission: string): boolean => {
      return user?.user_permissions?.includes(permission) || 
             user?.groups?.some((group: any) => group.permissions?.includes(permission));
    };

    const hasGroup = (user: any, groupName: string): boolean => {
      return user?.groups?.includes(groupName) || false;
    };

    const hasDepartmentRole = (user: any, roleCode: string): boolean => {
      return user?.department_roles?.some((role: any) => role.role_code === roleCode) || false;
    };

    const isTeamLead = (user: any): boolean => {
      return user?.groups?.some((group: any) => group.name === 'team_leads') ||
             user?.is_team_lead === true ||
             hasDepartmentRole(user, 'TL') ||
             hasDepartmentRole(user, 'SM');
    };

    const isHR = (user: any): boolean => {
      return hasGroup(user, 'HR');
    };

    const isFakturMA = (user: any): boolean => {
      // TODO: Muss über MemberSpecialty gecheckt werden (Specialty "Fakturierung")
      // Aktuell: Check auf Gruppe oder Department
      return hasGroup(user, 'Faktur');
    };

    const isBereichsleiter = (user: any): boolean => {
      return user?.is_bereichsleiter || hasDepartmentRole(user, 'BL');
    };

    const isAbteilungsleiter = (user: any): boolean => {
      return user?.is_abteilungsleiter || hasDepartmentRole(user, 'AL');
    };

    // Granulare Berechtigungsprüfung
    switch (requiredPermission) {
      case 'admin':
        return !!userInfo?.is_superuser;
      
      case 'user_management':
        return !!userInfo?.is_superuser || hasPermission(userInfo, 'manage_users');
      
      case 'absence_approval':
        return !!userInfo?.is_superuser || 
               hasPermission(userInfo, 'approve_absences') ||
               isTeamLead(userInfo) ||
               isBereichsleiter(userInfo) ||
               isAbteilungsleiter(userInfo);
      
      case 'absence_hr_processing':
        return !!userInfo?.is_superuser || isHR(userInfo);
      
      case 'sofortmeldung_create':
        return true; // Alle eingeloggten User können Meldungen erstellen
      
      case 'sofortmeldung_manage':
        return !!userInfo?.is_superuser || hasPermission(userInfo, 'manage_sofortmeldung');
      
      case 'sofortmeldung_cancel_approve':
        return !!userInfo?.is_superuser || isHR(userInfo);
      
      case 'workorder_create':
        return true; // Alle können Arbeitsscheine erstellen
      
      case 'workorder_process':
        return !!userInfo?.is_superuser || isFakturMA(userInfo);
      
      case 'workorder_cancel':
        return !!userInfo?.is_superuser || isFakturMA(userInfo);
      
      case 'workorder_download':
        return !!userInfo?.is_superuser || isFakturMA(userInfo);
      
      case 'workorder_manage_assignments':
        return !!userInfo?.is_superuser || isFakturMA(userInfo);
      
      case 'hr_assignment_manage':
        return !!userInfo?.is_superuser || isHR(userInfo);
      
      case 'reports_view':
        return !!userInfo?.is_superuser || hasPermission(userInfo, 'view_reports');
      
      default:
        return false;
    }
  };
};

/**
 * Specialty Guard - Prüft ob User einen bestimmten Fachbereich hat
 * Usage: canActivate: [specialtyGuard('FIN-FAK')]
 */
export const specialtyGuard = (requiredSpecialty: string): CanActivateFn => {
  return async (route, state) => {
    const authService = inject(AuthService);
    const organizationService = inject(OrganizationService);
    const router = inject(Router);
    const toastController = inject(ToastController);

    if (!authService.isLoggedIn) {
      router.navigate(['/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    try {
      const hasAccess = await firstValueFrom(
        organizationService.hasSpecialty(requiredSpecialty)
      );

      if (!hasAccess) {
        const toast = await toastController.create({
          message: `Zugriff verweigert: Fachbereich "${requiredSpecialty}" erforderlich`,
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
        router.navigate(['/']);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking specialty permission:', error);
      const toast = await toastController.create({
        message: 'Fehler bei der Berechtigungsprüfung',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
      router.navigate(['/']);
      return false;
    }
  };
};

/**
 * Full Access Guard - Prüft ob User GF/Superuser ist
 */
export const fullAccessGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const organizationService = inject(OrganizationService);
  const router = inject(Router);
  const toastController = inject(ToastController);

  if (!authService.isLoggedIn) {
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }

  try {
    const hasAccess = await firstValueFrom(
      organizationService.hasFullAccess()
    );

    if (!hasAccess) {
      const toast = await toastController.create({
        message: 'Zugriff verweigert: Administrator-Rechte erforderlich',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
      router.navigate(['/']);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking full access permission:', error);
    const toast = await toastController.create({
      message: 'Fehler bei der Berechtigungsprüfung',
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
    router.navigate(['/']);
    return false;
  }
};

/**
 * Feature Guard - Prüft ob User ein bestimmtes Feature sehen darf
 * Usage: canActivate: [featureGuard('can_view_sofo')]
 */
export const featureGuard = (requiredFeature: string): CanActivateFn => {
  return async (route, state) => {
    const authService = inject(AuthService);
    const userFeaturesService = inject(UserFeaturesService);
    const router = inject(Router);
    const toastController = inject(ToastController);

    if (!authService.isLoggedIn) {
      router.navigate(['/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    try {
      // Features laden falls noch nicht geladen
      await firstValueFrom(userFeaturesService.loadFeatures());
      
      const features = userFeaturesService.features();
      const hasFeature = features?.[requiredFeature as keyof typeof features] ?? false;

      if (!hasFeature) {
        const toast = await toastController.create({
          message: 'Zugriff verweigert: Fehlende Berechtigung',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
        router.navigate(['/dashboard']);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking feature permission:', error);
      const toast = await toastController.create({
        message: 'Fehler bei der Berechtigungsprüfung',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
      router.navigate(['/dashboard']);
      return false;
    }
  };
};

/**
 * Any App Guard - Prüft ob User mindestens eine App sehen darf
 * Usage: canActivate: [anyAppGuard]
 */
export const anyAppGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const userFeaturesService = inject(UserFeaturesService);
  const router = inject(Router);
  const toastController = inject(ToastController);

  if (!authService.isLoggedIn) {
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }

  try {
    // Features laden falls noch nicht geladen
    await firstValueFrom(userFeaturesService.loadFeatures());
    
    const features = userFeaturesService.features();
    
    // Prüfe ob mindestens eine App berechtigt ist
    const hasAnyApp = 
      features?.can_view_sofo ||
      features?.can_view_workorders ||
      features?.can_view_work_tickets ||
      features?.can_view_contacts ||
      features?.can_view_absences ||
      features?.can_view_organigramm;

    if (!hasAnyApp) {
      const toast = await toastController.create({
        message: 'Zugriff verweigert: Keine App-Berechtigungen',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
      router.navigate(['/dashboard']);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking app permissions:', error);
    const toast = await toastController.create({
      message: 'Fehler bei der Berechtigungsprüfung',
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
    router.navigate(['/dashboard']);
    return false;
  }
};

