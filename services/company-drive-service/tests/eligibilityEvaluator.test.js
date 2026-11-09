import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJobEligibility } from '../src/utils/eligibilityEvaluator.js';

const requirements = {
  minCgpa: 7.5,
  maxActiveBacklogs: 0,
  allowedBranches: ['CSE', 'ECE', 'EEE'],
  eligibleBatchYears: [2027],
};

function profile(overrides = {}) {
  return {
    btechCgpa: 8.5,
    branch: 'CSE',
    activeBacklogs: 0,
    batchYear: 2027,
    ...overrides,
  };
}

test('accepts numeric and numeric-string academic values', () => {
  const result = evaluateJobEligibility(requirements, profile({ btechCgpa: '9.22', batchYear: '2027' }));
  assert.equal(result.status, 'ELIGIBLE');
  assert.equal(result.eligible, true);
});

test('marks a student below the minimum CGPA as ineligible', () => {
  const result = evaluateJobEligibility(requirements, profile({ btechCgpa: '6.8' }));
  assert.equal(result.status, 'NOT_ELIGIBLE');
  assert.equal(result.criteria.cgpa.status, 'FAIL');
});

test('marks a student in an unlisted branch as ineligible', () => {
  const result = evaluateJobEligibility(requirements, profile({ branch: 'Mechanical Engineering' }));
  assert.equal(result.status, 'NOT_ELIGIBLE');
  assert.equal(result.criteria.branch.actual, 'MECH');
  assert.equal(result.criteria.branch.status, 'FAIL');
});

test('marks active backlogs above the configured maximum as ineligible', () => {
  const result = evaluateJobEligibility(requirements, profile({ activeBacklogs: 2 }));
  assert.equal(result.status, 'NOT_ELIGIBLE');
  assert.equal(result.criteria.activeBacklogs.status, 'FAIL');
});

test('returns insufficient data when a required value is missing', () => {
  const result = evaluateJobEligibility(requirements, profile({ activeBacklogs: undefined }));
  assert.equal(result.status, 'INSUFFICIENT_DATA');
  assert.equal(result.eligible, null);
  assert.equal(result.criteria.activeBacklogs.status, 'INSUFFICIENT_DATA');
});

test('does not interpret missing CGPA, branch, or graduation year as eligible', () => {
  const result = evaluateJobEligibility(requirements, {});
  assert.equal(result.status, 'INSUFFICIENT_DATA');
  assert.equal(result.criteria.cgpa.status, 'INSUFFICIENT_DATA');
  assert.equal(result.criteria.branch.status, 'INSUFFICIENT_DATA');
  assert.equal(result.criteria.graduationYear.status, 'INSUFFICIENT_DATA');
});

test('does not confuse PUC CGPA with a percentage value', () => {
  const result = evaluateJobEligibility(
    { minPucCgpa: 6 },
    { pucCgpa: undefined, twelfthPercentage: 95 }
  );
  assert.equal(result.status, 'INSUFFICIENT_DATA');
});

test('explains every failed configured criterion', () => {
  const result = evaluateJobEligibility(requirements, profile({
    btechCgpa: 6.8,
    branch: 'MECH',
    activeBacklogs: 2,
    batchYear: 2026,
  }));
  assert.equal(result.status, 'NOT_ELIGIBLE');
  assert.deepEqual(
    Object.values(result.criteria).filter((item) => item.status === 'FAIL').length,
    4
  );
  assert.equal(result.reasons.length, 4);
});
