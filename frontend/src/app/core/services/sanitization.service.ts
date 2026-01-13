import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl, SafeScript, SafeStyle, SafeUrl } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class SanitizationService {
  
  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Bereinigt HTML-Input für sichere Anzeige
   * @param input HTML-String
   * @returns Bereinigter HTML-String
   */
  sanitizeHtml(input: string): SafeHtml {
    return this.sanitizer.sanitize(1, input) || '';
  }

  /**
   * Bereinigt Style-Input
   * @param input Style-String
   * @returns Bereinigter Style
   */
  sanitizeStyle(input: string): SafeStyle {
    return this.sanitizer.sanitize(3, input) || '';
  }

  /**
   * Bereinigt URL-Input
   * @param input URL-String
   * @returns Bereinigte URL
   */
  sanitizeUrl(input: string): SafeUrl {
    return this.sanitizer.sanitize(4, input) || '';
  }

  /**
   * Bereinigt Resource URL (für iframes, etc.)
   * @param input Resource URL-String
   * @returns Bereinigte Resource URL
   */
  sanitizeResourceUrl(input: string): SafeResourceUrl {
    return this.sanitizer.sanitize(5, input) || '';
  }

  /**
   * Entfernt gefährliche Zeichen aus Benutzereingaben
   * @param input Benutzereingabe
   * @returns Bereinigter String
   */
  sanitizeUserInput(input: string): string {
    if (!input) return '';
    
    return input
      .replace(/[<>]/g, '') // HTML-Tags entfernen
      .replace(/javascript:/gi, '') // JavaScript-URLs entfernen
      .replace(/on\w+=/gi, '') // Event-Handler entfernen
      .trim();
  }

  /**
   * Validiert E-Mail-Adresse
   * @param email E-Mail-String
   * @returns true wenn gültig
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validiert URL
   * @param url URL-String
   * @returns true wenn gültig
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Escaped HTML-Entities in normalem Text
   * @param text Eingabetext
   * @returns Escaped Text
   */
  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
