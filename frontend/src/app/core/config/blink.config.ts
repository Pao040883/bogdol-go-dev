/**
 * Blink API Configuration
 */
export const BLINK_CONFIG = {
  // API Endpoints
  API_BASE: 'https://bogdol-api.blink.online',
  get AUTH_URL() { return `${this.API_BASE}/api/v2/auth`; },
  get ODATA_V2_URL() { return `${this.API_BASE}/odata/v2`; },
  get ODATA_V3_URL() { return `${this.API_BASE}/odata/v3`; },
  
  // Authentication
  DEVICE_INFO: {
    Number: 'webapp-go',
    Type: 'WebApplication',
    DeviceInfo: 'GO Workspace Application'
  },
  
  // API Limits and Timeouts
  RETRY_ATTEMPTS: 2,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  CACHE_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  
  // Company-specific configurations
  PERMISSION_GROUPS: {
    SERVICEMANAGER: 7,
    COMPANY_7_GROUP: 32
  },
  
  // Status mappings
  STATUS_TRANSLATIONS: {
    'New': 'Neu',
    'Exported': 'Exportiert', 
    'Approved': 'Freigegeben',
    'Billed': 'Gebucht'
  },
  
  // Colors for status indicators
  STATUS_COLORS: {
    'New': 'danger',
    'Exported': 'warning',
    'Approved': 'success',
    'Billed': 'primary'
  },
  
  // Performance thresholds
  PERFORMANCE_THRESHOLDS: {
    EXCELLENT: 80,
    GOOD: 60,
    POOR: 30
  },
  
  // Export formats
  EXPORT_FORMATS: {
    JSON: 'json',
    CSV: 'csv'
  },
  
  // Chart configurations
  CHART_CONFIG: {
    MAX_MANAGERS_IN_CHART: 10,
    ANIMATION_DURATION: 1000,
    COLORS: {
      PRIMARY: '#3dc2ff',
      SUCCESS: '#10dc60',
      WARNING: '#ffce00',
      DANGER: '#f04141',
      SECONDARY: '#5260ff',
      INFO: '#0cd1e8'
    }
  }
} as const;

/**
 * Type definitions for better type safety
 */
export type BlinkStatus = keyof typeof BLINK_CONFIG.STATUS_TRANSLATIONS;
export type BlinkStatusColor = keyof typeof BLINK_CONFIG.STATUS_COLORS;
export type ExportFormat = keyof typeof BLINK_CONFIG.EXPORT_FORMATS;
