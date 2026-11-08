import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";

async function testService(serviceDir, port, expectedTarget) {
  console.log(`Testing skeleton ${serviceDir} on port ${port}...`);
  const child = spawn("node", ["src/index.js"], {
    cwd: path.resolve(serviceDir),
    env: { ...process.env, PORT: String(port) },
    stdio: "inherit"
  });

  // Give service 1.5 seconds to start
  await new Promise(r => setTimeout(r, 1500));

  return new Promise((resolve) => {
    http.get(`http://localhost:${port}/health`, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          console.log(`[PASS] ${serviceDir} responded:`, json);
          child.kill("SIGTERM");
          resolve(json.status === "ok" && json.database.target === expectedTarget);
        } catch (e) {
          console.error(`[FAIL] ${serviceDir} parse error:`, e.message);
          child.kill("SIGTERM");
          resolve(false);
        }
      });
    }).on("error", (e) => {
      console.error(`[FAIL] ${serviceDir} error:`, e.message);
      child.kill("SIGTERM");
      resolve(false);
    });
  });
}

async function main() {
  const ok = await testService("services/auth-service", 4001, "rgukt_auth_db");
  if (ok) {
    console.log("✓ SKELETON VERIFICATION SUCCESSFUL!");
    process.exit(0);
  } else {
    console.error("✗ SKELETON VERIFICATION FAILED!");
    process.exit(1);
  }
}

main();

