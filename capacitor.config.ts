import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salsaruta.app',
  appName: 'SalsaRuta',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav',
    },
    Share: {
      enabled: true,
    },
    Browser: {
      enabled: true,
    },
    CapacitorPrint: {
      enabled: true,
    },
  },
};

export default config;
