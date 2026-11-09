import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDriveCreation, validateDriveUpdate } from '../src/middleware/driveValidation.js';

function runValidator(validator, body) {
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
  validator({ body }, response, () => { continued = true; });
  return { response, continued };
}

function validDrive(recruitmentRounds) {
  return {
    title: 'Campus Recruitment',
    companyId: 'company-id',
    registrationWindow: { closeDate: '2027-01-01T00:00:00.000Z' },
    recruitmentRounds,
  };
}

function rounds(count) {
  return Array.from({ length: count }, (_, index) => ({
    roundNumber: index + 1,
    roundType: 'OTHER',
    name: `Selection stage ${index + 1}`,
    mode: 'ONLINE',
    durationMinutes: 45,
    status: 'PLANNED',
  }));
}

test('allows drives with two or five configured rounds', () => {
  for (const count of [2, 5]) {
    const { response, continued } = runValidator(validateDriveCreation, validDrive(rounds(count)));
    assert.equal(continued, true);
    assert.equal(response.statusCode, null);
  }
});

test('allows an explicit empty round list rather than creating defaults', () => {
  const { response, continued } = runValidator(validateDriveCreation, validDrive([]));
  assert.equal(continued, true);
  assert.equal(response.statusCode, null);
});

test('rejects gaps in sequence and invalid round duration during updates', () => {
  const changedRounds = rounds(2);
  changedRounds[1].roundNumber = 3;
  changedRounds[1].durationMinutes = 0;
  const { response, continued } = runValidator(validateDriveUpdate, { recruitmentRounds: changedRounds });
  assert.equal(continued, false);
  assert.equal(response.statusCode, 422);
  assert.ok(response.body.error.details.some((error) => error.field.endsWith('.roundNumber')));
  assert.ok(response.body.error.details.some((error) => error.field.endsWith('.durationMinutes')));
});
