import assert from 'node:assert/strict';
import test from 'node:test';
import { isViewportPoint } from './useCursorTopLayer.js';

test('theme cursor tracking includes the final viewport edge used during scrollbar drags', () => {
  assert.equal(isViewportPoint(0, 0, 1280, 800), true);
  assert.equal(isViewportPoint(1280, 800, 1280, 800), true);
  assert.equal(isViewportPoint(1280.01, 800, 1280, 800), false);
  assert.equal(isViewportPoint(1280, 800.01, 1280, 800), false);
  assert.equal(isViewportPoint(-0.01, 400, 1280, 800), false);
  assert.equal(isViewportPoint(640, Number.NaN, 1280, 800), false);
});
