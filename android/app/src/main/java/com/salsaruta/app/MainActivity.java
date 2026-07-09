package com.salsaruta.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;
import com.salsaruta.app.backup.BackupSchedulerPlugin;
import com.salsaruta.app.print.PrintPlugin;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_NAME = "app_permissions";
    private static final String KEY_PERMISSIONS_REQUESTED = "permissions_requested_v2";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class);
        registerPlugin(BackupSchedulerPlugin.class);
        super.onCreate(savedInstanceState);

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean alreadyRequested = prefs.getBoolean(KEY_PERMISSIONS_REQUESTED, false);
        if (!alreadyRequested) {
            requestAllBackgroundPermissions();
            prefs.edit().putBoolean(KEY_PERMISSIONS_REQUESTED, true).apply();
        }
    }

    private void requestAllBackgroundPermissions() {
        requestBatteryOptimizationExemption();
    }

    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                try {
                    Intent intent = new Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                    );
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        startActivity(new Intent(
                            Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
                        ));
                    } catch (Exception ignored) {}
                }
            }
        }
    }
}

