import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { tap, finalize } from 'rxjs/operators';
import { PerformanceService } from '../services/performance.service';
import { ErrorHandlingService } from '../services/error-handling.service';

export const performanceInterceptor: HttpInterceptorFn = (req, next) => {
  const performanceService = inject(PerformanceService);
  
  const startTime = performance.now();
  const operationName = getOperationName(req);

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        const duration = performance.now() - startTime;
        
        // Einfaches Console-Logging erstmal
        console.log(`HTTP ${req.method} ${req.url}: ${duration}ms`);

        // Warnung bei langsamen Requests
        if (duration > 3000) {
          console.warn(`Slow HTTP request detected: ${req.method} ${req.url} took ${duration}ms`);
        }
      }
    }),
    
    finalize(() => {
      const duration = performance.now() - startTime;
      console.log(`Operation ${operationName} completed in ${duration}ms`);
    })
  );
};

function getOperationName(req: HttpRequest<any>): string {
  const url = req.url;
  const method = req.method;
  
  // Extrahiere Endpunkt-Namen für bessere Metriken
  if (url.includes('/absences/')) return `${method.toLowerCase()}_absence`;
  if (url.includes('/sofortmeldungen/')) return `${method.toLowerCase()}_sofortmeldung`;
  if (url.includes('/auth/')) return `${method.toLowerCase()}_auth`;
  
  return `${method.toLowerCase()}_http_request`;
}
