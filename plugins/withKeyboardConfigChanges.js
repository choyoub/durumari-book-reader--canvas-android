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
      const nextSource = addEscapeBackHandling(source);
      if (nextSource !== source) {
        await fs.promises.writeFile(mainActivityPath, nextSource);
      }
      return androidConfig;
    },
  ]);
};
