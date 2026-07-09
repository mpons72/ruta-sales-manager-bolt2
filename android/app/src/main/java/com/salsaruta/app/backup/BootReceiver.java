package com.salsaruta.app.backup;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

public class BootReceiver extends BroadcastReceiver {

    private static final String WORK_TAG = "salsaruta_backup";
    private static final String PREFS_NAME = "backup_prefs";
    private static final String KEY_SCHEDULE_ENABLED = "schedule_enabled";
    private static final String KEY_INTERVAL_HOURS = "interval_hours";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) &&
            !"android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean(KEY_SCHEDULE_ENABLED, false);
        if (!enabled) return;

        long intervalHours = prefs.getLong(KEY_INTERVAL_HOURS, 24L);

        PeriodicWorkRequest backupRequest =
            new PeriodicWorkRequest.Builder(BackupWorker.class, intervalHours, TimeUnit.HOURS)
                .addTag(WORK_TAG)
                .build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_TAG,
            ExistingPeriodicWorkPolicy.KEEP,
            backupRequest
        );
    }
}
