const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const cwd = __dirname;
const isWin = process.platform === "win32";
const venvPy = isWin ? path.join(cwd, "venv", "Scripts", "python.exe") : path.join(cwd, "venv", "bin", "python");

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: false, windowsHide: true, ...opts });
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    p.on("error", reject);
  });
}

function execShell(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd, windowsHide: true }, () => resolve());
  });
}

(async () => {
  try {
    if (isWin) {
      await execShell('for /f "tokens=5" %a in (\'netstat -aon ^| findstr /R /C:\":8000\" ^| findstr /C:\"LISTENING\"\') do taskkill /f /pid %a >nul 2>&1');
    } else {
      await execShell('sh -lc "lsof -t -i:8000 | xargs -r kill -9"');
    }
    if (!fs.existsSync(venvPy)) {
      await run("python", ["-m", "venv", "venv"]);
    }
    await run(venvPy, ["-m", "pip", "install", "-r", "requirements.txt"]);
    const uvicorn = spawn(venvPy, ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"], { cwd, stdio: "inherit", windowsHide: true });
    process.on("SIGINT", () => { try { uvicorn.kill("SIGINT"); } catch (_) {} });
    process.on("SIGTERM", () => { try { uvicorn.kill("SIGTERM"); } catch (_) {} });
    uvicorn.on("exit", (code) => { process.exit(code || 0); });
  } catch (e) {
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  }
})();

