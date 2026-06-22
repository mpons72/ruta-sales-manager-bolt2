package com.salsaruta.app.backup;

import android.content.Context;
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

            PeriodicWorkRequest backupRequest =
                new PeriodicWorkRequest.Builder(BackupWorker.class, intervalHours, TimeUnit.HOURS)
                    .addTag(WORK_TAG)
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
    public void cancelBackup(PluginCall call) {
        try {
            WorkManager.getInstance(getContext()).cancelAllWorkByTag(WORK_TAG);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error cancelling backup: " + e.getMessage());
        }
    }
}
