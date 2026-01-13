import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { JwtUtilsService } from '../../core/services/jwt-utils.service';

/**
 * Strukturelle Direktive für berechtigungsbasierte Anzeige
 * Verwendung: *appPermission="'admin'"
 */
@Directive({
  selector: '[appPermission]',
  standalone: true
})
export class PermissionDirective implements OnInit, OnDestroy {
  @Input('appPermission') requiredPermission!: string;
  
  private destroy$ = new Subject<void>();
  private authService = inject(AuthService);
  private jwtUtils = inject(JwtUtilsService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  ngOnInit() {
    // Effect für reaktive Updates bei Token-Änderungen
    effect(() => {
      const token = this.authService.accessToken();
      this.updateView();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView() {
    if (this.hasPermission()) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }

  private hasPermission(): boolean {
    const token = this.authService.accessToken();
    if (!token) return false;

    const userInfo = this.jwtUtils.getUserFromToken(token);
    if (!userInfo) return false;

    switch (this.requiredPermission) {
      case 'admin':
      case 'superuser':
        return !!userInfo.is_superuser;
      case 'user':
        return !!userInfo.id;
      default:
        return false;
    }
  }
}
