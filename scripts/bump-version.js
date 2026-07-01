const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const bumpType = process.argv[2] ?? "patch";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function bumpVersion(version) {
  const parts = version.split(".").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  if (bumpType !== "patch") {
    throw new Error("Only patch version bumps are supported.");
  }
  parts[2] += 1;
  return parts.join(".");
}

function versionCode(version) {
  const [major, minor, patch] = version.split(".").map((part) => Number(part));
  return major * 10000 + minor * 100 + patch;
}

const packagePath = join(projectRoot, "package.json");
const lockPath = join(projectRoot, "package-lock.json");
const appPath = join(projectRoot, "app.json");
const gradlePath = join(projectRoot, "android", "app", "build.gradle");

const packageJson = readJson(packagePath);
const nextVersion = bumpVersion(packageJson.version);
packageJson.version = nextVersion;
writeJson(packagePath, packageJson);

const packageLock = readJson(lockPath);
packageLock.version = nextVersion;
if (packageLock.packages?.[""]) packageLock.packages[""].version = nextVersion;
writeJson(lockPath, packageLock);

const appJson = readJson(appPath);
appJson.expo.version = nextVersion;
writeJson(appPath, appJson);

const nextCode = versionCode(nextVersion);
const gradle = readFileSync(gradlePath, "utf8")
  .replace(/versionCode\s+\d+/, `versionCode ${nextCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${nextVersion}"`);
writeFileSync(gradlePath, gradle);

console.log(`Bumped version to ${nextVersion} (versionCode ${nextCode})`);
