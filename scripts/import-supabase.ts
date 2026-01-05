#!/usr/bin/env tsx

/**
 * NyayaMitra Template Import for Supabase
 * 
 * Imports 3500+ legal templates to Supabase Postgres + Storage
 * 
 * Features:
 * - Auto-creates categories from folder structure
 * - Parses {var} and [VAR] variable patterns
 * - Uploads .docx to Supabase Storage  
 * - Creates Postgres records
 * - Resumable with progress tracking
 * - Batch processing
 * 
 * Usage:
 *   cd scripts
 *   pnpm import:supabase
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import PizZip from 'pizzip';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// =================================================================
// CONFIGURATION
// =================================================================

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  sourceFolders: [
    '/Users/aabhinay/Desktop/English Legal draft',
    '/Users/aabhinay/Desktop/3500+ Legal Drafts',
  ],
  progressFile: './import-progress-supabase.json',
  errorLogFile: './import-errors-supabase.json',
  batchSize: 10,
  dryRun: process.env.DRY_RUN === 'true',
};

// =================================================================
// TYPES
// =================================================================

interface TemplateVariable {
  name: string;
  label: string;
  type: 'STRING' | 'TEXT' | 'DATE' | 'NUMBER' | 'CURRENCY' | 'SELECT' | 'MULTISELECT' | 'PHONE' | 'EMAIL';
  required: boolean;
  order: number;
}

interface ImportProgress {
  imported: string[];
  failed: Array<{ file: string; error: string }>;
  categories: Record<string, string>;
  lastUpdated: string;
  totalProcessed: number;
}

// =================================================================
// HELPER FUNCTIONS
// =================================================================

function loadProgress(): ImportProgress {
  if (fs.existsSync(CONFIG.progressFile)) {
    return JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf-8'));
  }
  return {
    imported: [],
    failed: [],
    categories: {},
    lastUpdated: new Date().toISOString(),
    totalProcessed: 0,
  };
}

function saveProgress(progress: ImportProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function parseVariables(filePath: string): TemplateVariable[] {
  try {
    const content = fs.readFileSync(filePath);
    const zip = new PizZip(content);
    const xml = zip.file('word/document.xml')?.asText() || '';

    // Match {var} and [VAR] patterns
    const curlyMatches = xml.match(/\{[A-Za-z][^{}]*\}/g) || [];
    const squareMatches = xml.match(/\[[A-Z][^\]]*\]/g) || [];

    const allMatches = [...curlyMatches, ...squareMatches]
      .map(m => m.replace(/^[\{\[]|[\}\]]$/g, '').trim())
      .filter(v => v.length > 0 && v.length < 100 && /^[A-Za-z]/.test(v));

    const uniqueVars = [...new Set(allMatches)];

    return uniqueVars.map((name, index): TemplateVariable => {
      const lowerName = name.toLowerCase();

      // Infer type from variable name
      let type: TemplateVariable['type'] = 'STRING';

      if (lowerName.includes('date') || lowerName.includes('_on') || lowerName.includes('_at') || lowerName.includes(' on ') || lowerName.includes(' at ')) {
        type = 'DATE';
      } else if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('rent') || lowerName.includes('salary') || lowerName.includes('fee') || lowerName.includes('cost')) {
        type = 'CURRENCY';
      } else if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('contact')) {
        type = 'PHONE';
      } else if (lowerName.includes('email') || lowerName.includes('e-mail')) {
        type = 'EMAIL';
      } else if (lowerName.includes('address') || lowerName.includes('description') || lowerName.includes('details') || lowerName.includes('reason')) {
        type = 'TEXT';
      } else if (lowerName.includes('number') || lowerName.includes('count') || lowerName.includes('quantity') || lowerName.includes('age')) {
        type = 'NUMBER';
      }

      return {
        name,
        label: name.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
        type,
        required: true,
        order: index + 1,
      };
    });
  } catch (error) {
    console.error(`Error parsing variables from ${path.basename(filePath)}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

function getAllDocxFiles(): Array<{ path: string; sourceFolder: string }> {
  const files: Array<{ path: string; sourceFolder: string }> = [];

  for (const sourceFolder of CONFIG.sourceFolders) {
    if (!fs.existsSync(sourceFolder)) {
      console.warn(`Source folder not found: ${sourceFolder}`);
      continue;
    }

    const walkDir = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.name.endsWith('.docx')) {
            files.push({ path: fullPath, sourceFolder });
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error instanceof Error ? error.message : String(error));
      }
    };

    walkDir(sourceFolder);
  }

  return files;
}

function extractCategory(filePath: string, sourceFolder: string): { name: string; slug: string } {
  const relativePath = path.relative(sourceFolder, filePath);
  const parts = relativePath.split(path.sep);

  if (parts.length > 1) {
    const categoryName = parts[0];
    return { name: categoryName, slug: slugify(categoryName) };
  }

  return { name: 'General', slug: 'general' };
}

// =================================================================
// SUPABASE OPERATIONS
// =================================================================

async function ensureCategory(
  supabase: SupabaseClient,
  categorySlug: string,
  categoryName: string,
  progress: ImportProgress
): Promise<string> {
  // Check cache
  if (progress.categories[categorySlug]) {
    return progress.categories[categorySlug];
  }

  if (CONFIG.dryRun) {
    const categoryId = `cat-${categorySlug}`;
    progress.categories[categorySlug] = categoryId;
    return categoryId;
  }

  // Check if exists
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (existing) {
    progress.categories[categorySlug] = existing.id;
    return existing.id;
  }

  // Create new category
  const categoryId = `cat-${categorySlug}`;
  const { error } = await supabase.from('categories').insert({
    id: categoryId,
    name: categoryName,
    slug: categorySlug,
    icon: 'file',
    description: `${categoryName} legal documents`,
    sort_order: Object.keys(progress.categories).length + 1,
    template_count: 0,
    is_active: true,
  });

  if (error) throw error;

  progress.categories[categorySlug] = categoryId;
  console.log(`  ✓ Created category: ${categoryName}`);
  return categoryId;
}

async function uploadTemplate(
  supabase: SupabaseClient,
  filePath: string,
  storagePath: string
): Promise<void> {
  if (CONFIG.dryRun) return;

  const fileContent = fs.readFileSync(filePath);

  const { error } = await supabase.storage
    .from('templates')
    .upload(storagePath, fileContent, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });

  if (error) throw error;
}

async function createTemplate(
  supabase: SupabaseClient,
  templateData: {
    id: string;
    category_id: string;
    name: string;
    slug: string;
    description: string;
    keywords: string[];
    template_file_path: string;
    variables: TemplateVariable[];
    estimated_minutes: number;
  }
): Promise<void> {
  if (CONFIG.dryRun) return;

  const { error } = await supabase.from('templates').insert(templateData);

  if (error) throw error;
}

async function incrementCategoryCount(
  supabase: SupabaseClient,
  categoryId: string
): Promise<void> {
  if (CONFIG.dryRun) return;

  await supabase.rpc('increment_category_count', { cat_id: categoryId });
}

// =================================================================
// MAIN IMPORT
// =================================================================

async function importTemplates(): Promise<void> {
  console.log('========================================');
  console.log('NyayaMitra Supabase Template Import');
  console.log('========================================\n');

  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Validate config
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables required');
  }

  // Initialize Supabase
  console.log('Initializing Supabase client...');
  const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

  // Load progress
  const progress = loadProgress();

  // Scan files
  console.log('\nScanning source folders...');
  const allFiles = getAllDocxFiles();
  console.log(`Found ${allFiles.length} .docx files`);

  const pendingFiles = allFiles.filter(f => !progress.imported.includes(f.path));
  console.log(`${pendingFiles.length} files pending import`);
  console.log(`${progress.imported.length} files already imported`);
  console.log(`${Object.keys(progress.categories).length} categories created\n`);

  if (pendingFiles.length === 0) {
    console.log('✓ All files already imported!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  console.log('Starting import...\n');

  // Process in batches
  for (let i = 0; i < pendingFiles.length; i += CONFIG.batchSize) {
    const batch = pendingFiles.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(pendingFiles.length / CONFIG.batchSize);

    console.log(`\n--- Batch ${batchNum}/${totalBatches} ---`);

    for (const file of batch) {
      const fileName = path.basename(file.path, '.docx');

      try {
        // Extract category
        const { name: categoryName, slug: categorySlug } = extractCategory(file.path, file.sourceFolder);
        const categoryId = await ensureCategory(supabase, categorySlug, categoryName, progress);

        // Parse variables
        const variables = parseVariables(file.path);

        // Generate IDs and paths
        const templateId = `tpl-${slugify(fileName)}-${randomUUID().slice(0, 8)}`;
        const storagePath = `${categorySlug}/${templateId}.docx`;

        // Upload to storage
        await uploadTemplate(supabase, file.path, storagePath);

        // Create template record
        const keywords = [
          categoryName.toLowerCase(),
          ...fileName.toLowerCase().split(/[\s_-]+/).filter(w => w.length > 2).slice(0, 10),
        ];

        await createTemplate(supabase, {
          id: templateId,
          category_id: categoryId,
          name: fileName,
          slug: slugify(fileName),
          description: variables.length > 0
            ? `${fileName} - ${variables.length} customizable field${variables.length > 1 ? 's' : ''}`
            : `${fileName} - Ready to use template`,
          keywords: [...new Set(keywords)],
          template_file_path: storagePath,
          variables,
          estimated_minutes: variables.length > 0 ? Math.max(5, variables.length * 2) : 2,
        });

        // Increment category count
        await incrementCategoryCount(supabase, categoryId);

        // Track progress
        progress.imported.push(file.path);
        progress.totalProcessed++;
        successCount++;

        const varInfo = variables.length > 0 ? ` (${variables.length} vars)` : ' (static)';
        console.log(`  ✓ ${fileName}${varInfo}`);

        // Save progress periodically
        if (successCount % 10 === 0) {
          saveProgress(progress);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ ${fileName}: ${errorMessage}`);

        progress.failed.push({
          file: file.path,
          error: errorMessage,
        });
        errorCount++;
      }
    }

    // Save progress after each batch
    saveProgress(progress);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Final summary
  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');
  console.log(`Total files found: ${allFiles.length}`);
  console.log(`Successfully imported: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(`Categories created: ${Object.keys(progress.categories).length}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Progress saved to: ${CONFIG.progressFile}`);

  if (errorCount > 0) {
    console.log(`\n⚠️  Error details saved to: ${CONFIG.errorLogFile}`);
    fs.writeFileSync(CONFIG.errorLogFile, JSON.stringify(progress.failed, null, 2));
  }

  if (CONFIG.dryRun) {
    console.log('\n🔍 DRY RUN - No actual changes were made');
  }
}

// Run
importTemplates().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
