import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAddRecruiter } from '../src/middleware/validation.js';

function validate(body) {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let continued = false;
  validateAddRecruiter({ body }, response, () => {
    continued = true;
  });
  return { response, continued };
}

test('accepts a boolean job-management permission when adding a recruiter', () => {
  const { response, continued } = validate({
    email: 'recruiter@example.com',
    canManageJobs: true,
  });
  assert.equal(continued, true);
  assert.equal(response.statusCode, null);
});

test('rejects a non-boolean job-management permission', () => {
  const { response, continued } = validate({
    email: 'recruiter@example.com',
    canManageJobs: 'true',
  });
  assert.equal(continued, false);
  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error.details[0].field, 'canManageJobs');
});
