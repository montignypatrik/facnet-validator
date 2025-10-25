import { execSync } from 'child_process';

const PORTS = [5000, 5173];

function killProcessOnPort(port) {
  try {
    console.log(`Checking port ${port}...`);

    // Windows: Use netstat to find PID
    const netstatOutput = execSync(
      `netstat -ano | findstr ":${port}"`,
      { encoding: 'utf8' }
    ).trim();

    if (!netstatOutput) {
      console.log(`✓ Port ${port} is free`);
      return;
    }

    // Extract PID from netstat output
    const lines = netstatOutput.split('\n');
    const pids = new Set();

    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pids.add(pid);
        }
      }
    }

    if (pids.size === 0) {
      console.log(`✓ Port ${port} is free`);
      return;
    }

    // Kill all PIDs found
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        console.log(`✓ Killed process ${pid} on port ${port}`);
      } catch (err) {
        console.log(`⚠ Could not kill PID ${pid} (may already be dead)`);
      }
    }
  } catch (err) {
    // Port is likely free if netstat fails
    console.log(`✓ Port ${port} is free`);
  }
}

console.log('🧹 Cleaning up development ports...\n');

for (const port of PORTS) {
  killProcessOnPort(port);
}

console.log('\n✅ Port cleanup complete!');
