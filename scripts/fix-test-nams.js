import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Realistic Quebec NAM replacements with French-Canadian names
const namReplacements = {
  // Scenario P1 - Patient 1 (Single visit with 15815)
  'TEST001': {
    nam: 'TREM65030515',
    fullName: 'TREM65030515 - TREMBLAY, PIERRE'
  },

  // Scenario E1 - Patient 2 (Two visits with 15815 in same period)
  'TEST002': {
    nam: 'GAGN72081223',
    fullName: 'GAGN72081223 - GAGNON, MARIE'
  },
  'TEST003': {
    nam: 'GAGN72081223',
    fullName: 'GAGN72081223 - GAGNON, MARIE'
  },

  // Scenario E2 - Patient 3 (Three visits with 15816 in same period)
  'TEST004': {
    nam: 'DUPO68070822',
    fullName: 'DUPO68070822 - DUPONT, OLIVIER'
  },
  'TEST005': {
    nam: 'DUPO68070822',
    fullName: 'DUPO68070822 - DUPONT, OLIVIER'
  },
  'TEST006': {
    nam: 'DUPO68070822',
    fullName: 'DUPO68070822 - DUPONT, OLIVIER'
  },

  // Scenario E3 - Patient 4 (Three visits with 15817 in same period)
  'TEST007': {
    nam: 'LAVO55120918',
    fullName: 'LAVO55120918 - LAVOIE, JACQUES'
  },
  'TEST008': {
    nam: 'LAVO55120918',
    fullName: 'LAVO55120918 - LAVOIE, JACQUES'
  },
  'TEST009': {
    nam: 'LAVO55120918',
    fullName: 'LAVO55120918 - LAVOIE, JACQUES'
  },

  // Scenario P1-15819 - Patient 5 (Single visit with 15819)
  'TEST010': {
    nam: 'COTE81091512',
    fullName: 'COTE81091512 - COTE, SOPHIE'
  }
};

// Read the CSV file
const csvPath = path.join(__dirname, '..', 'data', 'samples', 'Charron, Caroline.csv');
console.log(`Reading CSV file: ${csvPath}`);

let csvContent = fs.readFileSync(csvPath, 'utf-8');
let replacementCount = 0;

// Replace each TEST NAM with realistic Quebec NAM
for (const [testNam, replacement] of Object.entries(namReplacements)) {
  const namRegex = new RegExp(testNam, 'g');
  const fullNameRegex = new RegExp(`PATIENT\\d{3} - TEST, PATIENT-[^;]+`, 'g');

  // Count occurrences before replacement
  const namMatches = csvContent.match(namRegex);
  if (namMatches) {
    console.log(`Replacing ${namMatches.length} occurrences of ${testNam} with ${replacement.nam}`);
    csvContent = csvContent.replace(namRegex, replacement.nam);
    replacementCount += namMatches.length;
  }
}

// Replace patient identifier patterns
csvContent = csvContent.replace(/PATIENT001 - TEST, PATIENT-P1/g, namReplacements['TEST001'].fullName);
csvContent = csvContent.replace(/PATIENT002 - TEST, PATIENT-E1A/g, namReplacements['TEST002'].fullName);
csvContent = csvContent.replace(/PATIENT003 - TEST, PATIENT-E2/g, namReplacements['TEST004'].fullName);
csvContent = csvContent.replace(/PATIENT004 - TEST, PATIENT-E3/g, namReplacements['TEST007'].fullName);
csvContent = csvContent.replace(/PATIENT005 - TEST, PATIENT-P1-15819/g, namReplacements['TEST010'].fullName);

// Write the updated CSV
fs.writeFileSync(csvPath, csvContent, 'utf-8');

console.log(`\n✅ Successfully replaced ${replacementCount} NAM occurrences`);
console.log('\nRealistic Quebec NAMs created:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Scenario P1 (Single visit with 15815):');
console.log('  - TREM65030515 - TREMBLAY, PIERRE (born March 5, 1965)');
console.log('\nScenario E1 (Two visits with 15815):');
console.log('  - GAGN72081223 - GAGNON, MARIE (born August 12, 1972)');
console.log('\nScenario E2 (Three visits with 15816):');
console.log('  - DUPO68070822 - DUPONT, OLIVIER (born July 8, 1968)');
console.log('\nScenario E3 (Three visits with 15817):');
console.log('  - LAVO55120918 - LAVOIE, JACQUES (born December 9, 1955)');
console.log('\nScenario P1-15819 (Single visit with 15819):');
console.log('  - COTE81091512 - COTE, SOPHIE (born September 15, 1981)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
