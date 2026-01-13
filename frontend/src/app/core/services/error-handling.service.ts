import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular/standalone';
import { Observable, timer, throwError } from 'rxjs';
import { mergeMap, retry } from 'rxjs/operators';

export interface AppError {
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
  retryable?: boolean;
}

export interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryCondition?: (error: any) => boolean;
}

@Injectable({ providedIn: 'root' })
export class ErrorHandlingService {
  private toastController = inject(ToastController);

  /**
   * Retry-Operator für HTTP-Requests
   */
  retryWithBackoff<T>(config: RetryConfig = {}) {
    const { 
      maxRetries = 3, 
      retryDelay = 1000,
      retryCondition = this.defaultRetryCondition 
    } = config;

    return retry({
      count: maxRetries,
      delay: (error, retryIndex) => {
        if (retryCondition(error)) {
          return timer(retryDelay * Math.pow(2, retryIndex));
        }
        return throwError(() => error);
      }
    });
  }

  private defaultRetryCondition = (error: any): boolean => {
    // Retry bei Netzwerkfehlern und 5xx Serverfehler
    return error.status === 0 || (error.status >= 500 && error.status < 600);
  };

  /**
   * Behandelt HTTP-Fehler und zeigt benutzerfreundliche Nachrichten
   */
  async handleHttpError(error: HttpErrorResponse, context?: string): Promise<AppError> {
    const appError: AppError = {
      message: this.getErrorMessage(error),
      code: error.status?.toString(),
      details: error.error,
      timestamp: new Date(),
      retryable: this.defaultRetryCondition(error)
    };

    // Log für Entwicklung
    console.error(`HTTP Error in ${context || 'Unknown'}:`, {
      status: error.status,
      message: error.message,
      error: error.error,
      url: error.url
    });

    // Benutzerfreundliche Toast-Nachricht
    await this.showErrorToast(appError.message);

    return appError;
  }

  /**
   * Behandelt allgemeine Anwendungsfehler
   */
  async handleGenericError(error: any, context?: string): Promise<AppError> {
    const appError: AppError = {
      message: error.message || 'Ein unerwarteter Fehler ist aufgetreten',
      details: error,
      timestamp: new Date()
    };

    console.error(`Generic Error in ${context || 'Unknown'}:`, error);
    await this.showErrorToast(appError.message);

    return appError;
  }

  /**
   * Extrahiert benutzerfreundliche Fehlermeldung aus HTTP Error
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    // Server-seitige Fehlermeldungen
    if (error.error?.message) {
      return error.error.message;
    }

    if (error.error?.detail) {
      return error.error.detail;
    }

    // Standard HTTP-Status Nachrichten
    switch (error.status) {
      case 0:
        return 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.';
      case 400:
        return 'Ungültige Anfrage. Bitte prüfen Sie Ihre Eingaben.';
      case 401:
        return 'Nicht autorisiert. Bitte melden Sie sich erneut an.';
      case 403:
        return 'Zugriff verweigert. Sie haben keine Berechtigung für diese Aktion.';
      case 404:
        return 'Die angeforderte Ressource wurde nicht gefunden.';
      case 408:
        return 'Anfrage-Timeout. Bitte versuchen Sie es erneut.';
      case 422:
        return 'Validierungsfehler. Bitte prüfen Sie Ihre Eingaben.';
      case 429:
        return 'Zu viele Anfragen. Bitte warten Sie einen Moment.';
      case 500:
        return 'Interner Serverfehler. Bitte versuchen Sie es später erneut.';
      case 502:
        return 'Server nicht erreichbar. Bitte versuchen Sie es später erneut.';
      case 503:
        return 'Service temporär nicht verfügbar. Bitte versuchen Sie es später erneut.';
      default:
        return `Ein Fehler ist aufgetreten (${error.status}). Bitte versuchen Sie es erneut.`;
    }
  }

  /**
   * Zeigt Error Toast
   */
  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 5000,
      position: 'top',
      color: 'danger',
      buttons: [{
        text: 'Schließen',
        role: 'cancel'
      }]
    });

    await toast.present();
  }

  /**
   * Zeigt Success Toast
   */
  async showSuccessToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'success',
      buttons: [{
        text: 'OK',
        role: 'cancel'
      }]
    });

    await toast.present();
  }

  /**
   * Zeigt Warning Toast
   */
  async showWarningToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 4000,
      position: 'top',
      color: 'warning',
      buttons: [{
        text: 'OK',
        role: 'cancel'
      }]
    });

    await toast.present();
  }
}
