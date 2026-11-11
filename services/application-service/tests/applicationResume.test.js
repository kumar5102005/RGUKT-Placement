import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { afterEach, test } from 'node:test';
import { Writable } from 'node:stream';
import express from 'express';
import jwt from 'jsonwebtoken';
import Application from '../src/models/Application.js';

process.env.SERVICE_API_KEY = 'test-service-key';
process.env.COMPANY_DRIVE_SERVICE_URL = 'http://company-drive.test';
process.env.STUDENT_SERVICE_URL = 'http://student-service.test';
process.env.JWT_SECRET = 'test-jwt-secret';

const { getApplicationResume } = await import('../src/controllers/applicationController.js');
const { applyForJob } = await import('../src/controllers/applicationController.js');
const { default: applicationRoutes } = await import('../src/routes/applicationRoutes.js');
const originalFindById = Application.findById;
const originalFindOne = Application.findOne;
const originalSave = Application.prototype.save;
const originalFetch = globalThis.fetch;

afterEach(() => {
  Application.findById = originalFindById;
  Application.findOne = originalFindOne;
  Application.prototype.save = originalSave;
  globalThis.fetch = originalFetch;
});

function createApplication(overrides = {}) {
  return {
    _id: '65f1a2b3c4d5e6f708192a3b',
    jobId: '65f1a2b3c4d5e6f708192a3c',
    companyId: '65f1a2b3c4d5e6f708192a3d',
    studentUserId: 'student-account-id',
    studentId: 'O180123',
    resumeFileName: '',
    resumeUrl: '',
    resumeOriginalName: '',
    resumeMimeType: '',
    ...overrides,
  };
}

function createResponse() {
  const chunks = [];
  const response = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  response.statusCode = 200;
  response.headers = {};
  response.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  response.json = function json(body) {
    this.body = body;
    return this;
  };
  response.set = function set(headers) {
    if (typeof headers === 'string') {
      this.headers[headers] = arguments[1];
    } else {
      Object.assign(this.headers, headers);
    }
    return this;
  };
  response.bodyBytes = () => Buffer.concat(chunks);
  return response;
}

function stubApplication(application) {
  Application.findById = () => ({ lean: async () => application });
}

function validApplicationSubmission() {
  const jobId = '65f1a2b3c4d5e6f708192a3c';
  return {
    jobId,
    studentUserId: 'student-account-id',
    job: {
      jobId,
      companyId: '65f1a2b3c4d5e6f708192a3d',
      companyName: 'Example Company',
      title: 'Engineer',
      status: 'ACTIVE',
      applicationDeadline: new Date(Date.now() + 60_000).toISOString(),
      selectionRounds: [],
    },
    student: {
      userId: 'student-account-id',
      studentId: 'O180123',
      fullName: 'Test Student',
      email: 'student@example.test',
      branch: 'CSE',
      btechCgpa: 8,
      activeBacklogs: 0,
      batchYear: 2026,
      technicalSkills: [],
      nonTechnicalSkills: [],
      resumeDocumentId: 'student-document-id',
      resumeStorageKey: 'student-version.pdf',
      resumeFileName: 'student-version.pdf',
      resumeOriginalName: 'resume.pdf',
      resumeMimeType: 'application/pdf',
    },
    evaluation: { status: 'ELIGIBLE' },
  };
}

