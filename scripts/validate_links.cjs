const fs = require('fs');
const path = require('path');

function checkLinks(file, content) {
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const results = [];
  let match;

  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const linkText = match[1];
    const linkPath = match[2];

    // Skip external links (http, https, mailto)
    if (linkPath.startsWith('http://') || linkPath.startsWith('https://') || linkPath.startsWith('mailto:')) {
      continue;
    }

    // Skip anchor links
    if (linkPath.startsWith('#')) {
      continue;
    }

    // Resolve relative path
    const fileDir = path.dirname(file);
    const fullPath = path.resolve(fileDir, linkPath);

    // Check if file exists
    const exists = fs.existsSync(fullPath);

    results.push({
      file: file,
      linkText: linkText,
      linkPath: linkPath,
      resolvedPath: fullPath,
      exists: exists
    });
  }

  return results;
}

const filesToCheck = [
  'CLAUDE.md',
  'README.md',
  'CONTRIBUTING.md',
  'docs/INDEX.md',
  'docs/getting-started/README.md',
  'docs/architecture/README.md',
  'docs/modules/README.md'
];

let allGood = true;
let totalChecked = 0;
let totalBroken = 0;

for (const file of filesToCheck) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const links = checkLinks(file, content);

    totalChecked += links.length;
    const brokenLinks = links.filter(l => !l.exists);
    totalBroken += brokenLinks.length;

    if (brokenLinks.length > 0) {
      console.log(`\n❌ Broken links in ${file}:`);
      brokenLinks.forEach(l => {
        console.log(`  - [${l.linkText}] -> ${l.linkPath}`);
        console.log(`    Expected at: ${l.resolvedPath}`);
      });
      allGood = false;
    } else {
      console.log(`✅ ${file} - ${links.length} links OK`);
    }
  } catch (err) {
    console.log(`⚠️  Error checking ${file}: ${err.message}`);
  }
}

console.log(`\n---\nSummary: ${totalChecked - totalBroken}/${totalChecked} links valid`);

if (allGood) {
  console.log('✅ All documentation links validated successfully!');
} else {
  console.log('❌ Some links are broken and need to be fixed.');
  process.exit(1);
}
