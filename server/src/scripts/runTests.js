import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDirectory, '../..');
const testDirectory = resolve(serverRoot, 'src/tests');
const testFiles = readdirSync(testDirectory)
  .filter((file) => file.endsWith('.test.js'))
  .map((file) => resolve(testDirectory, file));

const child = spawn(process.execPath, ['--test', ...testFiles], {
  cwd: serverRoot,
  env: { ...process.env, NODE_ENV: 'test' },
  stdio: 'inherit',
});
child.once('error', (error) => { console.error('Could not start server tests:', error.message); process.exitCode = 1; });
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
