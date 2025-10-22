# NAM Extraction Module - Future Improvements

**Status**: Planning Document
**Created**: 2025-01-21
**Priority**: High
**Estimated Effort**: 2-3 weeks

---

## Overview

This document outlines planned improvements to the NAM extraction module to enhance performance, reliability, and testability. The improvements are based on production testing with clean PDF documents and analysis of real-world requirements.

## Table of Contents

1. [Performance Optimization](#performance-optimization)
2. [Golden Test Strategy](#golden-test-strategy)
3. [Test Data Generation](#test-data-generation)
4. [Quality Metrics](#quality-metrics)
5. [Implementation Roadmap](#implementation-roadmap)

---

## Performance Optimization

### Current Performance Baseline

**Test Case**: 20-page clean PDF (Agenda médical)
- **Total Time**: 62.86 seconds
- **AWS Textract OCR**: ~38 seconds (60%)
- **OpenAI GPT-4**: ~25 seconds (40%)
- **Validation**: <1 second

**Result**: 103 NAMs found (98 valid, 5 invalid) - ~$0.07 cost

### Identified Bottlenecks

#### 1. Sequential Image Processing (Primary Bottleneck)

**Current Implementation** (`textractService.ts:156-192`):
```typescript
// Each page processed one at a time
for (let i = 0; i < pngPages.length; i++) {
  const pageNum = i + 1;
  const response = await textractClient.send(command); // Sequential API call
  // ... process results
}
```

**Problem**: 20 sequential API calls to AWS Textract at ~2 seconds per page = 40 seconds

**Impact**: Direct linear scaling with page count

#### 2. Why Image Conversion is Needed

AWS Textract direct PDF processing fails with:
```
UnsupportedDocumentException: Request has unsupported document format
```

**Affected PDF Types**:
- Browser-generated PDFs (HTML-to-PDF)
- Software-generated PDFs (Microsoft Word, Excel)
- PDFs with certain encodings

**Note**: Ironically, image-based processing is actually **better** for real-world documents (scanned pages, photocopies, phone photos).

### Optimization Strategy 1: Parallel Image Processing

**Approach**: Process multiple pages concurrently

**Implementation**:
```typescript
/**
 * Process pages in parallel batches to reduce OCR time
 *
 * @param pngPages - Array of PNG page objects
 * @param textractClient - AWS Textract client
 * @param concurrency - Number of pages to process simultaneously (default: 5)
 */
async function extractTextFromPDFAsImagesParallel(
  pngPages: PngPageOutput[],
  textractClient: TextractClient,
  concurrency: number = 5
): Promise<TextByPage> {
  const textByPage: TextByPage = {};
  const batchSize = concurrency;

  // Process pages in concurrent batches
  for (let i = 0; i < pngPages.length; i += batchSize) {
    const batch = pngPages.slice(i, Math.min(i + batchSize, pngPages.length));

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (pngPage, batchIndex) => {
        const pageNum = i + batchIndex + 1;
        const imagePath = pngPage.path;

        console.log(`[TEXTRACT] Processing page ${pageNum} in parallel batch...`);

        const imageBytes = await fs.readFile(imagePath);
        const command = new AnalyzeDocumentCommand({
          Document: { Bytes: imageBytes },
          FeatureTypes: ["TABLES", "FORMS"],
        });

        const response = await textractClient.send(command);

        // Extract text from response
        const lines: string[] = [];
        for (const block of response.Blocks || []) {
          if (block.BlockType === "LINE") {
            lines.push(block.Text || "");
          }
        }

        // Clean up temp image
        try {
          await fs.unlink(imagePath);
        } catch (cleanupError) {
          console.warn(`[TEXTRACT] Failed to clean up ${imagePath}`);
        }

        return { pageNum, lines };
      })
    );

    // Merge batch results into textByPage
    for (const result of batchResults) {
      textByPage[result.pageNum] = result.lines;
      console.log(`[TEXTRACT] Page ${result.pageNum}: ${result.lines.length} lines extracted`);
    }
  }

  return textByPage;
}
```

**Expected Improvement**:
- **Current**: 38 seconds for 20 pages (sequential)
- **With parallelization (concurrency=5)**: ~10-15 seconds
- **Speedup**: 2.5x - 3.8x faster

**Considerations**:
- AWS Textract rate limits (default: 5 requests/second)
- Memory usage for concurrent image processing
- Error handling for partial batch failures

### Optimization Strategy 2: AWS Textract Async API

**Use Case**: Large documents (50+ pages)

**Approach**: Use `StartDocumentAnalysis` for asynchronous processing

**Implementation Overview**:
```typescript
async function extractTextFromLargePDFAsync(pdfPath: string): Promise<TextByPage> {
  // 1. Upload PDF to S3
  const s3Key = await uploadToS3(pdfPath);

  // 2. Start async Textract job
  const jobId = await startTextractJob(s3Key);

  // 3. Poll for completion (with exponential backoff)
  await pollJobCompletion(jobId);

  // 4. Download and parse results
  const textByPage = await downloadTextractResults(jobId);

  // 5. Clean up S3 object
  await deleteFromS3(s3Key);

  return textByPage;
}
```

**Expected Improvement**:
- More consistent performance for large documents
- Better for 50+ page documents
- Handles multi-page PDFs natively (no image conversion)

**Trade-offs**:
- Requires S3 bucket setup
- More complex error handling
- Slower for small documents (<10 pages)

### Optimization Strategy 3: Hybrid Approach

**Decision Logic**:
```typescript
async function extractTextFromPDF(pdfPath: string): Promise<TextByPage> {
  const pageCount = await getPDFPageCount(pdfPath);

  if (pageCount <= 10) {
    // Small documents: Use direct/image processing
    return await extractTextFromPDFDirect(pdfPath);
  } else if (pageCount <= 50) {
    // Medium documents: Use parallel image processing
    return await extractTextFromPDFViaImagesParallel(pdfPath);
  } else {
    // Large documents: Use async API
    return await extractTextFromLargePDFAsync(pdfPath);
  }
}
```

---

## Golden Test Strategy

### Objective

Create a comprehensive test suite with **realistic fake documents** and **expected results** to:
1. Measure extraction accuracy (precision, recall, F1)
2. Detect regressions automatically
3. Benchmark performance improvements
4. Test edge cases and error handling

### Why This Matters

**PHI Compliance Challenge**: Cannot use real patient documents for testing

**Solution**: Generate realistic fake documents that mimic real-world scenarios:
- Photocopies with degradation
- Phone photos with perspective distortion
- Handwritten annotations
- Fax quality artifacts
- Mixed quality within single document

### Test Suite Structure

```
server/modules/nam-extraction/test-fixtures/
├── README.md                     # Test suite documentation
├── utils/
│   ├── generateFakeNAMs.ts      # NAM generator
│   ├── createTestPDF.ts         # PDF generation utilities
│   ├── addDegradation.ts        # Image quality degradation
│   └── calculateMetrics.ts      # Accuracy metrics
│
├── 01-clean-printed/
│   ├── document.pdf              # Clean printed text (baseline)
│   ├── expected.json             # Expected results
│   ├── preview.png               # Visual preview
│   └── notes.md                  # Test case description
│
├── 02-photocopied/
│   ├── document.pdf              # Degraded photocopy quality
│   ├── expected.json
│   ├── preview.png
│   └── notes.md
│
├── 03-handwritten-mixed/
│   ├── document.pdf              # Mix of printed + handwritten NAMs
│   ├── expected.json
│   ├── preview.png
│   └── notes.md
│
├── 04-phone-photo/
│   ├── document.pdf              # Photo of paper (perspective, lighting issues)
│   ├── expected.json
│   ├── preview.png
│   └── notes.md
│
├── 05-fax-quality/
│   ├── document.pdf              # Low resolution, high noise
│   ├── expected.json
│   ├── preview.png
│   └── notes.md
│
├── 06-edge-cases/
│   ├── document.pdf              # Partial NAMs, damaged text, OCR confusables
│   ├── expected.json
│   ├── preview.png
│   └── notes.md
│
├── 07-large-volume/
│   ├── document.pdf              # 50+ pages with 200+ NAMs
│   ├── expected.json
│   ├── preview.png
│   └── notes.md
│
└── 08-empty-no-nams/
    ├── document.pdf              # Document with no NAMs (negative test)
    ├── expected.json
    ├── preview.png
    └── notes.md
```

### Expected Result Format

**File**: `expected.json`

```json
{
  "testCaseId": "01-clean-printed",
  "version": "1.0",
  "description": "Clean printed appointment agenda with 15 unique NAMs",
  "createdDate": "2025-01-21",
  "documentMetadata": {
    "pageCount": 3,
    "quality": "high",
    "source": "generated",
    "generationMethod": "pdfkit + realistic-templates",
    "degradationApplied": false
  },
  "expectedNAMs": [
    {
      "nam": "ABCD12345678",
      "page": 1,
      "valid": true,
      "confidence": "high",
      "occurrences": 2,
      "positions": [
        {"page": 1, "context": "Patient: ABCD12345678"},
        {"page": 1, "context": "NAM: ABCD12345678"}
      ],
      "notes": "Appears twice on same page in different contexts"
    },
    {
      "nam": "EFGH23456789",
      "page": 1,
      "valid": true,
      "confidence": "high",
      "occurrences": 1
    },
    {
      "nam": "MALFORMED123",
      "page": 2,
      "valid": false,
      "validationError": "NAM doit contenir 12 caractères",
      "confidence": "low",
      "occurrences": 1,
      "notes": "Intentionally malformed for edge case testing"
    },
    {
      "nam": "AB0D12345678",
      "page": 2,
      "valid": false,
      "validationError": "Les 4 premiers caractères doivent être des lettres",
      "confidence": "medium",
      "occurrences": 1,
      "notes": "OCR confusion test: digit '0' vs letter 'O'"
    }
  ],
  "expectedMetrics": {
    "totalNAMs": 15,
    "validNAMs": 14,
    "invalidNAMs": 1,
    "uniqueNAMs": 13,
    "duplicates": 2,
    "totalOccurrences": 17
  },
  "qualityThresholds": {
    "minPrecision": 0.95,
    "minRecall": 0.90,
    "minF1Score": 0.92,
    "maxProcessingTimeMs": 30000,
    "maxFalsePositiveRate": 0.05
  },
  "knownIssues": [
    {
      "issue": "OCR may confuse '0' (zero) with 'O' (letter O)",
      "affectedNAMs": ["AB0D12345678"],
      "severity": "medium"
    }
  ]
}
```

---

## Test Data Generation

### Fake NAM Generator

**Quebec NAM Format**: 4 letters + 8 digits (e.g., `ABCD12345678`)

**Implementation**: `utils/generateFakeNAMs.ts`

```typescript
/**
 * Generate realistic fake Quebec NAMs
 *
 * NAM format rules:
 * - 4 letters (derived from surname and first name)
 * - 8 digits (derived from birthdate, sex, sequence)
 *
 * Format: LLLL DDDDDDDD
 * Example: DUPO 12345678
 */

interface FakeNAMOptions {
  count: number;
  includeInvalid?: boolean;
  invalidRate?: number; // 0.0 - 1.0
}

interface FakeNAM {
  nam: string;
  valid: boolean;
  validationError?: string;
  context: {
    surname?: string;
    firstName?: string;
    birthdate?: string;
  };
}

// Common Quebec surnames for realistic NAM generation
const QUEBEC_SURNAMES = [
  'TREMBLAY', 'GAGNON', 'ROY', 'CÔTÉ', 'BOUCHARD', 'GAUTHIER',
  'MORIN', 'LAVOIE', 'FORTIN', 'GAGNÉ', 'OUELLET', 'PELLETIER',
  'BÉLANGER', 'LÉVESQUE', 'BERGERON', 'LEBLANC', 'PAQUETTE', 'GIRARD'
];

const QUEBEC_FIRST_NAMES = [
  'MARIE', 'JEAN', 'MICHEL', 'ROBERT', 'PIERRE', 'LOUISE',
  'DIANE', 'CLAUDE', 'JACQUES', 'FRANÇOIS', 'NICOLE', 'SYLVIE'
];

export function generateFakeNAMs(options: FakeNAMOptions): FakeNAM[] {
  const nams: FakeNAM[] = [];
  const { count, includeInvalid = false, invalidRate = 0.1 } = options;

  for (let i = 0; i < count; i++) {
    const shouldBeInvalid = includeInvalid && Math.random() < invalidRate;

    if (shouldBeInvalid) {
      nams.push(generateInvalidNAM());
    } else {
      nams.push(generateValidNAM());
    }
  }

  return nams;
}

function generateValidNAM(): FakeNAM {
  const surname = randomElement(QUEBEC_SURNAMES);
  const firstName = randomElement(QUEBEC_FIRST_NAMES);

  // Extract 4 letters from surname + first name
  // Real NAM algorithm is complex, we'll use simplified version
  const letters = (
    surname.substring(0, 2) +
    firstName.substring(0, 2)
  ).replace(/[^A-Z]/g, '').substring(0, 4).padEnd(4, 'X');

  // Generate 8 random digits
  const digits = Array(8).fill(0).map(() => Math.floor(Math.random() * 10)).join('');

  const nam = letters + digits;

  return {
    nam,
    valid: true,
    context: {
      surname,
      firstName,
      birthdate: generateRandomBirthdate()
    }
  };
}

function generateInvalidNAM(): FakeNAM {
  const invalidTypes = [
    'too_short',
    'too_long',
    'digit_in_letters',
    'letter_in_digits',
    'special_characters'
  ];

  const type = randomElement(invalidTypes);

  switch (type) {
    case 'too_short':
      return {
        nam: 'ABCD1234',
        valid: false,
        validationError: 'NAM doit contenir 12 caractères'
      };

    case 'too_long':
      return {
        nam: 'ABCD123456789',
        valid: false,
        validationError: 'NAM doit contenir 12 caractères'
      };

    case 'digit_in_letters':
      const invalidLetters = ['AB0D', 'A1CD', '2BCD', 'ABC3'][Math.floor(Math.random() * 4)];
      return {
        nam: invalidLetters + '12345678',
        valid: false,
        validationError: 'Les 4 premiers caractères doivent être des lettres'
      };

    case 'letter_in_digits':
      const invalidDigits = ['1234567A', '123456O8', '12345X78'][Math.floor(Math.random() * 3)];
      return {
        nam: 'ABCD' + invalidDigits,
        valid: false,
        validationError: 'Les 8 derniers caractères doivent être des chiffres'
      };

    case 'special_characters':
      return {
        nam: 'AB-D12345678',
        valid: false,
        validationError: 'NAM ne peut contenir que des lettres et des chiffres'
      };

    default:
      return generateValidNAM();
  }
}

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomBirthdate(): string {
  const year = 1940 + Math.floor(Math.random() * 70); // 1940-2010
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
```

### PDF Document Generation

**Implementation**: `utils/createTestPDF.ts`

```typescript
import PDFDocument from 'pdfkit';
import fs from 'fs';

interface TestPDFOptions {
  nams: FakeNAM[];
  template: 'agenda' | 'medical-form' | 'appointment-list';
  outputPath: string;
}

/**
 * Generate realistic PDF document with fake NAMs
 *
 * Templates:
 * - agenda: Appointment calendar/agenda format
 * - medical-form: Medical consultation form
 * - appointment-list: Simple list of appointments
 */
export async function createTestPDF(options: TestPDFOptions): Promise<void> {
  const { nams, template, outputPath } = options;

  const doc = new PDFDocument();
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Add header
  doc.fontSize(16).text('Agenda Médical - Octobre 2025', { align: 'center' });
  doc.moveDown();

  // Add NAMs in realistic layout
  nams.forEach((namObj, index) => {
    const patientNum = index + 1;

    doc.fontSize(12);
    doc.text(`Patient ${patientNum}:`);
    doc.fontSize(10);
    doc.text(`  Nom: ${namObj.context.surname || 'PATIENT'}`);
    doc.text(`  Prénom: ${namObj.context.firstName || 'TEST'}`);
    doc.text(`  NAM: ${namObj.nam}`);
    doc.text(`  Date de naissance: ${namObj.context.birthdate || '1980-01-01'}`);
    doc.moveDown();

    // Page break every 10 patients
    if ((index + 1) % 10 === 0 && index < nams.length - 1) {
      doc.addPage();
    }
  });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
```

### Image Degradation

**Implementation**: `utils/addDegradation.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DegradationOptions {
  type: 'photocopy' | 'fax' | 'phone-photo' | 'scan';
  severity: 'light' | 'medium' | 'heavy';
}

/**
 * Apply realistic degradation to PDF using GraphicsMagick
 *
 * Degradation types:
 * - photocopy: Add noise, reduce contrast, increase brightness variation
 * - fax: Low resolution, heavy noise, horizontal scan lines
 * - phone-photo: Perspective distortion, lighting variation, slight blur
 * - scan: JPEG artifacts, slight rotation, edge shadows
 */
export async function addDegradation(
  inputPDF: string,
  outputPDF: string,
  options: DegradationOptions
): Promise<void> {
  const { type, severity } = options;

  // Convert PDF to images
  await execAsync(`gm convert -density 150 ${inputPDF} temp_page_%03d.png`);

  // Apply degradation based on type
  let gmCommands: string;

  switch (type) {
    case 'photocopy':
      gmCommands = getPhotocopyCommands(severity);
      break;
    case 'fax':
      gmCommands = getFaxCommands(severity);
      break;
    case 'phone-photo':
      gmCommands = getPhonePhotoCommands(severity);
      break;
    case 'scan':
      gmCommands = getScanCommands(severity);
      break;
  }

  // Apply degradation to all pages
  await execAsync(`gm mogrify ${gmCommands} temp_page_*.png`);

  // Convert back to PDF
  await execAsync(`gm convert temp_page_*.png ${outputPDF}`);

  // Clean up temp files
  await execAsync('rm temp_page_*.png');
}

function getPhotocopyCommands(severity: string): string {
  const noise = severity === 'heavy' ? 10 : severity === 'medium' ? 5 : 2;
  const contrast = severity === 'heavy' ? -30 : severity === 'medium' ? -15 : -5;

  return `-noise ${noise} -contrast ${contrast} -brightness-contrast 5x${contrast}`;
}

function getFaxCommands(severity: string): string {
  const noise = severity === 'heavy' ? 15 : severity === 'medium' ? 10 : 5;

  return `-density 100 -noise ${noise} -monochrome -quality 50`;
}

function getPhonePhotoCommands(severity: string): string {
  const blur = severity === 'heavy' ? 2 : severity === 'medium' ? 1 : 0.5;
  const rotate = severity === 'heavy' ? 3 : severity === 'medium' ? 1.5 : 0.5;

  return `-blur ${blur} -rotate ${rotate} -brightness-contrast 10x-10`;
}

function getScanCommands(severity: string): string {
  const quality = severity === 'heavy' ? 60 : severity === 'medium' ? 75 : 85;
  const rotate = severity === 'heavy' ? 1 : severity === 'medium' ? 0.5 : 0.2;

  return `-quality ${quality} -rotate ${rotate}`;
}
```

---

## Quality Metrics

### Metrics to Track

**1. Precision** (How many extracted NAMs are correct)
```
Precision = True Positives / (True Positives + False Positives)
```

**2. Recall** (How many actual NAMs were found)
```
Recall = True Positives / (True Positives + False Negatives)
```

**3. F1 Score** (Harmonic mean of precision and recall)
```
F1 = 2 × (Precision × Recall) / (Precision + Recall)
```

**4. Processing Time**
- Total time (ms)
- Time per page (ms)
- Cost per extraction ($)

**5. Error Rates**
- False Positive Rate: NAMs found but don't exist
- False Negative Rate: NAMs missed
- OCR Confusion Rate: Specific character mistakes (0 vs O, 1 vs I)

### Metrics Calculator

**Implementation**: `utils/calculateMetrics.ts`

```typescript
interface ExtractionResult {
  nams: NAMResult[];
  processingTimeMs: number;
}

interface ExpectedResults {
  expectedNAMs: Array<{
    nam: string;
    page: number;
    valid: boolean;
  }>;
}

interface MetricsReport {
  precision: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  processingTimeMs: number;
  processingTimePerPage: number;
  confusion: {
    missedNAMs: string[];
    incorrectNAMs: string[];
  };
}

export function calculateMetrics(
  actual: ExtractionResult,
  expected: ExpectedResults
): MetricsReport {
  const expectedSet = new Set(expected.expectedNAMs.map(n => n.nam));
  const actualSet = new Set(actual.nams.map(n => n.nam));

  // True Positives: NAMs correctly found
  const truePositives = actual.nams.filter(n => expectedSet.has(n.nam)).length;

  // False Positives: NAMs found but don't exist
  const falsePositives = actual.nams.filter(n => !expectedSet.has(n.nam)).length;

  // False Negatives: NAMs missed
  const falseNegatives = expected.expectedNAMs.filter(
    n => !actualSet.has(n.nam)
  ).length;

  // Calculate metrics
  const precision = truePositives / (truePositives + falsePositives) || 0;
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  const f1Score = (2 * precision * recall) / (precision + recall) || 0;

  // Identify confusions
  const missedNAMs = expected.expectedNAMs
    .filter(n => !actualSet.has(n.nam))
    .map(n => n.nam);

  const incorrectNAMs = actual.nams
    .filter(n => !expectedSet.has(n.nam))
    .map(n => n.nam);

  return {
    precision,
    recall,
    f1Score,
    truePositives,
    falsePositives,
    falseNegatives,
    processingTimeMs: actual.processingTimeMs,
    processingTimePerPage: actual.processingTimeMs / (expected.expectedNAMs[0]?.page || 1),
    confusion: {
      missedNAMs,
      incorrectNAMs,
    },
  };
}
```

### Automated Test Implementation

**Implementation**: `nam-extraction.test.ts`

```typescript
import { describe, test, expect, beforeAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { processDocument } from './services/extractionPipeline';
import { calculateMetrics } from './test-fixtures/utils/calculateMetrics';

describe('NAM Extraction - Golden Tests', () => {
  const fixturesDir = path.join(__dirname, 'test-fixtures');

  async function runTestCase(testCaseId: string) {
    const testDir = path.join(fixturesDir, testCaseId);
    const pdfPath = path.join(testDir, 'document.pdf');
    const expectedPath = path.join(testDir, 'expected.json');

    // Load expected results
    const expectedData = JSON.parse(
      await fs.readFile(expectedPath, 'utf-8')
    );

    // Run extraction
    const result = await processDocument(
      `test-${testCaseId}`,
      pdfPath,
      `${testCaseId}.pdf`
    );

    // Calculate metrics
    const metrics = calculateMetrics(result, expectedData);

    return { metrics, expected: expectedData, actual: result };
  }

  test('01-clean-printed: High accuracy baseline', async () => {
    const { metrics, expected } = await runTestCase('01-clean-printed');

    expect(metrics.precision).toBeGreaterThanOrEqual(
      expected.qualityThresholds.minPrecision
    );
    expect(metrics.recall).toBeGreaterThanOrEqual(
      expected.qualityThresholds.minRecall
    );
    expect(metrics.f1Score).toBeGreaterThanOrEqual(
      expected.qualityThresholds.minF1Score
    );
  }, 60000); // 60 second timeout

  test('02-photocopied: Acceptable degradation handling', async () => {
    const { metrics, expected } = await runTestCase('02-photocopied');

    // Lower thresholds for degraded quality
    expect(metrics.precision).toBeGreaterThanOrEqual(0.85);
    expect(metrics.recall).toBeGreaterThanOrEqual(0.80);
  }, 60000);

  test('03-handwritten-mixed: Handwriting detection', async () => {
    const { metrics, expected } = await runTestCase('03-handwritten-mixed');

    // Even lower thresholds for handwritten content
    expect(metrics.precision).toBeGreaterThanOrEqual(0.75);
    expect(metrics.recall).toBeGreaterThanOrEqual(0.70);
  }, 60000);

  test('06-edge-cases: Error handling and validation', async () => {
    const { metrics, expected, actual } = await runTestCase('06-edge-cases');

    // Should correctly identify invalid NAMs
    const invalidNAMs = actual.nams.filter(n => !n.valid);
    expect(invalidNAMs.length).toBeGreaterThan(0);

    // Should have appropriate validation errors
    invalidNAMs.forEach(nam => {
      expect(nam.validationError).toBeDefined();
      expect(nam.validationError).toBeTruthy();
    });
  }, 60000);

  test('08-empty-no-nams: Negative test case', async () => {
    const { actual } = await runTestCase('08-empty-no-nams');

    // Should find zero NAMs
    expect(actual.nams).toHaveLength(0);
    expect(actual.status).toBe('completed');
  }, 60000);
});
```

---

## Implementation Roadmap

### Phase 1: Test Infrastructure (Week 1)
**Priority**: High
**Effort**: 3-5 days

**Tasks**:
1. Create test fixture directory structure
2. Implement fake NAM generator (`generateFakeNAMs.ts`)
3. Implement PDF generator (`createTestPDF.ts`)
4. Implement metrics calculator (`calculateMetrics.ts`)
5. Create 3 initial test cases:
   - 01-clean-printed (baseline)
   - 06-edge-cases (validation testing)
   - 08-empty-no-nams (negative test)
6. Write Vitest test suite
7. Document test creation process in README

**Success Criteria**:
- ✅ Automated tests run in CI/CD
- ✅ Metrics clearly show precision/recall/F1
- ✅ Easy to add new test cases

### Phase 2: Performance Optimization (Week 2)
**Priority**: Medium
**Effort**: 3-5 days

**Tasks**:
1. Implement parallel image processing (`extractTextFromPDFAsImagesParallel`)
2. Add concurrency configuration (environment variable)
3. Benchmark performance improvements
4. Test AWS Textract rate limits
5. Add error handling for partial batch failures
6. Update progress tracking for parallel processing
7. Document configuration options

**Success Criteria**:
- ✅ 2-3x speedup for 20-page documents
- ✅ No regression in accuracy
- ✅ Proper error handling

### Phase 3: Real-World Test Cases (Week 3)
**Priority**: Medium
**Effort**: 5-7 days

**Tasks**:
1. Implement image degradation utilities (`addDegradation.ts`)
2. Create test cases:
   - 02-photocopied
   - 04-phone-photo
   - 05-fax-quality
3. Generate handwriting fonts or scanned handwriting samples
4. Create 03-handwritten-mixed test case
5. Create 07-large-volume test case (50+ pages)
6. Measure accuracy across all test cases
7. Document known limitations and accuracy thresholds

**Success Criteria**:
- ✅ Test suite covers all real-world scenarios
- ✅ Clear accuracy metrics per document type
- ✅ Known OCR confusions documented

### Phase 4: Advanced Optimizations (Future)
**Priority**: Low
**Effort**: 1-2 weeks

**Tasks**:
1. Implement AWS Textract async API for large documents
2. Add S3 bucket configuration
3. Implement hybrid approach (direct/parallel/async)
4. Add image pre-processing (contrast enhancement, denoising)
5. Explore alternative OCR providers (Azure, Google)
6. Implement OCR confidence score tracking
7. Add webhook notifications for long-running jobs

**Success Criteria**:
- ✅ Optimal performance for all document sizes
- ✅ Improved accuracy on low-quality scans
- ✅ Cost optimization

---

## Configuration

### Environment Variables

```bash
# NAM Extraction Performance
NAM_TEXTRACT_CONCURRENCY=5        # Parallel page processing (1-10)
NAM_ASYNC_THRESHOLD_PAGES=50      # Use async API for docs > N pages
NAM_ENABLE_PREPROCESSING=false    # Enable image enhancement
NAM_MAX_PROCESSING_TIME_MS=300000 # 5 minute timeout

# AWS Textract
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_S3_BUCKET=facnet-textract-temp  # For async processing
```

### Cost Estimation

**AWS Textract Pricing** (ca-central-1):
- Detect Text: $0.0015 per page
- Analyze Document (TABLES/FORMS): $0.065 per page

**Current Cost** (20-page document):
- 20 pages × $0.065 = **$1.30 per extraction**

**With Parallel Processing**:
- Same cost, faster processing
- No additional charges

**OpenAI GPT-4** (current):
- ~$0.07 per 20-page extraction
- Depends on text volume

**Total Cost per Extraction**: ~$1.37 (20 pages)

---

## References

- [AWS Textract Documentation](https://docs.aws.amazon.com/textract/)
- [Quebec NAM Format Specification](https://www.ramq.gouv.qc.ca/)
- [Golden Testing Best Practices](https://abseil.io/resources/swe-book/html/ch12.html)
- [GraphicsMagick Documentation](http://www.graphicsmagick.org/)

---

## Appendix: OCR Confusion Patterns

Common OCR mistakes to test for:

| Character | Confused With | NAM Impact |
|-----------|---------------|------------|
| O (letter)| 0 (zero)      | Invalid NAM: digit in letters section |
| I (letter)| 1 (one)       | Invalid NAM: digit in letters section |
| l (lowercase L) | 1 (one) | Invalid NAM: digit in letters section |
| 0 (zero)  | O (letter)    | Invalid NAM: letter in digits section |
| 8         | B             | Invalid NAM: letter in digits section |
| 5         | S             | Invalid NAM: letter in digits section |
| G         | 6             | Invalid NAM: digit in letters section |

**Recommendation**: Generate test cases specifically for these confusions in `06-edge-cases`.
