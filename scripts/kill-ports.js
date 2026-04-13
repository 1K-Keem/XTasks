const { exec } = require('child_process');
const os = require('os');

const ports = [3000];
const isWindows = os.platform() === 'win32';

async function killPort(port) {
  return new Promise((resolve) => {
    if (isWindows) {
      // Windows command to find and kill process on port
      const command = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /PID %a /F 2>nul`;
      exec(command, { shell: 'cmd.exe' }, () => {
        console.log(`✓ Cleared port ${port}`);
        resolve();
      });
    } else {
      // Unix/Mac command to find and kill process on port
      const command = `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`;
      exec(command, () => {
        console.log(`✓ Cleared port ${port}`);
        resolve();
      });
    }
  });
}

async function main() {
  console.log('Clearing ports...');
  for (const port of ports) {
    await killPort(port);
  }
  console.log('Ready to start dev server!\n');
}

main().catch(console.error);
