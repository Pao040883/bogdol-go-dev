export const environment = {
  production: true,
  apiUrl: 'http://go.localhost/api',
  allowedOrigins: ['http://go.localhost'],
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  maxRetryAttempts: 3
};
