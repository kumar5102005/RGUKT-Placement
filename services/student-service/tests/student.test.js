/**
 * RGUKT Ongole Placement Hub - Student Management Service Test Suite
 * Run with: node tests/student.test.js
 */

import http from "node:http";
import jwt from "jsonwebtoken";

const BASE_URL = process.env.TEST_STUDENT_URL || "http://localhost:4002";
const JWT_SECRET = process.env.JWT_SECRET || "rgukt_super_secure_jwt_secret_token_2026_dev_key";
const SERVICE_API_KEY = process.env.SERVICE_API_KEY || "rgukt_placement_internal_secret_key_2026";

function generateTestToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });
}

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
  console.log("Starting RGUKT Ongole Placement Hub Student Service Tests");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================================");

  const studentUser = {
    id: "6724a1b0c9e0a12345678001",
    studentId: "O180555",
    fullName: "K. Sai Kumar",
    email: "o180555@rguktong.ac.in",
    role: "STUDENT",
    status: "ACTIVE",
  };

  const adminUser = {
    id: "6724a1b0c9e0a12345678999",
    fullName: "TPO Officer",
    email: "tpo@rguktong.ac.in",
    role: "ADMIN",
    status: "ACTIVE",
  };

  const studentToken = generateTestToken(studentUser);
  const adminToken = generateTestToken(adminUser);

  try {
    // 1. Health Check
    console.log("\n[Test Suite 1: Service Health]");
    const healthRes = await makeRequest("GET", "/health");
    assert(healthRes.status === 200, "Student Service health endpoint returns 200 OK");
    assert(healthRes.data.service === "student-service", "Service identifier is student-service");

    // 2. Initial Profile Fetch (Auto-generates draft)
    console.log("\n[Test Suite 2: Profile Retrieval & Auto-Draft]");
    const getProfileRes = await makeRequest("GET", "/profile", null, {
      Authorization: `Bearer ${studentToken}`,
    });
    assert(getProfileRes.status === 200, "Retrieve student profile returns 200 OK");
    assert(getProfileRes.data.data.profile.studentId === studentUser.studentId, "Profile matches studentId");

    // 3. Update Profile (Academics, Skills, Projects)
    console.log("\n[Test Suite 3: Profile Update & Completion Calculation]");
    const updatePayload = {
      fullName: "K. Sai Kumar",
      phone: "+91 9876543210",
      gender: "MALE",
      branch: "CSE",
      batchYear: 2026,
      tenthPercentage: 92.5,
      pucCgpa: 9.4,
      btechCgpa: 8.85,
      activeBacklogs: 0,
      backlogHistory: 0,
      semesters: [
        { semesterNumber: 1, sgpa: 8.9, creditsCompleted: 22, hasBacklog: false },
        { semesterNumber: 2, sgpa: 8.8, creditsCompleted: 24, hasBacklog: false },
        { semesterNumber: 3, sgpa: 8.85, creditsCompleted: 23, hasBacklog: false },
      ],
      technicalSkills: ["JavaScript", "React", "Node.js", "MongoDB", "Docker", "Tailwind CSS"],
      nonTechnicalSkills: ["Problem Solving", "Team Leadership", "Communication"],
      projects: [
        {
          title: "Campus Placement Portal",
          description: "Full-stack distributed recruitment platform for RGUKT Ongole.",
          technologies: ["React", "Express", "MongoDB", "Docker"],
          githubUrl: "https://github.com/saikumar/placement-portal",
        },
      ],
      certifications: [
        {
          name: "AWS Certified Cloud Practitioner",
          issuingOrganization: "Amazon Web Services",
          credentialUrl: "https://aws.amazon.com/verification/123",
        },
      ],
      linkedinUrl: "https://linkedin.com/in/sai-kumar",
      githubUrl: "https://github.com/sai-kumar",
    };

    const updateRes = await makeRequest("PUT", "/profile", updatePayload, {
      Authorization: `Bearer ${studentToken}`,
    });
    assert(updateRes.status === 200, "Update profile returns 200 OK");
    const updatedProfile = updateRes.data.data.profile;
    assert(updatedProfile.btechCgpa === 8.85, "B.Tech CGPA updated to 8.85");
    assert(updatedProfile.technicalSkills.length >= 5, "Technical skills saved");
    assert(updatedProfile.completionPercentage >= 70, `Profile completion calculated correctly (${updatedProfile.completionPercentage}%)`);

    // 4. Academic Eligibility Check
    console.log("\n[Test Suite 4: Academic Eligibility Gatekeeper]");
    // Eligible criteria
    const eligibleCheckRes = await makeRequest(
      "GET",
      "/eligibility-check?minCgpa=7.5&allowedBranches=CSE,ECE&maxBacklogs=0&eligibleBatchYear=2026",
      null,
      { Authorization: `Bearer ${studentToken}` }
    );
    assert(eligibleCheckRes.status === 200, "Eligibility check endpoint returns 200 OK");
    assert(eligibleCheckRes.data.data.isEligible === true, "Student is evaluated as ELIGIBLE for drive");

    // Ineligible criteria (Cutoff CGPA 9.0 > student's 8.85)
    const ineligibleCheckRes = await makeRequest(
      "GET",
      "/eligibility-check?minCgpa=9.0&allowedBranches=CSE&maxBacklogs=0",
      null,
      { Authorization: `Bearer ${studentToken}` }
    );
    assert(ineligibleCheckRes.data.data.isEligible === false, "Student evaluated as INELIGIBLE when CGPA is below cutoff");
    assert(ineligibleCheckRes.data.data.checks.cgpaEligible === false, "CGPA check correctly flagged as false");

    // 5. Administrator Student Search
    console.log("\n[Test Suite 5: Administrator Search & Multi-Filters]");
    const searchRes = await makeRequest(
      "GET",
      "/search?branch=CSE&minCgpa=8.0&maxBacklogs=0",
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(searchRes.status === 200, "Admin can search students with 200 OK");
    assert(Array.isArray(searchRes.data.data.students), "Search returns an array of students");

    // Unauthorized access to search (Student attempting admin endpoint)
    const unauthorizedSearchRes = await makeRequest("GET", "/search", null, {
      Authorization: `Bearer ${studentToken}`,
    });
    assert(unauthorizedSearchRes.status === 403, "Student is blocked from search endpoint with 403 Forbidden");

    // 6. Administrator Profile Verification
    console.log("\n[Test Suite 6: TPO Verification Workflow]");
    const verifyRes = await makeRequest(
      "PATCH",
      `/${studentUser.studentId}/verify`,
      {
        verificationStatus: "VERIFIED",
        verificationNotes: "All semester grade cards and credentials verified by TPO.",
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(verifyRes.status === 200, "Admin marks student as VERIFIED with 200 OK");
    assert(verifyRes.data.data.profile.verificationStatus === "VERIFIED", "Status successfully updated to VERIFIED");

    // 7. Internal Service Synchronous Query
    console.log("\n[Test Suite 7: Internal Service-to-Service Query]");
    const internalRes = await makeRequest(
      "GET",
      `/internal/${studentUser.studentId}`,
      null,
      { "x-service-key": SERVICE_API_KEY }
    );
    assert(internalRes.status === 200, "Internal query returns 200 OK with x-service-key");
    assert(internalRes.data.data.studentId === studentUser.studentId, "Internal snapshot contains studentId");
    assert(internalRes.data.data.btechCgpa === 8.85, "Internal snapshot contains accurate CGPA");

    // Invalid service key
    const invalidKeyRes = await makeRequest(
      "GET",
      `/internal/${studentUser.studentId}`,
      null,
      { "x-service-key": "invalid-key" }
    );
    assert(invalidKeyRes.status === 403, "Reject unauthorized internal service call with 403");

    console.log("\n==================================================================");
    console.log("✓ ALL STUDENT MANAGEMENT TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================================");
  } catch (error) {
    console.error("\n==================================================================");
    console.error("✗ TEST SUITE FAILED:", error.message);
    console.error("==================================================================");
    process.exit(1);
  }
}

runTests();

