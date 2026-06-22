import { registerPlugin } from '@capacitor/core';

export interface BackupSchedulerPlugin {
  scheduleBackup(options: { data: string; intervalHours: number }): Promise<{ success: boolean }>;
  runBackupNow(options: { data: string }): Promise<{ success: boolean }>;
  cancelBackup(): Promise<{ success: boolean }>;
}

const BackupScheduler = registerPlugin<BackupSchedulerPlugin>('BackupScheduler');
export default BackupScheduler;