function createPdf(text) {
  const stream = `BT /F1 12 Tf 10 10 Td (${text}) Tj ET\n`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let document = Buffer.from('%PDF-1.4\n');
  const offsets = [0];
  for (const object of objects) {
    offsets.push(document.length);
    document = Buffer.concat([document, Buffer.from(object)]);
  }
  const crossReferenceOffset = document.length;
  const crossReference = [
    'xref\n0 6\n0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
  ].join('');
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF\n`;
  return Buffer.concat([document, Buffer.from(crossReference + trailer)]);
}

test('new application saves the validated immutable resume document reference', async () => {
  const submission = validApplicationSubmission();
  Application.findOne = async () => null;
  let savedApplication;
  Application.prototype.save = async function save() {
    savedApplication = this;
  };
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/check-eligibility')) {
      return Response.json({
        success: true,
        data: {
          job: submission.job,
          student: submission.student,
          evaluation: submission.evaluation,
        },
      });
    }
    return Response.json({
      success: true,
      data: {
        available: true,
        ownerUserId: submission.student.userId,
        documentId: 'validated-resume-document-id',
        storageKey: 'student-version.pdf',
        originalName: 'resume.pdf',
        mimeType: 'application/pdf',
        size: 12,
        uploadedAt: '2026-11-09T10:26:15.814Z',
      },
    });
  };

  const response = createResponse();
  await applyForJob(
    {
      body: { jobId: submission.jobId },
      user: { id: submission.studentUserId, role: 'STUDENT' },
    },
    response
  );

  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  assert.equal(savedApplication.resumeFileName, submission.student.resumeFileName);
  assert.equal(savedApplication.resumeDocumentId, 'validated-resume-document-id');
  assert.equal(savedApplication.resumeStorageKey, 'student-version.pdf');
  assert.equal(savedApplication.resumeOriginalName, 'resume.pdf');
  assert.ok(savedApplication.resumeSnapshotAt instanceof Date);
  assert.match(calls[1], /resume-reference\?documentId=student-document-id$/);
});

test('new application is rejected when its selected resume reference is missing from storage', async () => {
  const submission = validApplicationSubmission();
  Application.findOne = async () => null;
  let saveCalled = false;
  Application.prototype.save = async function save() {
    saveCalled = true;
  };
  globalThis.fetch = async (url) => {
    if (String(url).includes('/check-eligibility')) {
      return Response.json({
        success: true,
        data: {
          job: submission.job,
          student: submission.student,
          evaluation: submission.evaluation,
        },
      });
    }
    return Response.json({
      success: false,
      error: { code: 'RESUME_FILE_MISSING', message: 'No longer available.' },
    }, { status: 404 });
  };

  const response = createResponse();
  await applyForJob(
    {
      body: { jobId: submission.jobId },
      user: { id: submission.studentUserId, role: 'STUDENT' },
    },
    response
  );

  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error.code, 'RESUME_UNAVAILABLE');
  assert.equal(saveCalled, false);
});

test('applications keep and download the exact submitted resume after the profile changes', async () => {
  const uploadedDocuments = new Map([
    ['resume-v1-id', {
      storageKey: 'resume-v1.pdf',
      originalName: 'Resume_V1.pdf',
      bytes: createPdf('resume-v1'),
    }],
    ['resume-v2-id', {
      storageKey: 'resume-v2.pdf',
      originalName: 'Resume_V2.pdf',
      bytes: createPdf('resume-v2'),
    }],
  ]);
  const savedApplications = [];
  let currentStudent = {
    ...validApplicationSubmission().student,
    resumeDocumentId: 'resume-v1-id',
    resumeStorageKey: 'resume-v1.pdf',
    resumeFileName: 'resume-v1.pdf',
  };
  const jobs = new Map([
    ['65f1a2b3c4d5e6f708192a3c', {
      jobId: '65f1a2b3c4d5e6f708192a3c',
      companyId: '65f1a2b3c4d5e6f708192a3d',
      companyName: 'Company A',
      title: 'Engineer A',
      status: 'ACTIVE',
      applicationDeadline: new Date(Date.now() + 60_000).toISOString(),
      selectionRounds: [],
    }],
    ['65f1a2b3c4d5e6f708192a3f', {
      jobId: '65f1a2b3c4d5e6f708192a3f',
      companyId: '65f1a2b3c4d5e6f708192a40',
      companyName: 'Company B',
      title: 'Engineer B',
      status: 'ACTIVE',
      applicationDeadline: new Date(Date.now() + 60_000).toISOString(),
      selectionRounds: [],
    }],
  ]);
  Application.findOne = async () => null;
  Application.prototype.save = async function save() {
    savedApplications.push(this);
  };
  Application.findById = (id) => ({
    lean: async () => savedApplications.find((application) => String(application._id) === String(id)),
  });
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = new URL(String(url));
    if (requestUrl.pathname.endsWith('/check-eligibility')) {
      const job = jobs.get(requestUrl.pathname.split('/')[5]);
      return Response.json({
        success: true,
        data: { job, student: currentStudent, evaluation: { status: 'ELIGIBLE' } },
      });
    }
    if (requestUrl.pathname.endsWith('/resume-reference')) {
      const documentId = requestUrl.searchParams.get('documentId');
      const document = uploadedDocuments.get(documentId);
      return Response.json({
        success: true,
        data: {
          available: true,
          ownerUserId: currentStudent.userId,
          documentId,
          storageKey: document.storageKey,
          originalName: document.originalName,
          mimeType: 'application/pdf',
          size: document.bytes.length,
          uploadedAt: new Date().toISOString(),
        },
      });
    }
    if (requestUrl.pathname.includes('/recruitment-access/')) {
      const application = savedApplications.find((candidate) =>
        String(candidate.jobId) === requestUrl.pathname.split('/')[5]
      );
      return Response.json({
        success: true,
        data: { companyId: application.companyId, canView: true, canManage: false },
      });
    }
    const documentId = requestUrl.searchParams.get('documentId');
    const document = uploadedDocuments.get(documentId);
    return new Response(document.bytes, {
      headers: { 'Content-Type': 'application/pdf' },
    });
  };

  const submit = async (jobId) => {
    const response = createResponse();
    await applyForJob({
      body: { jobId },
      user: { id: currentStudent.userId, role: 'STUDENT' },
    }, response);
    assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  };
  await submit('65f1a2b3c4d5e6f708192a3c');
  currentStudent = {
    ...currentStudent,
    resumeDocumentId: 'resume-v2-id',
    resumeStorageKey: 'resume-v2.pdf',
    resumeFileName: 'resume-v2.pdf',
  };
  await submit('65f1a2b3c4d5e6f708192a3f');

  assert.equal(savedApplications.length, 2);
  assert.equal(savedApplications[0].resumeDocumentId, 'resume-v1-id');
  assert.equal(savedApplications[1].resumeDocumentId, 'resume-v2-id');

  currentStudent = {
    ...currentStudent,
    resumeDocumentId: 'resume-v3-id',
    resumeStorageKey: 'resume-v3.pdf',
    resumeFileName: 'resume-v3.pdf',
  };
  for (const [index, documentId] of ['resume-v1-id', 'resume-v2-id'].entries()) {
    const response = createResponse();
    const finished = once(response, 'finish');
    await getApplicationResume({
      params: { id: String(savedApplications[index]._id) },
      user: { id: `recruiter-${index}`, role: 'RECRUITER' },
    }, response);
    await finished;
    assert.deepEqual(response.bodyBytes(), uploadedDocuments.get(documentId).bytes);
  }
});

test('new application requires an uploaded resume snapshot', async () => {
  const submission = validApplicationSubmission();
  submission.student.resumeDocumentId = '';
  submission.student.resumeStorageKey = '';
  submission.student.resumeFileName = '';
  Application.findOne = async () => null;
  let saveCalled = false;
  Application.prototype.save = async function save() {
    saveCalled = true;
  };
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json({
      success: true,
      data: {
        job: submission.job,
        student: submission.student,
        evaluation: submission.evaluation,
      },
    });
  };

  const response = createResponse();
  await applyForJob(
    {
      body: { jobId: submission.jobId },
      user: { id: submission.studentUserId, role: 'STUDENT' },
    },
    response
  );

  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error.code, 'RESUME_REQUIRED');
  assert.equal(calls.length, 1);
  assert.equal(saveCalled, false);
});

function makeHttpRequest(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    request.on('error', reject);
  });
}

test('application with no saved resume snapshot does not read the student current resume', async () => {
  const application = createApplication({
    resumeUrl: '/api/v1/applications/65f1a2b3c4d5e6f708192a3b/resume',
  });
  stubApplication(application);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('http://company-drive.test/')) {
      return Response.json({
        success: true,
        data: { companyId: application.companyId, canView: true, canManage: false },
      });
    }
    throw new Error('The student current resume must not be requested without an application snapshot.');
  };

  const response = createResponse();
  await getApplicationResume(
    { params: { id: application._id }, user: { id: 'recruiter-a', role: 'RECRUITER' } },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'APPLICATION_RESUME_UNAVAILABLE');
  assert.equal(calls.length, 1);
});

test('legacy application URL is treated only as its recorded historical key', async () => {
  const application = createApplication({
    resumeUrl: '/uploads/resumes/legacy-submitted-resume.pdf',
  });
  stubApplication(application);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('http://company-drive.test/')) {
      return Response.json({
        success: true,
        data: { companyId: application.companyId, canView: true, canManage: false },
      });
    }
    return new Response(Buffer.from('%PDF-legacy-original'), {
      headers: { 'Content-Type': 'application/pdf' },
    });
  };

  const response = createResponse();
  const finished = once(response, 'finish');
  await getApplicationResume(
    { params: { id: application._id }, user: { id: 'recruiter-a', role: 'RECRUITER' } },
    response
  );
  await finished;

  assert.equal(response.statusCode, 200);
  assert.match(calls[1], /[?&]fileName=legacy-submitted-resume\.pdf$/);
  assert.equal(response.bodyBytes().toString(), '%PDF-legacy-original');
});

test('recruiter receives the resume version saved with the application when available', async () => {
  const application = createApplication({
    resumeFileName: 'student-version.pdf',
    resumeOriginalName: 'submitted-resume.pdf',
  });
  stubApplication(application);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('http://company-drive.test/')) {
      return Response.json({
        success: true,
        data: { companyId: application.companyId, canView: true, canManage: false },
      });
    }
    return new Response(Buffer.from('%PDF-submitted-resume'), {
      headers: { 'Content-Type': 'application/pdf' },
    });
  };

  const response = createResponse();
  const finished = once(response, 'finish');
  await getApplicationResume(
    { params: { id: application._id }, user: { id: 'recruiter-a', role: 'RECRUITER' } },
    response
  );
  await finished;

  assert.equal(response.statusCode, 200);
  assert.match(calls[1], /[?&]fileName=student-version\.pdf$/);
  assert.equal(response.bodyBytes().toString(), '%PDF-submitted-resume');
});

test('a missing application-time file returns unavailable without substituting current resume', async () => {
  const application = createApplication({
    resumeFileName: 'missing-historical-version.pdf',
    resumeOriginalName: 'submitted-resume.pdf',
  });
  stubApplication(application);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('http://company-drive.test/')) {
      return Response.json({
        success: true,
        data: { companyId: application.companyId, canView: true, canManage: false },
      });
    }
    if (String(url).includes('?fileName=')) {
      return Response.json({
        success: false,
        error: { code: 'RESUME_FILE_MISSING', message: 'The stored resume version is no longer available.' },
      }, { status: 404 });
    }
    return new Response(Buffer.from('%PDF-current-student-resume'), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="current-resume.pdf"',
      },
    });
  };

  const response = createResponse();
  await getApplicationResume(
    { params: { id: application._id }, user: { id: 'recruiter-a', role: 'RECRUITER' } },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'RESUME_FILE_MISSING');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /[?&]fileName=missing-historical-version\.pdf$/);
});

test('an unrecorded application resume reference does not fall back to another profile resume', async () => {
  const application = createApplication({
    resumeFileName: 'unrecorded-resume.pdf',
  });
  stubApplication(application);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('http://company-drive.test/')) {
      return Response.json({
        success: true,
        data: { companyId: application.companyId, canView: true, canManage: false },
      });
    }
    return Response.json({
      success: false,
      error: { code: 'RESUME_NOT_FOUND', message: 'Resume file was not found.' },
    }, { status: 404 });
  };

  const response = createResponse();
  await getApplicationResume(
    { params: { id: application._id }, user: { id: 'recruiter-a', role: 'RECRUITER' } },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'RESUME_NOT_FOUND');
  assert.equal(calls.length, 2);
});

test('missing job is reported truthfully after verifying recruiter company membership', async () => {
  const application = createApplication();
  stubApplication(application);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/recruitment-access/')) {
      return Response.json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting not found.' },
      }, { status: 404 });
    }
    return Response.json({
      success: true,
      data: { companyId: application.companyId },
    });
  };

  const response = createResponse();
  await getApplicationResume(
    { params: { id: application._id }, user: { id: 'recruiter-a', role: 'RECRUITER' } },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'APPLICATION_JOB_UNAVAILABLE');
  assert.equal(calls.length, 2);
});

test('missing job does not reveal the application to a recruiter from another company', async () => {
  const application = createApplication();
  stubApplication(application);
  globalThis.fetch = async (url) => {
    if (String(url).includes('/recruitment-access/')) {
      return Response.json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting not found.' },
      }, { status: 404 });
    }
    return Response.json({
      success: true,
      data: { companyId: 'another-company' },
    });
  };

  const response = createResponse();
  await getApplicationResume(
    { params: { id: application._id }, user: { id: 'recruiter-b', role: 'RECRUITER' } },
    response
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('recruiter from another company is denied before the student resume is requested', async () => {
  const application = createApplication();
  stubApplication(application);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Recruiter is not authorized for this job.' },
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const response = createResponse();
  await getApplicationResume(
    { params: { id: application._id }, user: { id: 'recruiter-b', role: 'RECRUITER' } },
    response
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.equal(calls.length, 1);
});

test('invalid application identifiers return a client error without backend lookups', async () => {
  let lookupCalled = false;
  Application.findById = () => {
    lookupCalled = true;
    throw new Error('Application lookup must not run for invalid identifiers.');
  };

  const response = createResponse();
  await getApplicationResume(
    { params: { id: 'not-an-object-id' }, user: { id: 'recruiter-a', role: 'RECRUITER' } },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.code, 'INVALID_ID');
  assert.equal(lookupCalled, false);
});

test('application resume endpoint rejects missing auth and streams PDF for Bearer-authenticated recruiter', async () => {
  const application = createApplication({
    resumeFileName: 'resume.pdf',
    resumeOriginalName: 'student-resume.pdf',
  });
  stubApplication(application);
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('http://company-drive.test/')) {
      return Response.json({
        success: true,
        data: { companyId: application.companyId, canView: true, canManage: false },
      });
    }
    return new Response(Buffer.from('%PDF-authenticated-resume'), {
      headers: { 'Content-Type': 'application/pdf' },
    });
  };

  const app = express();
  app.use('/api/v1/applications', applicationRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const { port } = server.address();
    const endpoint = `/api/v1/applications/${application._id}/resume`;
    const unauthenticated = await makeHttpRequest(port, endpoint);
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(JSON.parse(unauthenticated.body.toString()).error.code, 'NO_TOKEN');

    const bearerToken = jwt.sign(
      { id: 'recruiter-a', role: 'RECRUITER' },
      process.env.JWT_SECRET
    );
    const authenticated = await makeHttpRequest(port, endpoint, {
      Authorization: `Bearer ${bearerToken}`,
    });

    assert.equal(authenticated.statusCode, 200);
    assert.equal(authenticated.headers['content-type'], 'application/pdf');
    assert.equal(authenticated.body.toString(), '%PDF-authenticated-resume');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
