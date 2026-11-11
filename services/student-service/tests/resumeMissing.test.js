import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { StudentProfile } from '../src/models/StudentProfile.js';
import { ResumeDocument } from '../src/models/ResumeDocument.js';

const resumeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'rgukt-resume-test-'));
process.env.RESUME_UPLOAD_DIR = resumeDirectory;

const {
  getInternalResume,
  getInternalResumeReference,
} = await import('../src/controllers/studentController.js');
const originalFindOne = StudentProfile.findOne;
const originalProfileFindById = StudentProfile.findById;
const originalResumeFindOne = ResumeDocument.findOne;
const originalResumeFindOneAndUpdate = ResumeDocument.findOneAndUpdate;
const originalResumeCreate = ResumeDocument.create;

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

after(async () => {
  StudentProfile.findOne = originalFindOne;
  StudentProfile.findById = originalProfileFindById;
  ResumeDocument.findOne = originalResumeFindOne;
  ResumeDocument.findOneAndUpdate = originalResumeFindOneAndUpdate;
  ResumeDocument.create = originalResumeCreate;
  await fs.rm(resumeDirectory, { recursive: true, force: true });
});

test('a referenced resume version missing from storage returns a distinct 404 code', async () => {
  const studentUserId = 'student-account-id';
  const requestedFileName = 'missing-historical-resume.pdf';
  ResumeDocument.findOne = async () => null;
  StudentProfile.findOne = async (query) => {
    assert.deepEqual(query, { userId: studentUserId });
    return {
      userId: studentUserId,
      resumeFileName: 'current-resume.pdf',
      resumeVersions: [{
        fileName: requestedFileName,
        originalName: 'historical-resume.pdf',
        mimeType: 'application/pdf',
      }],
    };
  };

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await getInternalResume(
    { params: { id: studentUserId }, query: { fileName: requestedFileName } },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'RESUME_FILE_MISSING');
});

