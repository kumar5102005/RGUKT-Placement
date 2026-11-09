import http from "node:http";

const targets = [
  { name: "API Gateway Health", url: "http://localhost:8080/health" },
  { name: "Auth Service via Gateway", url: "http://localhost:8080/api/v1/auth/health" },
  { name: "Student Service via Gateway", url: "http://localhost:8080/api/v1/students/health" },
  { name: "Company & Drive Service via Gateway", url: "http://localhost:8080/api/v1/drives/health" },
  { name: "Application Service via Gateway", url: "http://localhost:8080/api/v1/applications/health" },
  { name: "Notification Service via Gateway", url: "http://localhost:8080/api/v1/notifications/health" }
];

async function checkUrl(target) {
  return new Promise((resolve) => {
    const req = http.get(target.url, { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ target: target.name, url: target.url, statusCode: res.statusCode, ok: res.statusCode === 200, data: json });
        } catch {
          resolve({ target: target.name, url: target.url, statusCode: res.statusCode, ok: res.statusCode === 200, data });
        }
      });
    });

    req.on("error", (err) => {
      resolve({ target: target.name, url: target.url, ok: false, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ target: target.name, url: target.url, ok: false, error: "Connection timed out" });
    });
  });
}

async function run() {
  console.log("==================================================================");
  console.log("RGUKT Ongole Placement Hub - Health Verification");
  console.log("==================================================================");
  for (const t of targets) {
    const res = await checkUrl(t);
    const badge = res.ok ? "✓ [PASS]" : "✗ [FAIL]";
    console.log(`${badge} ${res.target} (${res.url}) - Status: ${res.statusCode || "DOWN"}`);
    if (res.data) console.log("   Payload:", JSON.stringify(res.data));
    if (res.error) console.log("   Error:", res.error);
  }
  console.log("==================================================================");
}

run();
