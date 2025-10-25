import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 Verifying build artifacts...\n');

const requiredFiles = [
  { path: 'dist/server/index.js', description: 'Server bundle' },
  { path: 'dist/public/index.html', description: 'Client HTML' }
];

let hasErrors = false;

for (const { path, description } of requiredFiles) {
  const fullPath = join(projectRoot, path);
  const exists = existsSync(fullPath);

  if (exists) {
    console.log(`✓ ${description}: ${path}`);
  } else {
    console.error(`✗ MISSING ${description}: ${path}`);
    hasErrors = true;
  }
}

console.log('');

if (hasErrors) {
  console.error('❌ Build verification FAILED - missing required files');
  process.exit(1);
} else {
  console.log('✅ Build verification PASSED - all artifacts present');
  process.exit(0);
}
