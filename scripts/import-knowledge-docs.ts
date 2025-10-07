/**
 * CLI Script: Bulk Import Knowledge Documents
 *
 * Scans knowledge/ directory and processes all documents:
 * 1. Scans directory for HTML/PDF files
 * 2. Creates document records in database
 * 3. Enqueues processing jobs for each file
 * 4. Monitors progress until complete
 */

import 'dotenv/config';
import { db } from '../server/core/db';
import { scanKnowledgeDirectory } from '../server/modules/chatbot/services/fileScanner';
import * as docStorage from '../server/modules/chatbot/storage-documents';
import { getDocumentQueue, enqueueBulkImport, getQueueStats } from '../server/modules/chatbot/queue/documentQueue';
import { startDocumentWorker, stopDocumentWorker } from '../server/modules/chatbot/queue/documentWorker';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function bulkImport() {
  logSection('📚 DASH Knowledge Base Bulk Import');

  try {
    // Step 1: Scan knowledge directory
    log('🔍 Step 1: Scanning knowledge/ directory...', 'cyan');
    const scanResult = await scanKnowledgeDirectory();

    log(`\n✓ Scan complete:`, 'green');
    console.log(`  - Total files found: ${scanResult.totalFiles}`);
    console.log(`  - HTML files: ${scanResult.byType['html'] || 0}`);
    console.log(`  - PDF files: ${scanResult.byType['pdf'] || 0}`);
    console.log('\n  By category:');
    Object.entries(scanResult.byCategory).forEach(([category, count]) => {
      console.log(`    - ${category}: ${count}`);
    });

    if (scanResult.totalFiles === 0) {
      log('\n⚠️  No files found in knowledge/ directory', 'yellow');
      log('Please add HTML or PDF files to the following folders:', 'yellow');
      log('  - server/modules/chatbot/knowledge/ramq-official/', 'yellow');
      log('  - server/modules/chatbot/knowledge/billing-guides/', 'yellow');
      log('  - server/modules/chatbot/knowledge/code-references/', 'yellow');
      log('  - server/modules/chatbot/knowledge/regulations/', 'yellow');
      log('  - server/modules/chatbot/knowledge/faq/', 'yellow');
      process.exit(0);
    }

    // Step 2: Create/update document records
    log('\n📊 Step 2: Creating document records in database...', 'cyan');

    let newDocs = 0;
    let updatedDocs = 0;
    let unchangedDocs = 0;

    for (const file of scanResult.files) {
      const existing = await docStorage.getDocumentByFilePath(file.filePath);

      if (existing) {
        if (existing.fileHash !== file.fileHash) {
          // File changed
          await docStorage.updateDocument(existing.id, {
            fileHash: file.fileHash,
            fileSizeBytes: file.fileSizeBytes.toString(),
            status: 'pending',
          });
          updatedDocs++;
          log(`  ↻ Updated: ${file.filename}`, 'yellow');
        } else {
          unchangedDocs++;
          log(`  = Unchanged: ${file.filename}`);
        }
      } else {
        // New file
        await docStorage.createDocument({
          filename: file.filename,
          filePath: file.filePath,
          fileType: file.fileType,
          category: file.category,
          fileHash: file.fileHash,
          fileSizeBytes: file.fileSizeBytes.toString(),
          status: 'pending',
          metadata: {},
        });
        newDocs++;
        log(`  + New: ${file.filename}`, 'green');
      }
    }

    log(`\n✓ Document records created:`, 'green');
    console.log(`  - New documents: ${newDocs}`);
    console.log(`  - Updated documents: ${updatedDocs}`);
    console.log(`  - Unchanged documents: ${unchangedDocs}`);

    const totalPending = newDocs + updatedDocs;

    if (totalPending === 0) {
      log('\n✓ All documents are already processed and up to date!', 'green');
      process.exit(0);
    }

    // Step 3: Start worker and process documents
    log('\n🚀 Step 3: Starting document processing...', 'cyan');
    log('This may take several minutes depending on file size and count.', 'yellow');

    startDocumentWorker();
    await sleep(1000); // Give worker time to start

    // Enqueue bulk import job
    const jobId = await enqueueBulkImport();
    log(`\nBulk import job enqueued: ${jobId}`, 'blue');

    // Step 4: Monitor progress
    log('\n⏳ Step 4: Monitoring progress...\n', 'cyan');

    let lastCompleted = 0;
    let lastFailed = 0;

    while (true) {
      await sleep(2000); // Poll every 2 seconds

      const stats = await docStorage.getDocumentStats();
      const queueStats = await getQueueStats();

      const completed = stats.byStatus['completed'] || 0;
      const failed = stats.byStatus['error'] || 0;
      const processing = stats.byStatus['processing'] || 0;
      const pending = stats.byStatus['pending'] || 0;

      // Clear line and show progress
      process.stdout.write('\r\x1b[K'); // Clear line
      process.stdout.write(
        `📈 Progress: ${completed}/${totalPending} completed | ` +
        `${processing} processing | ${pending} pending | ${failed} failed | ` +
        `Queue: ${queueStats.active} active, ${queueStats.waiting} waiting`
      );

      // Show newly completed files
      if (completed > lastCompleted) {
        const newCompleted = completed - lastCompleted;
        console.log(); // New line
        log(`  ✓ ${newCompleted} document(s) completed`, 'green');
      }

      // Show newly failed files
      if (failed > lastFailed) {
        const newFailed = failed - lastFailed;
        console.log(); // New line
        log(`  ✗ ${newFailed} document(s) failed`, 'red');
      }

      lastCompleted = completed;
      lastFailed = failed;

      // Check if all done
      if (completed + failed >= totalPending && queueStats.active === 0 && queueStats.waiting === 0) {
        break;
      }
    }

    console.log('\n'); // Final newline

    // Step 5: Show final results
    logSection('✅ Bulk Import Complete');

    const finalStats = await docStorage.getDocumentStats();

    log('📊 Final Statistics:', 'bright');
    console.log(`  Total documents: ${finalStats.totalDocuments}`);
    console.log(`  Total chunks: ${finalStats.totalChunks}`);
    console.log(`  Completed: ${finalStats.byStatus['completed'] || 0}`);
    console.log(`  Failed: ${finalStats.byStatus['error'] || 0}`);

    if (finalStats.byStatus['error'] > 0) {
      log('\n⚠️  Some documents failed to process. Check error messages:', 'yellow');
      const failedDocs = await docStorage.getDocumentsByStatus('error');
      failedDocs.forEach(doc => {
        console.log(`  - ${doc.filename}: ${doc.errorMessage}`);
      });
    }

    log('\n✓ Knowledge base is ready for RAG retrieval!', 'green');

    // Cleanup
    await stopDocumentWorker();
    await sleep(500);

    process.exit(0);
  } catch (error) {
    log('\n❌ Error during bulk import:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run bulk import
bulkImport();
