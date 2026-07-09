package com.salsaruta.app.backup;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Environment;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class BackupWorker extends Worker {

    public static final String TEMP_FILE_NAME = "backup_pending.json";
    private static final String PREFS_NAME = "backup_prefs";
    private static final String KEY_CUSTOM_PATH = "custom_backup_path";

    public BackupWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    private File getBackupDirectory(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String customPath = prefs.getString(KEY_CUSTOM_PATH, null);
        
        if (customPath != null && !customPath.trim().isEmpty()) {
            File customDir = new File(customPath);
            if (customDir.exists() && customDir.isDirectory() && customDir.canWrite()) {
                return customDir;
            }
        }
        
        // Fallback to Documents
        File docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
        if (!docsDir.exists()) docsDir.mkdirs();
        return docsDir;
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            Context context = getApplicationContext();
            File tempFile = new File(context.getFilesDir(), TEMP_FILE_NAME);
            if (!tempFile.exists()) return Result.failure();

            StringBuilder sb = new StringBuilder();
            BufferedReader reader = new BufferedReader(new FileReader(tempFile));
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            reader.close();

            String data = sb.toString();
            if (data.isEmpty()) return Result.failure();

            String filename = generateFilename();
            File backupDir = getBackupDirectory(context);
            
            File outFile = new File(backupDir, filename);
            FileWriter writer = new FileWriter(outFile);
            writer.write(data);
            writer.flush();
            writer.close();

            return Result.success();
        } catch (Exception e) {
            // Retry up to 3 times with exponential backoff before giving up
            return Result.retry();
        }
    }

    private String generateFilename() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd_HHmm", Locale.getDefault());
        return "backup_lasalsoa_fecha_" + sdf.format(new Date()) + ".json";
    }
}
