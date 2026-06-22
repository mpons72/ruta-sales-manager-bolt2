package com.salsaruta.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.salsaruta.app.print.PrintPlugin;
import com.salsaruta.app.backup.BackupSchedulerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class);
        registerPlugin(BackupSchedulerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
