import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { NavigationComponent } from './navigation.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { JwtUtilsService } from 'src/app/core/services/jwt-utils.service';

describe('NavigationComponent', () => {
  let component: NavigationComponent;
  let fixture: ComponentFixture<NavigationComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockJwtUtils: jasmine.SpyObj<JwtUtilsService>;

  beforeEach(waitForAsync(() => {
    // Mock AuthService
    mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      accessToken: signal('mock-token')
    });

    // Mock JwtUtilsService
    mockJwtUtils = jasmine.createSpyObj('JwtUtilsService', ['getUserFromToken']);
    mockJwtUtils.getUserFromToken.and.returnValue({ 
      id: 1, 
      username: 'testuser', 
      is_superuser: false 
    });

    TestBed.configureTestingModule({
      imports: [NavigationComponent],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtUtilsService, useValue: mockJwtUtils }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should detect non-superuser correctly', () => {
    expect(component.isSuperuser()).toBeFalse();
  });

  it('should detect superuser correctly', () => {
    mockJwtUtils.getUserFromToken.and.returnValue({ 
      id: 1, 
      username: 'admin', 
      is_superuser: true 
    });
    
    // Component neu erstellen um computed neu zu evaluieren
    fixture = TestBed.createComponent(NavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    
    expect(component.isSuperuser()).toBeTrue();
  });

  it('should handle missing token', () => {
    // Mock Service mit null Token erstellen
    const mockAuthServiceNoToken = jasmine.createSpyObj('AuthService', ['logout'], {
      accessToken: signal(null)
    });
    
    TestBed.overrideProvider(AuthService, { useValue: mockAuthServiceNoToken });
    
    fixture = TestBed.createComponent(NavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    
    expect(component.isSuperuser()).toBeFalse();
  });

  it('should call logout on auth service', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });
});
