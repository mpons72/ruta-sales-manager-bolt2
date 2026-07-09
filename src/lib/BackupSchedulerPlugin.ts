import { registerPlugin } from '@capacitor/core';

export interface BackupSchedulerPlugin {
  scheduleBackup(options: { data: string; intervalHours: number }): Promise<{ success: boolean }>;
  runBackupNow(options: { data: string }): Promise<{ success: boolean }>;
  cancelBackup(): Promise<{ success: boolean }>;
  setCustomBackupPath(options: { path: string }): Promise<{ success: boolean; path: string }>;
  getCustomBackupPath(): Promise<{ success: boolean; path: string | null }>;
  saveFile(options: { data: string; filename: string }): Promise<{ success: boolean; path?: string }>;
  checkBatteryOptimization(): Promise<{ success: boolean; exempt: boolean }>;
  openBatteryOptimizationSettings(): Promise<{ success: boolean }>;
  openMiuiAutostartSettings(): Promise<{ success: boolean }>;
  openMiuiBatterySettings(): Promise<{ success: boolean }>;
  openExactAlarmSettings(): Promise<{ success: boolean }>;
  checkExactAlarmPermission(): Promise<{ success: boolean; canSchedule: boolean }>;
}

const BackupScheduler = registerPlugin<BackupSchedulerPlugin>('BackupScheduler');
export default BackupScheduler;
