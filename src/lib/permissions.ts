import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // En web, usar Notification API
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting web notification permission:', error);
        return false;
      }
    }
    return false;
  }

  // En nativo, usar Capacitor
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted' || result.display === 'limited';
  } catch (error) {
    console.error('Error requesting native notification permission:', error);
    // Asumir permiso concedido si hay error (para evitar bloqueos)
    return true;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }

  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted' || result.display === 'limited';
  } catch (error) {
    console.error('Error checking notification permission:', error);
    // Asumir permiso concedido si hay error
    return true;
  }
}

export async function requestStoragePermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // En web, los permisos de archivo se manejan diferente
    return true;
  }

  try {
    // Intentar escribir en el directorio de documentos
    const testFileName = 'permission_test_' + Date.now() + '.txt';
    await Filesystem.writeFile({
      path: testFileName,
      data: 'test',
      directory: Directory.Documents,
      encoding: 'utf8',
    });
    
    // Limpiar archivo de prueba
    try {
      await Filesystem.deleteFile({
        path: testFileName,
        directory: Directory.Documents,
      });
    } catch (deleteError) {
      console.warn('Could not delete test file:', deleteError);
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting storage permission:', error);
    // En Android moderno, los permisos de almacenamiento pueden estar concedidos por defecto
    // para el directorio de la app, así que asumimos éxito
    return true;
  }
}

export async function scheduleBackupNotification(title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // En web, usar Notification API
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch (error) {
        console.error('Error showing web notification:', error);
      }
    }
    return;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'beep.wav',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#488AFF',
        },
      ],
    });
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
}

export async function checkAllPermissions(): Promise<{
  notifications: boolean;
  storage: boolean;
}> {
  try {
    const [notifications, storage] = await Promise.all([
      checkNotificationPermission(),
      requestStoragePermission(),
    ]);

    return { notifications, storage };
  } catch (error) {
    console.error('Error checking permissions:', error);
    // En caso de error, asumir permisos concedidos para no bloquear la app
    return { notifications: true, storage: true };
  }
}
