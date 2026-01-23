/**
 * Bulk Import Clauses from Training Contracts
 *
 * Scalable batch processor that:
 * - Processes PDFs in parallel with concurrency control
 * - Supports resumability via checkpoint file
 * - Handles large datasets with chunked DB inserts
 * - Includes retry logic for API failures
 *
 * Usage:
 *   npm run import-clauses
 *   npm run import-clauses:dry    # Extract only, no DB insert
 *   npm run import-clauses:resume # Resume from checkpoint
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Configuration
const CONFIG = {
  TRAINING_FOLDER: '/Users/jbb/Library/CloudStorage/OneDrive-MARSCompany/Contract Files/AI Training Contracts',
  CHECKPOINT_FILE: '/tmp/mars-clause-import-checkpoint.json',
  BACKUP_FILE: '/tmp/mars-clauses-extracted.json',

  // Scalability settings
  CONCURRENCY: 3,           // Parallel PDF processing
  BATCH_SIZE: 10,           // Contracts per batch
  DB_INSERT_CHUNK: 50,      // Clauses per DB insert
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000,
  API_RATE_LIMIT_MS: 500,   // Delay between AI calls
};

const CLAUSE_CATEGORIES = [
  'Limitation of Liability', 'Indemnification', 'Intellectual Property',
  'Confidentiality', 'Termination', 'Warranty', 'Payment Terms', 'Insurance',
  'Compliance', 'Dispute Resolution', 'Force Majeure', 'Assignment',
  'Notices', 'Governing Law', 'General'
];

// Types
interface ExtractedClause {
  name: string;
  category: string;
  text: string;
  risk_level: 'low' | 'medium' | 'high';
  description: string;
  source_contract: string;
  position_favorability: 'favorable' | 'neutral' | 'unfavorable';
}

interface ConsolidatedClause {
  name: string;
  category: string;
  description: string;
  risk_level: string;
  primary_text: string;
  fallback_text: string | null;
  last_resort_text: string | null;
  sources: string[];
}

interface Checkpoint {
  processedFiles: string[];
  extractedClauses: ExtractedClause[];
  lastUpdated: string;
}

// Environment
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Utility: Sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Utility: Retry wrapper
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = CONFIG.RETRY_ATTEMPTS
): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts) throw error;
      console.warn(`  Retry ${i}/${attempts} for ${label}: ${error}`);
      await sleep(CONFIG.RETRY_DELAY_MS * i);
    }
  }
  throw new Error('Retry failed');
}

// Utility: Process array in chunks with concurrency
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, idx) => processor(item, i + idx))
    );
    results.push(...batchResults);
  }

  return results;
}

// Load checkpoint for resumability
function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CONFIG.CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CONFIG.CHECKPOINT_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    console.warn('Could not load checkpoint, starting fresh');
  }
  return null;
}

// Save checkpoint
function saveCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// Extract text from PDF using pdf-parse v1
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text || '';
  } catch (error: any) {
    // Suppress common PDF parsing warnings
    if (!error.message?.includes('Invalid XRef')) {
      console.error(`  PDF error: ${error.message?.substring(0, 50)}`);
    }
    return '';
  }
}

// Extract clauses using AI
async function extractClausesWithAI(
  contractText: string,
  contractName: string
): Promise<ExtractedClause[]> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');

  const prompt = `You are a contract analysis expert at MARS Company (water/wastewater technology). Extract reusable legal clauses from this contract.

CONTRACT: ${contractName}
TEXT:
${contractText.substring(0, 35000)}

For each distinct legal clause, extract:
{
  "name": "Descriptive name",
  "category": "One of: ${CLAUSE_CATEGORIES.join(', ')}",
  "text": "EXACT clause text - preserve formatting",
  "risk_level": "low|medium|high (from MARS perspective)",
  "description": "What this clause does",
  "position_favorability": "favorable|neutral|unfavorable (for MARS)"
}

RULES:
- Extract ALL substantive legal clauses (typically 8-20 per contract)
- Preserve EXACT wording including paragraph structure
- Skip: headers, signatures, exhibits, table of contents
- Focus on: liability, indemnity, IP, confidentiality, termination, payment, warranties
- Mark unusual or one-sided terms

Return ONLY a JSON array, no other text.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mars-contracts.vercel.app',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn(`  No JSON in response`);
    return [];
  }

  try {
    const clauses = JSON.parse(jsonMatch[0]);
    return clauses.map((c: any) => ({
      ...c,
      source_contract: contractName,
      risk_level: c.risk_level?.toLowerCase() || 'medium',
      position_favorability: c.position_favorability || 'neutral',
    }));
  } catch {
    console.warn(`  JSON parse failed`);
    return [];
  }
}

// Process a single contract file
async function processContract(
  filePath: string,
  index: number,
  total: number
): Promise<ExtractedClause[]> {
  const fileName = path.basename(filePath);
  const shortName = fileName.length > 45 ? fileName.substring(0, 42) + '...' : fileName;

  process.stdout.write(`[${String(index + 1).padStart(3)}/${total}] ${shortName.padEnd(45)}`);

  try {
    // Extract text
    const text = await extractTextFromPDF(filePath);
    if (!text || text.length < 500) {
      console.log(' SKIP (no text)');
      return [];
    }

    // Extract clauses with retry
    const clauses = await withRetry(
      () => extractClausesWithAI(text, fileName),
      fileName
    );

    console.log(` ${String(clauses.length).padStart(2)} clauses`);

    await sleep(CONFIG.API_RATE_LIMIT_MS);
    return clauses;
  } catch (error) {
    console.log(` FAILED: ${error}`);
    return [];
  }
}

// Consolidate similar clauses into 3-tier structure
function consolidateClauses(allClauses: ExtractedClause[]): ConsolidatedClause[] {
  console.log(`\nConsolidating ${allClauses.length} extracted clauses...`);

  // Group by category
  const byCategory = new Map<string, ExtractedClause[]>();
  for (const clause of allClauses) {
    const key = clause.category.toLowerCase();
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(clause);
  }

  const consolidated: ConsolidatedClause[] = [];

  for (const [categoryKey, clauses] of byCategory) {
    const category = CLAUSE_CATEGORIES.find(c => c.toLowerCase() === categoryKey) || 'General';

    // Sort by favorability and dedupe by text similarity
    const favorable = clauses.filter(c => c.position_favorability === 'favorable');
    const neutral = clauses.filter(c => c.position_favorability === 'neutral');
    const unfavorable = clauses.filter(c => c.position_favorability === 'unfavorable');

    // Create main consolidated clause
    const primary = favorable[0] || neutral[0] || unfavorable[0];
    if (!primary) continue;

    const fallback = neutral[0] && neutral[0] !== primary ? neutral[0] :
                     (favorable[1] || null);
    const lastResort = unfavorable[0] && unfavorable[0] !== primary ? unfavorable[0] :
                       (neutral[1] || null);

    consolidated.push({
      name: `${category} - Standard`,
      category,
      description: primary.description,
      risk_level: primary.risk_level,
      primary_text: primary.text,
      fallback_text: fallback?.text || null,
      last_resort_text: lastResort?.text || null,
      sources: [...new Set(clauses.map(c => c.source_contract))].slice(0, 10),
    });

    // Create variants for categories with many unique clauses
    const usedTexts = new Set([
      primary.text.substring(0, 100),
      fallback?.text?.substring(0, 100),
      lastResort?.text?.substring(0, 100)
    ].filter(Boolean));

    let variantNum = 1;
    for (const clause of clauses) {
      const textKey = clause.text.substring(0, 100);
      if (!usedTexts.has(textKey) && variantNum <= 2) {
        consolidated.push({
          name: `${category} - Variant ${variantNum}`,
          category,
          description: clause.description,
          risk_level: clause.risk_level,
          primary_text: clause.text,
          fallback_text: null,
          last_resort_text: null,
          sources: [clause.source_contract],
        });
        usedTexts.add(textKey);
        variantNum++;
      }
    }
  }

  console.log(`Consolidated to ${consolidated.length} unique clause entries`);
  return consolidated;
}

// Import to database in chunks
async function importToDatabase(clauses: ConsolidatedClause[]): Promise<number> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase credentials not set');
  }

  console.log(`\nImporting ${clauses.length} clauses to database...`);

  // Get category IDs
  const catResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/clause_categories?select=id,name`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const categories = await catResponse.json();
  const categoryMap = new Map(categories.map((c: any) => [c.name.toLowerCase(), c.id]));

  // Prepare records
  const records = clauses.map(clause => ({
    category_id: categoryMap.get(clause.category.toLowerCase()) || null,
    name: clause.name,
    description: clause.description,
    primary_text: clause.primary_text,
    fallback_text: clause.fallback_text,
    last_resort_text: clause.last_resort_text,
    risk_level: clause.risk_level,
    position_type: 'favorable',
    tags: clause.sources.slice(0, 5),
    source_contract_name: clause.sources[0] || 'Training Import',
    created_by: 'training-import',
    is_active: true,
  }));

  // Insert in chunks
  let inserted = 0;
  for (let i = 0; i < records.length; i += CONFIG.DB_INSERT_CHUNK) {
    const chunk = records.slice(i, i + CONFIG.DB_INSERT_CHUNK);

    const response = await withRetry(async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clause_library`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }, `DB chunk ${i / CONFIG.DB_INSERT_CHUNK + 1}`);

    inserted += response.length;
    process.stdout.write(`  Inserted ${inserted}/${records.length}\r`);
  }

  console.log(`\nSuccessfully inserted ${inserted} clauses`);
  return inserted;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isResume = args.includes('--resume');
  const isDryRun = args.includes('--dry-run');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         MARS Clause Library - Training Import                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Validate environment
  if (!OPENROUTER_API_KEY) {
    console.error('ERROR: Set OPENROUTER_API_KEY');
    process.exit(1);
  }
  if (!isDryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
    console.error('ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Load checkpoint if resuming
  let checkpoint: Checkpoint = {
    processedFiles: [],
    extractedClauses: [],
    lastUpdated: new Date().toISOString(),
  };

  if (isResume) {
    const saved = loadCheckpoint();
    if (saved) {
      checkpoint = saved;
      console.log(`Resuming from checkpoint: ${checkpoint.processedFiles.length} files already processed\n`);
    }
  }

  // Get PDF files
  const allFiles = fs.readdirSync(CONFIG.TRAINING_FOLDER)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(CONFIG.TRAINING_FOLDER, f));

  const filesToProcess = allFiles.filter(
    f => !checkpoint.processedFiles.includes(path.basename(f))
  );

  console.log(`Total PDF files: ${allFiles.length}`);
  console.log(`Files to process: ${filesToProcess.length}\n`);

  if (filesToProcess.length === 0) {
    console.log('No new files to process.');
  } else {
    // Process files with concurrency
    console.log('═══ Extracting Clauses ═══\n');

    for (let i = 0; i < filesToProcess.length; i += CONFIG.BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + CONFIG.BATCH_SIZE);

      const batchResults = await processInBatches(
        batch,
        (file, idx) => processContract(file, i + idx, filesToProcess.length),
        CONFIG.CONCURRENCY
      );

      // Update checkpoint
      for (let j = 0; j < batch.length; j++) {
        checkpoint.processedFiles.push(path.basename(batch[j]));
        checkpoint.extractedClauses.push(...batchResults[j]);
      }
      saveCheckpoint(checkpoint);
    }
  }

  const allClauses = checkpoint.extractedClauses;
  console.log(`\n═══ Extraction Summary ═══`);
  console.log(`Files processed: ${checkpoint.processedFiles.length}`);
  console.log(`Total clauses extracted: ${allClauses.length}`);

  // Consolidate
  const consolidated = consolidateClauses(allClauses);

  // Save backup
  fs.writeFileSync(CONFIG.BACKUP_FILE, JSON.stringify({
    extracted: allClauses,
    consolidated,
    timestamp: new Date().toISOString(),
  }, null, 2));
  console.log(`\nBackup saved: ${CONFIG.BACKUP_FILE}`);

  // Import to database
  if (!isDryRun) {
    console.log('\n═══ Database Import ═══');
    try {
      const inserted = await importToDatabase(consolidated);
      console.log(`\n✓ Successfully imported ${inserted} clauses!`);

      // Clear checkpoint on success
      if (fs.existsSync(CONFIG.CHECKPOINT_FILE)) {
        fs.unlinkSync(CONFIG.CHECKPOINT_FILE);
      }
    } catch (error) {
      console.error(`\n✗ Database import failed: ${error}`);
      console.log(`  Run with --resume to retry after fixing the issue`);
      process.exit(1);
    }
  } else {
    console.log('\n[DRY RUN] Skipping database import');
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Import Complete                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
