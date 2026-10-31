package fr.delagraineaujardin.pp;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Mise à jour en un clic : télécharge l'APK publié sur GitHub Releases puis ouvre l'installeur Android.
 * Le téléchargement reste limité aux releases du dépôt officiel.
 */
@CapacitorPlugin(name = "ApkUpdate")
public class ApkUpdatePlugin extends Plugin {

  private static final String ALLOWED_PREFIX = "https://github.com/af20091991/crjardin/releases/";

  @PluginMethod
  public void canInstall(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("value", canInstallNow());
    call.resolve(ret);
  }

  @PluginMethod
  public void openInstallSettings(PluginCall call) {
    Intent intent = new Intent(
      Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
      Uri.parse("package:" + getContext().getPackageName())
    );
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
    call.resolve();
  }

  @PluginMethod
  public void downloadAndInstall(PluginCall call) {
    String url = call.getString("url", "");
    if (url == null || !url.startsWith(ALLOWED_PREFIX)) {
      call.reject("Adresse de mise à jour non autorisée");
      return;
    }
    if (!canInstallNow()) {
      JSObject ret = new JSObject();
      ret.put("needsPermission", true);
      call.resolve(ret);
      return;
    }
    new Thread(() -> {
      try {
        File apk = download(url);
        getActivity().runOnUiThread(() -> {
          try {
            launchInstaller(apk);
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
          } catch (Exception e) {
            call.reject("Ouverture de l'installeur impossible : " + e.getMessage());
          }
        });
      } catch (Exception e) {
        call.reject("Téléchargement impossible : " + e.getMessage());
      }
    }, "apk-update").start();
  }

  private boolean canInstallNow() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
      || getContext().getPackageManager().canRequestPackageInstalls();
  }

  private File download(String url) throws Exception {
    File dir = new File(getContext().getCacheDir(), "update");
    if (!dir.exists() && !dir.mkdirs()) throw new Exception("dossier temporaire");
    File target = new File(dir, "PilotPro.apk");
    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
    conn.setInstanceFollowRedirects(true);
    conn.setConnectTimeout(15000);
    conn.setReadTimeout(60000);
    try {
      int code = conn.getResponseCode();
      if (code != HttpURLConnection.HTTP_OK) throw new Exception("HTTP " + code);
      try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(target)) {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
      }
    } finally {
      conn.disconnect();
    }
    return target;
  }

  private void launchInstaller(File apk) {
    Uri uri = FileProvider.getUriForFile(
      getContext(),
      getContext().getPackageName() + ".fileprovider",
      apk
    );
    Intent intent = new Intent(Intent.ACTION_VIEW);
    intent.setDataAndType(uri, "application/vnd.android.package-archive");
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
  }
}
