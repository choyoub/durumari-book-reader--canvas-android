const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const command = process.platform === "win32" ? "cmd.exe" : "npx";
const expoArgs = process.platform === "win32"
  ? ["/d", "/s", "/c", "npx expo start --web"]
  : ["expo", "start", "--web"];
const sourceDir = path.resolve(process.env.TEST_NOVELS_DIR || "G:\\내 드라이브\\소설");
const port = Number(process.env.TEST_NOVELS_PORT || 8787);
const baseUrl = `http://localhost:${port}`;
const supportedExtensions = new Set([".txt", ".epub", ".zip", ".gz"]);

function stripExtension(name) {
  return name.replace(/\.(txt|epub|zip|gz)$/i, "");
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".epub") return "application/epub+zip";
  if (ext === ".zip") return "application/zip";
  if (ext === ".gz") return "application/gzip";
  return "application/octet-stream";
}

function isInsideSource(filePath) {
  const relative = path.relative(sourceDir, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function collectFiles(dir, output = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, output);
      continue;
    }
    if (!entry.isFile() || !supportedExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const stat = await fs.promises.stat(fullPath);
    const relativePath = path.relative(sourceDir, fullPath).replace(/\\/g, "/");
    output.push({
      file: relativePath,
      title: stripExtension(path.basename(entry.name)),
      modifiedAt: Math.round(stat.mtimeMs),
      size: stat.size,
    });
  }
  return output;
}

function sendJson(response, value) {
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

function sendError(response, status, message) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

const server = http.createServer(async (request, response) => {
  try {
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (!request.url) {
      sendError(response, 400, "잘못된 요청입니다.");
      return;
    }
    const url = new URL(request.url, baseUrl);
    if (url.pathname === "/manifest.json") {
      const files = await collectFiles(sourceDir);
      files.sort((a, b) => a.file.localeCompare(b.file, "ko", { numeric: true }));
      sendJson(response, files);
      return;
    }
    if (url.pathname === "/file") {
      const relativePath = url.searchParams.get("path");
      if (!relativePath) {
        sendError(response, 400, "파일 경로가 없습니다.");
        return;
      }
      const filePath = path.resolve(sourceDir, relativePath);
      if (!isInsideSource(filePath) || !supportedExtensions.has(path.extname(filePath).toLowerCase())) {
        sendError(response, 403, "허용되지 않은 파일입니다.");
        return;
      }
      await fs.promises.access(filePath, fs.constants.R_OK);
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Content-Type": contentType(filePath),
      });
      fs.createReadStream(filePath).pipe(response);
      return;
    }
    sendError(response, 404, "찾을 수 없습니다.");
  } catch (error) {
    sendError(response, 500, error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, () => {
  console.log(`[web:test] 소설 폴더: ${sourceDir}`);
  console.log(`[web:test] 테스트 파일 서버: ${baseUrl}`);

  const child = spawn(command, expoArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXPO_PUBLIC_TEST_MODE: "1",
      EXPO_PUBLIC_TEST_NOVELS_BASE_URL: baseUrl,
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    server.close(() => {
      if (signal) process.kill(process.pid, signal);
      process.exit(code ?? 0);
    });
  });

  child.on("error", (error) => {
    console.error(`[web:test] Expo 서버를 시작하지 못했습니다: ${error.message}`);
    server.close(() => process.exit(1));
  });
});

server.on("error", (error) => {
  console.error(`[web:test] 테스트 파일 서버를 시작하지 못했습니다: ${error.message}`);
  process.exit(1);
});