test('resume reference validation accepts only a profile-listed file that exists in storage', async () => {
  const studentUserId = 'student-account-id';
  const fileName = 'existing-resume.pdf';
  await fs.writeFile(path.join(resumeDirectory, fileName), '%PDF-test');
  ResumeDocument.findOne = async () => null;
  ResumeDocument.findOneAndUpdate = async () => ({
    _id: '65f1a2b3c4d5e6f708192a3e',
  });
  StudentProfile.findOne = async () => ({
    userId: studentUserId,
    resumeFileName: 'current-resume.pdf',
    resumeVersions: [{
      fileName,
      originalName: 'resume.pdf',
      mimeType: 'application/pdf',
    }],
  });

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await getInternalResumeReference(
    { params: { id: studentUserId }, query: { fileName } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.available, true);
  assert.equal(response.body.data.storageKey, fileName);
  assert.equal(response.body.data.documentId, '65f1a2b3c4d5e6f708192a3e');
});

test('resume reference validation rejects a missing historical file', async () => {
  const studentUserId = 'student-account-id';
  const fileName = 'missing-historical-resume.pdf';
  ResumeDocument.findOne = async () => null;
  StudentProfile.findOne = async () => ({
    userId: studentUserId,
    resumeFileName: 'current-resume.pdf',
    resumeVersions: [{
      fileName,
      originalName: 'historical-resume.pdf',
      mimeType: 'application/pdf',
    }],
  });

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await getInternalResumeReference(
    { params: { id: studentUserId }, query: { fileName } },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error.code, 'RESUME_FILE_MISSING');
});

test('uploads create immutable, reusable versions and historical documents keep their exact bytes', async () => {
  const { uploadResumeFile } = await import('../src/controllers/studentController.js');
  const userId = 'student-lifecycle-user';
  const profile = {
    userId,
    studentId: 'o123456',
    fullName: 'Test Student',
    email: 'student@example.test',
    resumeVersions: [],
    async save() {},
  };
  const documents = [];
  let nextId = 1;
  StudentProfile.findOne = async () => profile;
  ResumeDocument.findOne = async (query) => documents.find((document) =>
    (!query.userId || document.userId === query.userId) &&
    (!query.storageKey || document.storageKey === query.storageKey) &&
    (!query.sha256 || document.sha256 === query.sha256) &&
    (!query.size || document.size === query.size) &&
    (!query._id || document._id === String(query._id))
  ) || null;
  ResumeDocument.create = async (fields) => {
    const document = { ...fields, _id: `65f1a2b3c4d5e6f708192a${String(nextId++).padStart(2, '0')}` };
    documents.push(document);
    return document;
  };

  const upload = async (originalname, content) => {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await uploadResumeFile({
      file: {
        originalname,
        mimetype: 'application/pdf',
        buffer: content,
        size: content.length,
      },
      user: { id: userId, studentId: 'o123456', email: 'student@example.test' },
    }, response);
    assert.equal(response.statusCode, 200);
    return response.body.data.resumeDocumentId;
  };

  const invalidUploadResponse = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await uploadResumeFile({
    file: {
      originalname: 'not-a-pdf.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('not a PDF'),
      size: 9,
    },
    user: { id: userId, studentId: 'o123456', email: 'student@example.test' },
  }, invalidUploadResponse);
  assert.equal(invalidUploadResponse.statusCode, 400);
  assert.equal(invalidUploadResponse.body.error.code, 'FILE_CONTENT_MISMATCH');

  const versionOneBytes = createPdf('resume-v1');
  const versionTwoBytes = createPdf('resume-v2');
  const versionThreeBytes = createPdf('resume-v3');
  const versionOneId = await upload('Resume_V1.pdf', versionOneBytes);
  const versionOneKey = profile.resumeFileName;
  const applicationOneSnapshot = { documentId: versionOneId, storageKey: versionOneKey };
  const versionTwoId = await upload('Resume_V2.pdf', versionTwoBytes);
  const versionTwoKey = profile.resumeFileName;
  const applicationTwoSnapshot = { documentId: versionTwoId, storageKey: versionTwoKey };
  await upload('Resume_V3.pdf', versionThreeBytes);
  await upload('Resume_V1-copy.pdf', versionOneBytes);

  assert.equal(documents.length, 3);
  assert.notEqual(applicationOneSnapshot.documentId, applicationTwoSnapshot.documentId);
  assert.notEqual(applicationOneSnapshot.storageKey, applicationTwoSnapshot.storageKey);
  const restartedServiceRead = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      'import { resumeStorage } from "./src/storage/resumeStorage.js"; const stream = await resumeStorage.getObject(process.argv[1]); const chunks = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk)); process.stdout.write(Buffer.concat(chunks).toString("base64"));',
      applicationOneSnapshot.storageKey,
    ],
    {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
      env: {
        ...process.env,
        RESUME_STORAGE_PROVIDER: 'local',
        RESUME_UPLOAD_DIR: resumeDirectory,
      },
      encoding: 'utf8',
    }
  );
  assert.equal(restartedServiceRead.status, 0, restartedServiceRead.stderr);
  assert.deepEqual(
    Buffer.from(restartedServiceRead.stdout, 'base64'),
    versionOneBytes
  );

  for (const [snapshot, expectedBytes] of [
    [applicationOneSnapshot, versionOneBytes],
    [applicationTwoSnapshot, versionTwoBytes],
  ]) {
    const chunks = [];
    const response = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    response.statusCode = 200;
    response.headers = {};
    response.set = function set(headers) {
      Object.assign(this.headers, headers);
      return this;
    };
    response.status = function status(code) {
      this.statusCode = code;
      return this;
    };
    response.json = function json(body) {
      this.body = body;
      return this;
    };
    await new Promise((resolve, reject) => {
      response.once('finish', resolve);
      response.once('error', reject);
      import('../src/controllers/studentController.js').then(({ getInternalResume }) =>
        getInternalResume({
          params: { id: userId },
          query: { documentId: snapshot.documentId },
        }, response).catch(reject)
      );
    });
    assert.deepEqual(Buffer.concat(chunks), expectedBytes);
  }
});
