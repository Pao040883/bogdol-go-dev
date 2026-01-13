import { Injectable } from '@angular/core';

export interface DepartmentRolePayload {
  department_id: number;
  department_code: string;
  role_id: number;
  role_code: string;
  hierarchy_level: number;
  is_primary: boolean;
}

export interface JwtPayload {
  exp?: number;
  iat?: number;
  user_id?: number;
  username?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
  groups?: string[];  // ✅ NEW: Groups aus Backend
  department_roles?: DepartmentRolePayload[];  // ✅ NEW: Department-Rollen
  is_bereichsleiter?: boolean;  // ✅ NEW: BL-Rolle
  is_abteilungsleiter?: boolean;  // ✅ NEW: AL-Rolle
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class JwtUtilsService {
  
  /**
   * Sicher JWT Token dekodieren mit Validierung
   * @param jwt JWT Token als String
   * @returns Dekodierte Payload oder null bei Fehlern
   */
  decodeJwtPayload<T extends JwtPayload = JwtPayload>(jwt: string): T | null {
    try {
      if (!jwt || typeof jwt !== 'string') {
        console.warn('Invalid JWT: Token is empty or not a string');
        return null;
      }

      const parts = jwt.split('.');
      if (parts.length !== 3) {
        console.warn('Invalid JWT: Token does not have 3 parts');
        return null;
      }

      const [, payloadPart] = parts;
      if (!payloadPart) {
        console.warn('Invalid JWT: Payload part is empty');
        return null;
      }

      // Base64URL zu Base64 konvertieren
      const base64 = payloadPart
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      // Padding hinzufügen falls nötig
      const paddedBase64 = base64.padEnd(
        base64.length + (4 - (base64.length % 4)) % 4,
        '='
      );

      const decodedString = atob(paddedBase64);
      const payload = JSON.parse(decodedString) as T;

      // Grundlegende Validierung
      if (typeof payload !== 'object' || payload === null) {
        console.warn('Invalid JWT: Payload is not an object');
        return null;
      }

      return payload;
    } catch (error) {
      console.error('JWT decode error:', error);
      return null;
    }
  }

  /**
   * Prüft ob JWT Token abgelaufen ist
   * @param jwt JWT Token als String
   * @returns true wenn abgelaufen, false wenn gültig, null bei Fehlern
   */
  isTokenExpired(jwt: string): boolean | null {
    const payload = this.decodeJwtPayload(jwt);
    if (!payload || !payload.exp) {
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  }

  /**
   * Berechnet die verbleibende Zeit bis Token-Ablauf in Millisekunden
   * @param jwt JWT Token als String
   * @returns Verbleibende Zeit in ms oder null bei Fehlern
   */
  getTimeUntilExpiry(jwt: string): number | null {
    const payload = this.decodeJwtPayload(jwt);
    if (!payload || !payload.exp) {
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeLeft = (payload.exp - currentTime) * 1000;
    return Math.max(0, timeLeft);
  }

  /**
   * Extrahiert User-Informationen aus JWT
   * @param jwt JWT Token als String
   * @returns User-Informationen oder null
   */
  getUserFromToken(jwt: string): { 
    id?: number; 
    username?: string; 
    is_superuser?: boolean;
    is_staff?: boolean;
    groups?: string[];
    department_roles?: DepartmentRolePayload[];
    is_bereichsleiter?: boolean;
    is_abteilungsleiter?: boolean;
  } | null {
    const payload = this.decodeJwtPayload(jwt);
    if (!payload) {
      return null;
    }

    return {
      id: payload.user_id,
      username: payload.username,
      is_superuser: payload.is_superuser,
      is_staff: payload.is_staff,
      groups: payload.groups || [],
      department_roles: payload.department_roles || [],
      is_bereichsleiter: payload.is_bereichsleiter || false,
      is_abteilungsleiter: payload.is_abteilungsleiter || false
    };
  }

  /**
   * ✅ NEW: Prüft ob User in einer bestimmten Gruppe ist
   * @param jwt JWT Token
   * @param groupName Name der Gruppe (z.B. 'HR', 'Faktur')
   * @returns true wenn User in Gruppe ist
   */
  hasGroup(jwt: string, groupName: string): boolean {
    const payload = this.decodeJwtPayload(jwt);
    if (!payload || !payload.groups) {
      return false;
    }
    return payload.groups.includes(groupName);
  }

  /**
   * ✅ NEW: Prüft ob User eine bestimmte Rolle in irgendeinem Department hat
   * @param jwt JWT Token
   * @param roleCode Rollen-Code (z.B. 'GF', 'BL', 'AL', 'SM', 'MA')
   * @returns true wenn User diese Rolle hat
   */
  hasDepartmentRole(jwt: string, roleCode: string): boolean {
    const payload = this.decodeJwtPayload(jwt);
    if (!payload || !payload.department_roles) {
      return false;
    }
    return payload.department_roles.some(role => role.role_code === roleCode);
  }

  /**
   * ✅ NEW: Gibt alle Department-Rollen des Users zurück
   * @param jwt JWT Token
   * @returns Array von DepartmentRolePayload
   */
  getDepartmentRoles(jwt: string): DepartmentRolePayload[] {
    const payload = this.decodeJwtPayload(jwt);
    return payload?.department_roles || [];
  }

  /**
   * ✅ NEW: Prüft ob User Bereichsleiter ist
   * @param jwt JWT Token
   * @returns true wenn User BL-Rolle hat
   */
  isBereichsleiter(jwt: string): boolean {
    const payload = this.decodeJwtPayload(jwt);
    return payload?.is_bereichsleiter || false;
  }

  /**
   * ✅ NEW: Prüft ob User Abteilungsleiter ist
   * @param jwt JWT Token
   * @returns true wenn User AL-Rolle hat
   */
  isAbteilungsleiter(jwt: string): boolean {
    const payload = this.decodeJwtPayload(jwt);
    return payload?.is_abteilungsleiter || false;
  }

  /**
   * ✅ NEW: Prüft ob User Full Access hat (GF, Superuser, Staff)
   * @param jwt JWT Token
   * @returns true wenn User Admin/GF ist
   */
  hasFullAccess(jwt: string): boolean {
    const payload = this.decodeJwtPayload(jwt);
    if (!payload) return false;
    
    // Superuser oder Staff haben immer vollen Zugriff
    if (payload.is_superuser || payload.is_staff) return true;
    
    // Geschäftsführung (GF oder GF_OPS) hat vollen Zugriff
    if (payload.department_roles) {
      return payload.department_roles.some(
        role => role.role_code === 'GF' || role.role_code === 'GF_OPS'
      );
    }
    
    return false;
  }
}
