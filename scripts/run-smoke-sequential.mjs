import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "output", "playwright");

fs.mkdirSync(outDir, { recursive: true });

await runSmokeScenario("dev", []);
await runSmokeScenario("preview", ["preview"]);

async function runSmokeScenario(label, viteArgs) {
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const scenarioOutDir = label === "preview" ? path.join(outDir, "preview") : outDir;
  fs.mkdirSync(scenarioOutDir, { recursive: true });

  const stdoutPath = path.join(outDir, `vite-${label}.log`);
  const stderrPath = path.join(outDir, `vite-${label}.err.log`);
  const stdout = fs.createWriteStream(stdoutPath, { encoding: "utf8" });
  const stderr = fs.createWriteStream(stderrPath, { encoding: "utf8" });

  const server = spawn(process.execPath, [viteBin, ...viteArgs, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    env: process.env
  });

  server.stdout.pipe(stdout);
  server.stderr.pipe(stderr);

  try {
    await waitForHttp(url, server);
    await runNodeScript(path.join(rootDir, "scripts", "smoke-editor.mjs"), {
      ...process.env,
      BRM_UI_STUDIO_OUTDIR: scenarioOutDir,
      BRM_UI_STUDIO_URL: url
    });
  } finally {
    await terminateProcess(server);
    stdout.end();
    stderr.end();
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close(() => reject(new Error("Failed to acquire a free port.")));
        return;
      }
      const { port } = address;
      probe.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function waitForHttp(url, server, timeoutMs = 90000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    let completed = false;

    const fail = (error) => {
      if (completed) return;
      completed = true;
      reject(error);
    };

    const tryRequest = () => {
      if (completed) return;
      if (Date.now() - startedAt > timeoutMs) {
        fail(new Error(`HTTP not ready: ${url}`));
        return;
      }

      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          completed = true;
          resolve();
          return;
        }
        setTimeout(tryRequest, 500);
      });

      request.on("error", () => setTimeout(tryRequest, 500));
    };

    server.once("exit", (code, signal) => {
      fail(new Error(`Vite ${url} exited before ready (code=${code}, signal=${signal})`));
    });

    tryRequest();
  });
}

function runNodeScript(scriptPath, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: rootDir,
      env,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Smoke script failed with exit code ${code}.`));
    });
    child.on("error", reject);
  });
}

function terminateProcess(child) {
  if (!child.pid || child.killed) return Promise.resolve();

  if (process.platform === "win32") {
    return new Promise((resolve, reject) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore"
      });
      killer.on("exit", () => resolve());
      killer.on("error", reject);
    });
  }

  child.kill("SIGTERM");
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
      resolve();
    }, 5000);
  });
}
