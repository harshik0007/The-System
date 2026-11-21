import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('app shell hydrates profile settings with a read and never writes on route render', async () => {
  const source = await readFile(new URL('./AppLayout.jsx', import.meta.url), 'utf8');
  assert.match(source, /taskApi\.publicProfileSettings\(/);
  assert.doesNotMatch(source, /savePublicProfileSettings|updateAccountPreferences/);
});
