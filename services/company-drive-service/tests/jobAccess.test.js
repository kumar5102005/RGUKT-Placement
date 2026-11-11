import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canManageCompanyJobs,
  getInternalRecruitmentAccess,
} from '../src/controllers/jobController.js';
import Company from '../src/models/Company.js';
import Job from '../src/models/Job.js';

const userId = 'recruiter-123';

test('company owner can manage company jobs', () => {
  assert.equal(canManageCompanyJobs({ registeredBy: userId }, userId), true);
});

test('active primary recruiter can manage company jobs', () => {
  assert.equal(canManageCompanyJobs({
    registeredBy: 'another-user',
    recruiters: [{ userId, role: 'PRIMARY', status: 'ACTIVE' }],
  }, userId), true);
});

test('secondary recruiter needs explicit job-management permission', () => {
  const company = {
    registeredBy: 'another-user',
    recruiters: [{ userId, role: 'SECONDARY', status: 'ACTIVE', canManageJobs: true }],
  };
  assert.equal(canManageCompanyJobs(company, userId), true);
  company.recruiters[0].canManageJobs = false;
  assert.equal(canManageCompanyJobs(company, userId), false);
});

test('inactive secondary recruiter cannot manage company jobs', () => {
  assert.equal(canManageCompanyJobs({
    registeredBy: 'another-user',
    recruiters: [{ userId, role: 'SECONDARY', status: 'INACTIVE', canManageJobs: true }],
  }, userId), false);
});

test('recruiter from another company cannot view an application resume', async () => {
  const originalFindById = Job.findById;
  const originalFindOne = Company.findOne;
  const jobCompanyId = 'company-a';
  Job.findById = () => ({
    select() {
      return this;
    },
    lean: async () => ({ companyId: jobCompanyId }),
  });
  Company.findOne = () => ({
    select() {
      return this;
    },
    lean: async () => ({
      _id: 'company-b',
      registeredBy: 'company-b-owner',
      recruiters: [{ userId: 'recruiter-b', status: 'ACTIVE', role: 'PRIMARY' }],
    }),
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

  try {
    await getInternalRecruitmentAccess(
      { params: { id: 'job-a', userId: 'recruiter-b' } },
      response
    );
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error.code, 'FORBIDDEN');
  } finally {
    Job.findById = originalFindById;
    Company.findOne = originalFindOne;
  }
});
