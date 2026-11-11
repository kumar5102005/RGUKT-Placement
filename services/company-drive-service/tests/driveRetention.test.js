import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldArchivePlacementDrive } from '../src/controllers/driveController.js';

test('drive with registrations is archived rather than deleted', () => {
  assert.equal(shouldArchivePlacementDrive(1, null), true);
});

test('drive linked to a job is archived rather than deleted', () => {
  assert.equal(shouldArchivePlacementDrive(0, { _id: 'job-123' }), true);
});

test('unreferenced drive can be deleted', () => {
  assert.equal(shouldArchivePlacementDrive(0, null), false);
});
