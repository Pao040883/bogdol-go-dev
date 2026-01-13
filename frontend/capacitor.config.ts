import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ionic.frontend',
  appName: 'frontend',
  webDir: 'www',
  plugins: {
    Camera: {
      saveToGallery: false
    }
  }
};

export default config;
