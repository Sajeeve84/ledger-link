import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.accountingdocs.app',
  appName: 'AccountingDocs',
  webDir: 'dist',
  server: {
    url: 'https://7cce0221-1ec9-4118-9b72-c3fec4c03c29.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
