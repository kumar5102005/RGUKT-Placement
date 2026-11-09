import assert from 'node:assert/strict';
import test from 'node:test';
import { validateJobCreation } from '../src/middleware/jobValidation.js';

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
  validateJobCreation(
    { body, user: { role: 'RECRUITER' } },
    response,
    () => {
      continued = true;
    }
  );
  return { response, continued };
}

function validJob(selectionRounds) {
  return {
    title: 'Software Engineer',
    description: 'Build software for campus placement.',
    applicationDeadline: '2027-01-01T00:00:00.000Z',
    eligibility: {},
    selectionRounds,
  };
}

test('accepts sequential rounds with chronological schedules', () => {
  const { response, continued } = validate(validJob([
    { roundNumber: 1, name: 'Assessment', scheduledDate: '2026-11-01T09:00:00.000Z' },
    { roundNumber: 2, name: 'Interview', scheduledDate: '2026-11-02T09:00:00.000Z' },
  ]));

  assert.equal(continued, true);
  assert.equal(response.statusCode, null);
});

test('rejects non-sequential rounds and schedules out of order', () => {
  const { response, continued } = validate(validJob([
    { roundNumber: 2, name: 'Assessment', scheduledDate: '2026-11-02T09:00:00.000Z' },
    { roundNumber: 3, name: 'Interview', scheduledDate: '2026-11-01T09:00:00.000Z' },
  ]));

  assert.equal(continued, false);
  assert.equal(response.statusCode, 422);
  assert.ok(response.body.error.details.some((error) => error.field.endsWith('.roundNumber')));
  assert.ok(response.body.error.details.some((error) => error.field.endsWith('.scheduledDate')));
});

test('rejects invalid eligibility thresholds', () => {
  const { response, continued } = validate({
    ...validJob([]),
    eligibility: {
      minTenthPercentage: 101,
      minTwelfthPucCgpa: 10.1,
      maxHistoryBacklogs: -1,
    },
  });

  assert.equal(continued, false);
  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error.details.length, 3);
});
