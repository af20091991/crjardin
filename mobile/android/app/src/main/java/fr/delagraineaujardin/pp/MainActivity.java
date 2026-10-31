package fr.delagraineaujardin.pp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ApkUpdatePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
