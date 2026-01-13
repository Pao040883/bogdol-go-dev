import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Service für dynamische Environment-Konfiguration
 * Ermöglicht das Ändern der API-URL zur Laufzeit
 */
@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private _apiUrl = signal(environment.apiUrl);
  private _isProduction = signal(environment.production);
  private _isConnected = signal(false);
  private _currentServer = signal('localhost');

  /** Readonly Signal für API URL */
  readonly apiUrl = this._apiUrl.asReadonly();

  /** Readonly Signal für Production Flag */
  readonly isProduction = this._isProduction.asReadonly();

  /** Readonly Signal für Connection Status */
  readonly isConnected = this._isConnected.asReadonly();

  /** Readonly Signal für Current Server */
  readonly currentServer = this._currentServer.asReadonly();

  /**
   * Verfügbare Server-Konfigurationen
   */
  readonly serverConfigs = [
    { name: 'Lokal (Development)', url: 'http://127.0.0.1:8000/api', active: true },
    // Andere Server temporär deaktiviert, um Verbindungsfehler zu vermeiden
    // { name: 'Server 1 (10.1.180.22)', url: 'http://10.1.180.22:8000/api', active: false },
    // { name: 'Server 2 (10.1.201.67)', url: 'http://10.1.201.67:8000/api', active: false },
    // { name: 'Server 3 (10.1.201.134)', url: 'http://10.1.201.134:8000/api', active: false },
    // { name: 'Server 4 (192.168.178.113)', url: 'http://192.168.178.113:8000/api', active: false }
  ];

  /**
   * Setzt eine neue API-URL
   * @param url Neue API-URL
   */
  setApiUrl(url: string): void {
    this._apiUrl.set(url);
    
    // In LocalStorage speichern für Persistierung
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('api_url_override', url);
    }
    
    console.log(`API URL geändert zu: ${url}`);
  }

  /**
   * Setzt die API-URL zurück auf Standard
   */
  resetApiUrl(): void {
    this._apiUrl.set(environment.apiUrl);
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('api_url_override');
    }
    
    console.log(`API URL zurückgesetzt zu: ${environment.apiUrl}`);
  }

  /**
   * Lädt gespeicherte API-URL aus LocalStorage
   */
  loadSavedApiUrl(): void {
    if (typeof localStorage !== 'undefined') {
      const savedUrl = localStorage.getItem('api_url_override');
      if (savedUrl) {
        this._apiUrl.set(savedUrl);
        console.log(`Gespeicherte API URL geladen: ${savedUrl}`);
      }
    }
  }

  /**
   * Testet die aktuelle API-Verbindung
   */
  async testConnection(): Promise<boolean> {
    const currentUrl = this._apiUrl();
    const isConnected = await this.testApiConnection(currentUrl);
    this._isConnected.set(isConnected);
    
    // Server-Name aktualisieren
    const serverConfig = this.serverConfigs.find(config => config.url === currentUrl);
    if (serverConfig) {
      this._currentServer.set(serverConfig.name);
    }
    
    return isConnected;
  }

  /**
   * Testet die Erreichbarkeit einer API-URL
   * @param url API-URL zum Testen
   * @returns Promise<boolean> True wenn erreichbar
   */
  async testApiConnection(url: string): Promise<boolean> {
    try {
      const testUrl = url.replace('/api', '/api/'); // Stelle sicher, dass /api/ am Ende steht
      const response = await fetch(testUrl, {
        method: 'OPTIONS',
        mode: 'cors'
      });
      return response.ok;
    } catch (error) {
      console.warn(`API-Verbindung zu ${url} fehlgeschlagen:`, error);
      return false;
    }
  }

  /**
   * Sucht automatisch nach einem erreichbaren Server
   * @returns Promise<string | null> URL des ersten erreichbaren Servers oder null
   */
  async findAvailableServer(): Promise<string | null> {
    for (const config of this.serverConfigs) {
      const isReachable = await this.testApiConnection(config.url);
      if (isReachable) {
        console.log(`Erreichbarer Server gefunden: ${config.name} (${config.url})`);
        return config.url;
      }
    }
    
    console.warn('Kein erreichbarer Server gefunden');
    return null;
  }

  /**
   * Automatische Server-Erkennung und Umschaltung
   */
  async autoConfigureServer(): Promise<void> {
    // Erst versuchen, aktuellen Server zu testen
    const currentUrl = this._apiUrl();
    const currentReachable = await this.testApiConnection(currentUrl);
    
    if (currentReachable) {
      console.log(`Aktueller Server ${currentUrl} ist erreichbar`);
      return;
    }

    // Falls aktueller Server nicht erreichbar, nach alternativem suchen
    console.log(`Aktueller Server ${currentUrl} nicht erreichbar, suche Alternative...`);
    const availableUrl = await this.findAvailableServer();
    
    if (availableUrl && availableUrl !== currentUrl) {
      this.setApiUrl(availableUrl);
    }
  }

  /**
   * Initialisierung des Services
   */
  initialize(): void {
    this.loadSavedApiUrl();
    
    // Auto-Konfiguration temporär deaktiviert, um Verbindungsfehler zu vermeiden
    // if (!this._isProduction()) {
    //   this.autoConfigureServer();
    // }
    
    console.log(`Environment Service initialisiert mit API URL: ${this._apiUrl()}`);
  }
}
