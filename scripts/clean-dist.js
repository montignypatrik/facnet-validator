import { rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distPath = join(projectRoot, 'dist');

console.log('🧹 Cleaning dist/ directory...');

try {
  rmSync(distPath, { recursive: true, force: true });
  console.log('✓ Cleaned dist/ directory');
} catch (err) {
  // Ignore errors if dist doesn't exist
  if (err.code !== 'ENOENT') {
    console.error('⚠ Error cleaning dist/:', err.message);
  } else {
    console.log('✓ dist/ directory already clean');
  }
}

console.log('✅ Build directory ready for fresh build');
