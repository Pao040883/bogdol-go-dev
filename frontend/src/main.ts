import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { performanceInterceptor } from './app/core/interceptors/performance.interceptor';
import { provideAppInitializer } from '@angular/core';
import { appInitializer } from './app/core/interceptors/init-auth';
import { EnvironmentService } from './app/core/services/environment.service';
import { IntranetApiService } from './app/services/intranet-api.service';
import { IntranetWebSocketService } from './app/services/intranet-websocket.service';

// Environment Service Initializer
const environmentInitializer = () => {
  const envService = new EnvironmentService();
  envService.initialize();
  return Promise.resolve();
};

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor, performanceInterceptor])),
    provideAppInitializer(appInitializer),
    provideAppInitializer(environmentInitializer),
    // Intranet Services
    IntranetApiService,
    IntranetWebSocketService,
  ],
});
