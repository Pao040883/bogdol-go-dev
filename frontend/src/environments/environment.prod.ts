export const environment = {
  production: true,
  apiUrl: 'https://go-dev.bogdol.gmbh/api',
  allowedOrigins: ['https://go-dev.bogdol.gmbh'],
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  maxRetryAttempts: 3
};
