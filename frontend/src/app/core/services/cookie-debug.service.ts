import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CookieDebugService {

  /**
   * Debug: Alle verfügbaren Cookies ausgeben
   */
  logAllCookies(): void {
    console.group('🍪 Cookie Debug');
    console.log('document.cookie:', document.cookie);
    
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);
    
    console.log('Parsed cookies:', cookies);
    console.log('Refresh token present:', 'refresh_token' in cookies);
    console.groupEnd();
  }

  /**
   * Debug: Prüft ob spezifischer Cookie vorhanden ist
   */
  hasCookie(name: string): boolean {
    const result = document.cookie
      .split(';')
      .some(cookie => cookie.trim().startsWith(`${name}=`));
    
    console.log(`Cookie '${name}' present:`, result);
    return result;
  }

  /**
   * Debug: Cookie-Wert lesen (nur für Debug, normalerweise HTTP-only)
   */
  getCookieValue(name: string): string | null {
    const value = document.cookie
      .split(';')
      .find(cookie => cookie.trim().startsWith(`${name}=`))
      ?.split('=')[1];
    
    console.log(`Cookie '${name}' value:`, value || 'not found');
    return value || null;
  }

  /**
   * Debug: Simuliert Cookie-Check beim Page Load
   */
  debugPageLoadCookies(): void {
    console.group('🔄 Page Load Cookie Debug');
    console.log('Page loaded at:', new Date().toISOString());
    this.logAllCookies();
    console.groupEnd();
  }
}
