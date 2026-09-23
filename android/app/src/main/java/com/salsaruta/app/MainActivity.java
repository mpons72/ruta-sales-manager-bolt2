package com.salsaruta.app;

import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;
import com.salsaruta.app.backup.BackupSchedulerPlugin;
import com.salsaruta.app.print.PrintPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class);
        registerPlugin(BackupSchedulerPlugin.class);
        super.onCreate(savedInstanceState);
        android.webkit.WebView webView = getBridge().getWebView();
        webView.getSettings().setSupportZoom(true);
        webView.getSettings().setBuiltInZoomControls(true);
        webView.getSettings().setDisplayZoomControls(false);
        requestBatteryOptimizationExemption();
    }

    @Override
    protected void attachBaseContext(Context newBase) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Configuration config = new Configuration(
                newBase.getResources().getConfiguration()
            );
            config.fontScale = 1.0f;
            Context context = newBase.createConfigurationContext(config);
            super.attachBaseContext(context);
        } else {
            super.attachBaseContext(newBase);
        }
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

