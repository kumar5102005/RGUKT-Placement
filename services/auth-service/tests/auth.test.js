/**
 * RGUKT Ongole Placement Hub - Authentication & RBAC Test Suite
 * Run with: node tests/auth.test.js
 */

import http from "node:http";

const BASE_URL = process.env.TEST_AUTH_URL || "http://localhost:4001";

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runTests() {
  console.log("==================================================================");
  console.log("Starting RGUKT Ongole Placement Hub Authentication & RBAC Tests");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================================");

  const timestamp = Date.now();
  const studentEmail = `student_${timestamp}@rguktong.ac.in`;
  const recruiterEmail = `recruiter_${timestamp}@google.com`;
  const adminEmail = `admin_${timestamp}@rguktong.ac.in`;
  const password = "SecurePassword123#";

  let studentAccessToken = "";
  let studentRefreshToken = "";
  let adminAccessToken = "";
  let studentId = "";

  try {
    // 1. Validation Failures
    console.log("\n[Test Suite 1: Input Validation]");
    const weakPassRes = await makeRequest("POST", "/register", {
      email: "test@rgukt.ac.in",
      password: "weak",
      fullName: "Test User",
    });
    assert(weakPassRes.status === 400, "Reject weak password with 400 Bad Request");

    const invalidEmailRes = await makeRequest("POST", "/register", {
      email: "not-an-email",
      password,
      fullName: "Test User",
    });
    assert(invalidEmailRes.status === 400, "Reject invalid email with 400 Bad Request");

    // 2. Student Registration
    console.log("\n[Test Suite 2: User Registration]");
    const regStudentRes = await makeRequest("POST", "/register", {
      email: studentEmail,
      password,
      fullName: "Sai Kumar",
      role: "STUDENT",
      studentId: "O180999",
    });
    assert(regStudentRes.status === 201, "Register Student with 201 Created");
    assert(regStudentRes.data.data.user.role === "STUDENT", "User role is correctly set to STUDENT");
    studentId = regStudentRes.data.data.user.id;

    // 3. Duplicate Registration Prevention
    const dupRes = await makeRequest("POST", "/register", {
      email: studentEmail,
      password,
      fullName: "Duplicate User",
    });
    assert(dupRes.status === 409, "Prevent duplicate email registration with 409 Conflict");

    // 4. Admin and Recruiter Registration
    const regAdminRes = await makeRequest("POST", "/register", {
      email: adminEmail,
      password,
      fullName: "TPO Officer",
      role: "ADMIN",
    });
    assert(regAdminRes.status === 201, "Register Admin with 201 Created");
    adminAccessToken = regAdminRes.data.data.accessToken;

    const regRecruiterRes = await makeRequest("POST", "/register", {
      email: recruiterEmail,
      password,
      fullName: "Google HR",
      role: "RECRUITER",
      companyName: "Google India",
    });
    assert(regRecruiterRes.status === 201, "Register Recruiter with 201 Created");

    // 5. Authentication & Login
    console.log("\n[Test Suite 3: Login & Token Issuance]");
    const wrongPassRes = await makeRequest("POST", "/login", {
      email: studentEmail,
      password: "WrongPassword123#",
    });
    assert(wrongPassRes.status === 401, "Reject incorrect password with 401 Unauthorized");

    const loginRes = await makeRequest("POST", "/login", {
      email: studentEmail,
      password,
    });
    assert(loginRes.status === 200, "Successful login with 200 OK");
    assert(Boolean(loginRes.data.data.accessToken), "Access token issued");
    assert(Boolean(loginRes.data.data.refreshToken), "Refresh token issued");
    studentAccessToken = loginRes.data.data.accessToken;
    studentRefreshToken = loginRes.data.data.refreshToken;

    // 6. Protected Routes & Authentication Middleware
    console.log("\n[Test Suite 4: Authentication Middleware]");
    const unauthMeRes = await makeRequest("GET", "/me");
    assert(unauthMeRes.status === 401, "Block unauthenticated access to /me with 401");

    const authMeRes = await makeRequest("GET", "/me", null, {
      Authorization: `Bearer ${studentAccessToken}`,
    });
    assert(authMeRes.status === 200, "Allow authenticated access to /me with 200 OK");
    assert(authMeRes.data.data.user.email === studentEmail, "User context matches authenticated student");

    // 7. Role-Based Access Control (RBAC)
    console.log("\n[Test Suite 5: Role-Based Access Control (RBAC)]");
    const studentAccessStudentPortal = await makeRequest("GET", "/student-portal", null, {
      Authorization: `Bearer ${studentAccessToken}`,
    });
    assert(studentAccessStudentPortal.status === 200, "Student can access Student Portal");

    const studentAccessAdminPortal = await makeRequest("GET", "/admin-portal", null, {
      Authorization: `Bearer ${studentAccessToken}`,
    });
    assert(studentAccessAdminPortal.status === 403, "Student is blocked from Admin Portal with 403 Forbidden");

    const adminAccessAdminPortal = await makeRequest("GET", "/admin-portal", null, {
      Authorization: `Bearer ${adminAccessToken}`,
    });
    assert(adminAccessAdminPortal.status === 200, "Admin can access Admin Portal with 200 OK");

    // 8. Refresh Token Rotation
    console.log("\n[Test Suite 6: Refresh Token Rotation]");
    const refreshRes = await makeRequest("POST", "/refresh-token", {
      refreshToken: studentRefreshToken,
    });
    assert(refreshRes.status === 200, "Rotate refresh token with 200 OK");
    assert(Boolean(refreshRes.data.data.accessToken), "New access token received");
    const rotatedRefreshToken = refreshRes.data.data.refreshToken;
    assert(rotatedRefreshToken !== studentRefreshToken, "Rotated refresh token is different from old token");

    // Test Token Reuse Detection (Replay attack simulation)
    const reuseOldTokenRes = await makeRequest("POST", "/refresh-token", {
      refreshToken: studentRefreshToken,
    });
    assert(reuseOldTokenRes.status === 403, "Revoked token reuse detected with 403 Forbidden");

    // 9. Account Status Management (Admin Controls)
    console.log("\n[Test Suite 7: Account Status Management]");
    const suspendRes = await makeRequest("PATCH", `/users/${studentId}/status`, {
      status: "SUSPENDED",
    }, {
      Authorization: `Bearer ${adminAccessToken}`,
    });
    assert(suspendRes.status === 200, "Admin can suspend student account with 200 OK");

    // Suspended student tries to login
    const suspendedLoginRes = await makeRequest("POST", "/login", {
      email: studentEmail,
      password,
    });
    assert(suspendedLoginRes.status === 403, "Suspended account is blocked from login with 403 Forbidden");

    // 10. Logout
    console.log("\n[Test Suite 8: Logout]");
    const logoutRes = await makeRequest("POST", "/logout", {
      refreshToken: rotatedRefreshToken,
    });
    assert(logoutRes.status === 200, "Logout invalidates session with 200 OK");

    console.log("\n==================================================================");
    console.log("✓ ALL AUTHENTICATION & RBAC TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================================");
  } catch (error) {
    console.error("\n==================================================================");
    console.error("✗ TEST SUITE FAILED:", error.message);
    console.error("==================================================================");
    process.exit(1);
  }
}

runTests();

