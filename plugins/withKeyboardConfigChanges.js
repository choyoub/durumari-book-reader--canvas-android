const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");

function findClassClosingBrace(source, className) {
  const classIndex = source.indexOf(`class ${className}`);
  if (classIndex < 0) return -1;

  const openingBrace = source.indexOf("{", classIndex);
  if (openingBrace < 0) return -1;

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function addImport(source, importLine) {
  if (source.includes(importLine)) return source;
  return source.replace(/^package .+\n/m, (match) => `${match}\n${importLine}\n`);
}

function addSafMetadataModule(source) {
  if (source.includes("class SafMetadataModule")) return source;

  let nextSource = source;
  [
    "import android.net.Uri",
    "import android.provider.DocumentsContract",
    "import android.provider.OpenableColumns",
    "import com.facebook.react.bridge.Promise",
    "import com.facebook.react.bridge.ReactApplicationContext",
    "import com.facebook.react.bridge.ReactContextBaseJavaModule",
    "import com.facebook.react.bridge.ReactMethod",
    "import com.facebook.react.bridge.WritableNativeMap",
    "import com.facebook.react.ReactPackage",
    "import com.facebook.react.bridge.NativeModule",
    "import com.facebook.react.uimanager.ViewManager",
    "import java.util.ArrayList",
  ].forEach((importLine) => {
    nextSource = addImport(nextSource, importLine);
  });

  const safModule = `
class SafMetadataModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String {
      return "SafMetadataModule"
  }

  @ReactMethod
  fun getFileMetadata(uriString: String, promise: Promise) {
      try {
          val uri = Uri.parse(uriString)
          var size: Long = 0
          var modifiedAt: Long = 0

          reactContext.contentResolver.query(
              uri,
              arrayOf(OpenableColumns.SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED),
              null,
              null,
              null
          )?.use { cursor ->
              if (cursor.moveToFirst()) {
                  val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                  if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                      size = cursor.getLong(sizeIndex)
                  }

                  val modifiedIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
                  if (modifiedIndex >= 0 && !cursor.isNull(modifiedIndex)) {
                      modifiedAt = cursor.getLong(modifiedIndex)
                  }
              }
          }

          val map = WritableNativeMap()
          map.putDouble("size", size.toDouble())
          map.putDouble("modifiedAt", modifiedAt.toDouble())
          promise.resolve(map)
      } catch (error: Exception) {
          promise.reject("SAF_METADATA_ERROR", error)
      }
  }
}

class SafMetadataPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
      val modules = ArrayList<NativeModule>()
      modules.add(SafMetadataModule(reactContext))
      return modules
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
      return emptyList()
  }
}

`;

  const mainActivityIndex = nextSource.indexOf("class MainActivity");
  if (mainActivityIndex < 0) {
    throw new Error("Could not locate MainActivity declaration.");
  }
  return `${nextSource.slice(0, mainActivityIndex)}${safModule}${nextSource.slice(mainActivityIndex)}`;
}

function addSystemBarModule(source) {
  if (source.includes("class SystemBarModule")) return source;

  let nextSource = source;
  [
    "import android.graphics.Color",
    "import androidx.core.view.WindowInsetsControllerCompat",
    "import com.facebook.react.bridge.ReactApplicationContext",
    "import com.facebook.react.bridge.ReactContextBaseJavaModule",
    "import com.facebook.react.bridge.ReactMethod",
    "import com.facebook.react.ReactPackage",
    "import com.facebook.react.bridge.NativeModule",
    "import com.facebook.react.uimanager.ViewManager",
    "import java.util.ArrayList",
  ].forEach((importLine) => {
    nextSource = addImport(nextSource, importLine);
  });

  const systemBarModule = `
class SystemBarModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String {
      return "SystemBarModule"
  }

  @ReactMethod
  fun setNavigationBarTheme(color: String, useDarkButtons: Boolean) {
      val activity = reactApplicationContext.currentActivity ?: return
      activity.runOnUiThread {
          try {
              val parsedColor = Color.parseColor(color)
              activity.window.navigationBarColor = parsedColor
              if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                  WindowInsetsControllerCompat(activity.window, activity.window.decorView).isAppearanceLightNavigationBars = useDarkButtons
              }
          } catch (_: Exception) {
          }
      }
  }
}

class SystemBarPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
      val modules = ArrayList<NativeModule>()
      modules.add(SystemBarModule(reactContext))
      return modules
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
      return emptyList()
  }
}

`;

  const mainActivityIndex = nextSource.indexOf("class MainActivity");
  if (mainActivityIndex < 0) {
    throw new Error("Could not locate MainActivity declaration.");
  }
  return `${nextSource.slice(0, mainActivityIndex)}${systemBarModule}${nextSource.slice(mainActivityIndex)}`;
}

function addSafMetadataPackage(source) {
  if (source.includes("add(SafMetadataPackage())")) return source;
  return source.replace(
    /PackageList\(this\)\.packages\.apply\s*\{/,
    (match) => `${match}\n          add(SafMetadataPackage())`,
  );
}

function addSystemBarPackage(source) {
  if (source.includes("add(SystemBarPackage())")) return source;
  return source.replace(
    /PackageList\(this\)\.packages\.apply\s*\{/,
    (match) => `${match}\n          add(SystemBarPackage())`,
  );
}

function addEscapeBackHandling(source) {
  if (source.includes("KeyEvent.KEYCODE_ESCAPE")) return source;

  let nextSource = source;
  if (!nextSource.includes("import android.view.KeyEvent")) {
    nextSource = nextSource.replace(
      "import android.os.Bundle",
      "import android.os.Bundle\nimport android.view.KeyEvent",
    );
  }

  const classEnd = findClassClosingBrace(nextSource, "MainActivity");
  if (classEnd < 0) {
    throw new Error("Could not locate the MainActivity class body.");
  }

  const escapeBackHandling = `

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_ESCAPE) {
      return true
    }
    return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_ESCAPE) {
      onBackPressedDispatcher.onBackPressed()
      return true
    }
    return super.onKeyUp(keyCode, event)
  }
`;

  return `${nextSource.slice(0, classEnd)}${escapeBackHandling}${nextSource.slice(classEnd)}`;
}

module.exports = function withKeyboardConfigChanges(config) {
  config = withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    const mainActivity = application?.activity?.find(
      (activity) => activity.$?.["android:name"] === ".MainActivity",
    );
    if (!mainActivity?.$) return androidConfig;

    const handledChanges = new Set(
      (mainActivity.$["android:configChanges"] ?? "")
        .split("|")
        .filter(Boolean),
    );
    handledChanges.add("keyboard");
    handledChanges.add("keyboardHidden");
    handledChanges.add("navigation");
    mainActivity.$["android:configChanges"] = [...handledChanges].join("|");
    mainActivity.$["android:resizeableActivity"] = "true";
    delete mainActivity.$["android:screenOrientation"];
    return androidConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (androidConfig) => {
      const packageName = androidConfig.android?.package;
      if (!packageName) {
        throw new Error("android.package is required to patch MainActivity.");
      }

      const mainActivityPath = path.join(
        androidConfig.modRequest.projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        ...packageName.split("."),
        "MainActivity.kt",
      );
      const source = await fs.promises.readFile(mainActivityPath, "utf8");
      const nextSource = addSystemBarModule(addSafMetadataModule(addEscapeBackHandling(source)));
      if (nextSource !== source) {
        await fs.promises.writeFile(mainActivityPath, nextSource);
      }

      const mainApplicationPath = path.join(
        androidConfig.modRequest.projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        ...packageName.split("."),
        "MainApplication.kt",
      );
      const applicationSource = await fs.promises.readFile(mainApplicationPath, "utf8");
      const nextApplicationSource = addSystemBarPackage(addSafMetadataPackage(applicationSource));
      if (nextApplicationSource !== applicationSource) {
        await fs.promises.writeFile(mainApplicationPath, nextApplicationSource);
      }
      return androidConfig;
    },
  ]);
};
