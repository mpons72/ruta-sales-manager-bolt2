package com.salsaruta.app.backup;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileWriter;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "BackupScheduler")
public class BackupSchedulerPlugin extends Plugin {

    private static final String WORK_TAG = "salsaruta_backup";
    private static final String PREFS_NAME = "backup_prefs";
    private static final String KEY_CUSTOM_PATH = "custom_backup_path";

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private boolean writeTempFile(String data) {
        try {
            File tempFile = new File(getContext().getFilesDir(), BackupWorker.TEMP_FILE_NAME);
            FileWriter writer = new FileWriter(tempFile);
            writer.write(data);
            writer.flush();
            writer.close();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void scheduleBackup(PluginCall call) {
        try {
            String data = call.getString("data");
            long intervalHours = call.getLong("intervalHours", 24L);

            if (data == null || data.isEmpty()) {
                call.reject("No backup data provided");
                return;
            }

            if (!writeTempFile(data)) {
                call.reject("Could not write temp file");
                return;
            }

            // Persist schedule config so BootReceiver can re-enqueue after reboot
            long finalIntervalHours = intervalHours;
            getPrefs().edit()
                .putBoolean("schedule_enabled", true)
                .putLong("interval_hours", finalIntervalHours)
                .apply();

            PeriodicWorkRequest backupRequest =
                new PeriodicWorkRequest.Builder(BackupWorker.class, intervalHours, TimeUnit.HOURS)
                    .addTag(WORK_TAG)
                    .setBackoffCriteria(
                        androidx.work.BackoffPolicy.EXPONENTIAL,
                        30,
                        TimeUnit.MINUTES
                    )
                    .build();

            WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(
                WORK_TAG,
                ExistingPeriodicWorkPolicy.UPDATE,
                backupRequest
            );

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error scheduling backup: " + e.getMessage());
        }
    }

    @PluginMethod
    public void runBackupNow(PluginCall call) {
        try {
            String data = call.getString("data");
            if (data == null || data.isEmpty()) {
                call.reject("No backup data provided");
                return;
            }

            if (!writeTempFile(data)) {
                call.reject("Could not write temp file");
                return;
            }

            OneTimeWorkRequest backupRequest =
                new OneTimeWorkRequest.Builder(BackupWorker.class).build();

            WorkManager.getInstance(getContext()).enqueue(backupRequest);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error running backup: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        try {
            String data = call.getString("data");
            String filename = call.getString("filename");
            if (data == null || data.isEmpty()) {
                call.reject("No data provided");
                return;
            }
            if (filename == null || filename.trim().isEmpty()) {
                call.reject("No filename provided");
                return;
            }

            SharedPreferences prefs = getPrefs();
            String customPath = prefs.getString(KEY_CUSTOM_PATH, null);

            File targetDir;
            if (customPath != null && !customPath.trim().isEmpty()) {
                targetDir = new File(customPath);
            } else {
                targetDir = android.os.Environment.getExternalStoragePublicDirectory(
                    android.os.Environment.DIRECTORY_DOCUMENTS
                );
            }
            if (!targetDir.exists()) targetDir.mkdirs();

            File outFile = new File(targetDir, filename);
            FileWriter writer = new FileWriter(outFile);
            writer.write(data);
            writer.flush();
            writer.close();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("path", outFile.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error saving file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelBackup(PluginCall call) {
        try {
            WorkManager.getInstance(getContext()).cancelAllWorkByTag(WORK_TAG);
            getPrefs().edit()
                .putBoolean("schedule_enabled", false)
                .apply();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error cancelling backup: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setCustomBackupPath(PluginCall call) {
        try {
            String path = call.getString("path");
            SharedPreferences prefs = getPrefs();
            if (path == null || path.trim().isEmpty()) {
                prefs.edit().remove(KEY_CUSTOM_PATH).apply();
            } else {
                prefs.edit().putString(KEY_CUSTOM_PATH, path).apply();
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("path", path);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error setting custom backup path: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getCustomBackupPath(PluginCall call) {
        try {
            SharedPreferences prefs = getPrefs();
            String path = prefs.getString(KEY_CUSTOM_PATH, null);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("path", path);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error getting custom backup path: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkBatteryOptimization(PluginCall call) {
        try {
            android.os.PowerManager pm = (android.os.PowerManager)
                getContext().getSystemService(android.content.Context.POWER_SERVICE);
            boolean isExempt = false;
            if (pm != null && android.os.Build.VERSION.SDK_INT >= 
                    android.os.Build.VERSION_CODES.M) {
                isExempt = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("exempt", isExempt);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent(
                android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
            );
            intent.setData(android.net.Uri.parse(
                "package:" + getContext().getPackageName()
            ));
            getBridge().getActivity().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                getBridge().getActivity().startActivity(new android.content.Intent(
                    android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
                ));
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject("Error: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void openMiuiAutostartSettings(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent();
            intent.setAction("miui.intent.action.APP_PERM_EDITOR");
            intent.setClassName(
                "com.miui.securitycenter",
                "com.miui.permcenter.autostart.AutoStartManagementActivity"
            );
            intent.putExtra("package_name", getContext().getPackageName());
            getBridge().getActivity().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                android.content.Intent fallback = new android.content.Intent();
                fallback.setComponent(new android.content.ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.securitycenter.MainActivity"
                ));
                getBridge().getActivity().startActivity(fallback);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject("MIUI autostart settings not available: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void openMiuiBatterySettings(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent();
            intent.setComponent(new android.content.ComponentName(
                "com.miui.powerkeeper",
                "com.miui.powerkeeper.ui.HiddenAppsContainerManagementActivity"
            ));
            intent.putExtra("package_name", getContext().getPackageName());
            intent.putExtra("package_label", "SalsaRuta");
            getBridge().getActivity().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                android.content.Intent fallback = new android.content.Intent(
                    android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                );
                fallback.setData(android.net.Uri.parse(
                    "package:" + getContext().getPackageName()
                ));
                getBridge().getActivity().startActivity(fallback);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject("Error: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                android.content.Intent intent = new android.content.Intent(
                    android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM
                );
                intent.setData(android.net.Uri.parse(
                    "package:" + getContext().getPackageName()
                ));
                getBridge().getActivity().startActivity(intent);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkExactAlarmPermission(PluginCall call) {
        try {
            boolean canSchedule = true;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                android.app.AlarmManager am = (android.app.AlarmManager)
                    getContext().getSystemService(android.content.Context.ALARM_SERVICE);
                canSchedule = am != null && am.canScheduleExactAlarms();
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("canSchedule", canSchedule);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error: " + e.getMessage());
        }
    }
}
