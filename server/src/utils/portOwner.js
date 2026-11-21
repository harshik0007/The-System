import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFile = promisify(execFileCallback);

async function runFile(file, args) {
  const { stdout } = await execFile(file, args, {
    windowsHide: true,
    timeout: 5_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

function parseWindowsListenerPids(output, port) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    if (!/\bLISTENING\b/i.test(line)) continue;
    const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    if (match && Number(match[1]) === port) pids.add(Number(match[2]));
  }
  return [...pids];
}

async function inspectWindowsProcess(pid) {
  const command = `$owner = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction Stop; if ($null -ne $owner) { [pscustomobject]@{ pid = [int]$owner.ProcessId; processName = [string]$owner.Name; executablePath = [string]$owner.ExecutablePath; commandLine = [string]$owner.CommandLine } | ConvertTo-Json -Compress }`;
  try {
    const output = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
    const process = JSON.parse(output);
    if (process?.pid) return process;
  } catch { /* Fall through to a name/PID-only diagnostic without stopping it. */ }

  try {
    const output = await runFile('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
    const processName = output.match(/^"([^"]+)"/)?.[1];
    if (processName) return { pid, processName, executablePath: '', commandLine: '' };
  } catch { /* Preserve the PID even if Windows restricts process inspection. */ }
  return { pid, processName: 'process details unavailable', executablePath: '', commandLine: '' };
}

async function inspectUnixProcess(pid) {
  const output = await runFile('ps', ['-p', String(pid), '-o', 'comm=,args=']);
  const commandLine = output.trim();
  const executablePath = commandLine.split(/\s+/, 1)[0] || '';
  return {
    pid,
    processName: path.basename(executablePath),
    executablePath,
    commandLine,
  };
}

/** Read-only listener inspection for a port conflict. Never signals a process. */
export async function inspectPortOwners(port, { platform = process.platform } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('Port owner inspection requires a valid TCP port.');
  }
  try {
    if (platform === 'win32') {
      const output = await runFile('netstat.exe', ['-ano', '-p', 'tcp']);
      const pids = parseWindowsListenerPids(output, port);
      const owners = await Promise.all(pids.map(inspectWindowsProcess));
      return { owners, inspectionError: null };
    }

    const output = await runFile('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
    const pids = [...new Set(output.split(/\r?\n/).map(Number).filter((pid) => Number.isInteger(pid) && pid > 0))];
    const owners = await Promise.all(pids.map(async (pid) => {
      try { return await inspectUnixProcess(pid); } catch { return { pid, processName: 'process details unavailable', executablePath: '', commandLine: '' }; }
    }));
    return { owners, inspectionError: null };
  } catch (error) {
    return { owners: [], inspectionError: error.message };
  }
}
