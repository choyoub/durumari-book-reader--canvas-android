const { copyFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = join(__dirname, "..");
const androidRoot = join(projectRoot, "android");

const variants = {
  release: {
    task: "assembleRelease",
    source: join(androidRoot, "app", "build", "outputs", "apk", "release", "app-release.apk"),
    targetDir: join(projectRoot, "apk", "release"),
    target: join(projectRoot, "apk", "release", "durumari-v2-app-release.apk"),
  },
  debug: {
    task: "assembleDebug",
    source: join(androidRoot, "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    targetDir: join(projectRoot, "apk", "debug"),
    target: join(projectRoot, "apk", "debug", "durumari-v2-app-debug.apk"),
  },
};

const requested = process.argv.slice(2).map((arg) => arg.toLowerCase());
const selected = requested.length === 0 ? ["release", "debug"] : requested;
const invalid = selected.filter((variant) => !variants[variant]);

if (invalid.length > 0) {
  console.error(`Unknown APK build option: ${invalid.join(", ")}`);
  console.error("Use: npm run build:apk -- [release|debug]");
  process.exit(1);
}

for (const variant of selected) {
  const config = variants[variant];
  const result = spawnSync("gradlew.bat", [config.task], {
    cwd: androidRoot,
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  mkdirSync(config.targetDir, { recursive: true });
  copyFileSync(config.source, config.target);
  console.log(`Copied ${variant} APK to ${config.target}`);
}
