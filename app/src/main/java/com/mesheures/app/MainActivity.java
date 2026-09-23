package com.mesheures.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.activity.ComponentActivity;
import com.mesheures.app.nativeui.NativeDashboardActivity;

public final class MainActivity extends ComponentActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startActivity(new Intent(this, NativeDashboardActivity.class));
        finish();
    }
}
