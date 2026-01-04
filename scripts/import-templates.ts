#!/usr/bin/env tsx

/**
 * NyayaMitra Template Import Script
 *
 * Imports legal document templates from a folder with metadata CSV.
 *
 * Usage:
 *   npx tsx scripts/import-templates.ts --batch 100
 *   npx tsx scripts/import-templates.ts --resume
 *
 * Input:
 *   - templates/ folder with .docx files
 *   - metadata.csv with columns: filename, name, description, categoryId, estimatedMinutes
 *
 * Output:
 *   - Templates uploaded to Cloud Storage
 *   - Firestore documents created
 *   - Typesense indexes updated
 *   - Category counts updated
 *   - progress.json (resume capability)
 *   - errors.json (error tracking)
 */

import { readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import { parse as parseCsv } from 'csv-parse/sync';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { randomUUID } from 'crypto';
import admin from 'firebase-admin';
import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import type { Storage, Bucket } from 'firebase-admin/storage';

type TemplateMetadata = {
  filename: string;
  name: string;
  description: string;
  categoryId: string;
  estimatedMinutes: number;
};

type ParsedVariable = {
  name: string;
  type: string;
  label: string;
  required: boolean;
  description: string;
  validation: Record<string, unknown> | null;
  options: string[] | null;
};

type Template = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  estimatedMinutes: number;
  variables: ParsedVariable[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Progress = {
  imported: string[];
  failed: string[];
  lastProcessed: string | null;
  totalProcessed: number;
};

type ErrorLog = {
  filename: string;
  error: string;
  timestamp: string;
};

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
const DEFAULT_VARIABLE_TYPE = 'STRING';
const DEFAULT_BATCH_SIZE = 100;
const PROGRESS_LOG_INTERVAL = 100;
const STORAGE_PATH_PREFIX = 'templates';
const TEMPLATES_DIR = 'templates';
const METADATA_FILE = 'metadata.csv';
const PROGRESS_FILE = 'progress.json';
const ERRORS_FILE = 'errors.json';
const TYPESENSE_COLLECTION = 'templates';

let db: Firestore;
let storage: Storage;
let bucket: Bucket;
let typesenseClient: any;

function initializeFirebase(): void {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable not set');
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: `${serviceAccount.project_id}.appspot.com`
  });

  db = admin.firestore();
  storage = admin.storage();
  bucket = storage.bucket();
}

function initializeTypesense(): void {
  const host = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_API_KEY;

  if (!host || !apiKey) {
    throw new Error('TYPESENSE_HOST and TYPESENSE_API_KEY environment variables required');
  }

  const Typesense = require('typesense');

  typesenseClient = new Typesense.Client({
    nodes: [
      {
        host,
        port: 443,
        protocol: 'https'
      }
    ],
    apiKey,
    connectionTimeoutSeconds: 2
  });
}

function loadProgress(): Progress {
  if (!existsSync(PROGRESS_FILE)) {
    return {
      imported: [],
      failed: [],
      lastProcessed: null,
      totalProcessed: 0
    };
  }

  return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
}

function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function logError(error: ErrorLog): void {
  const errors: ErrorLog[] = existsSync(ERRORS_FILE)
    ? JSON.parse(readFileSync(ERRORS_FILE, 'utf-8'))
    : [];

  errors.push(error);
  writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2));
}

function loadMetadata(): TemplateMetadata[] {
  if (!existsSync(METADATA_FILE)) {
    throw new Error(`Metadata file not found: ${METADATA_FILE}`);
  }

  const csvContent = readFileSync(METADATA_FILE, 'utf-8');
  const records = parseCsv(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  return records.map((record: Record<string, string>): TemplateMetadata => ({
    filename: record.filename,
    name: record.name,
    description: record.description || '',
    categoryId: record.categoryId,
    estimatedMinutes: parseInt(record.estimatedMinutes, 10) || 0
  }));
}

function extractVariablesFromDocx(filePath: string): string[] {
  const content = readFileSync(filePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });

  const text = doc.getFullText();
  const matches = text.match(VARIABLE_PATTERN);

  if (!matches) {
    return [];
  }

  const variables = matches.map((match): string => {
    return match.replace(/\{\{|\}\}/g, '').trim();
  });

  return Array.from(new Set(variables));
}

function generateVariableLabel(varName: string): string {
  return varName
    .split('_')
    .map((word): string => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function parseVariables(variableNames: string[]): ParsedVariable[] {
  return variableNames.map((varName): ParsedVariable => {
    const cleanName = varName.replace(/[^a-zA-Z0-9_]/g, '_');
    const label = generateVariableLabel(varName);

    return {
      name: cleanName,
      type: DEFAULT_VARIABLE_TYPE,
      label,
      required: true,
      description: '',
      validation: null,
      options: null
    };
  });
}

async function getCategoryName(categoryId: string): Promise<string> {
  const categoryDoc = await db.collection('categories').doc(categoryId).get();

  if (!categoryDoc.exists) {
    throw new Error(`Category not found: ${categoryId}`);
  }

  const category = categoryDoc.data();
  return category?.name || 'Unknown';
}

async function uploadToStorage(filePath: string, templateId: string): Promise<void> {
  const destination = `${STORAGE_PATH_PREFIX}/${templateId}.docx`;

  await bucket.upload(filePath, {
    destination,
    metadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
  });
}

async function createFirestoreDocument(template: Template): Promise<void> {
  await db.collection('templates').doc(template.id).set(template);
}

async function indexToTypesense(template: Template): Promise<void> {
  try {
    await typesenseClient.collections(TYPESENSE_COLLECTION).documents().create({
      id: template.id,
      name: template.name,
      description: template.description,
      categoryId: template.categoryId,
      categoryName: template.categoryName,
      isActive: template.isActive
    });
  } catch (error) {
    if (error instanceof Error && !error.message.includes('already exists')) {
      throw error;
    }
  }
}

async function updateCategoryCount(categoryId: string): Promise<void> {
  const categoryRef = db.collection('categories').doc(categoryId);
  const templatesCount = await db
    .collection('templates')
    .where('categoryId', '==', categoryId)
    .count()
    .get();

  await categoryRef.update({
    templateCount: templatesCount.data().count
  });
}

async function processTemplate(
  metadata: TemplateMetadata,
  progress: Progress
): Promise<void> {
  const templatePath = join(TEMPLATES_DIR, metadata.filename);

  if (!existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  const templateId = randomUUID();
  const now = new Date().toISOString();

  const variableNames = extractVariablesFromDocx(templatePath);
  const variables = parseVariables(variableNames);
  const categoryName = await getCategoryName(metadata.categoryId);

  const template: Template = {
    id: templateId,
    name: metadata.name,
    description: metadata.description,
    categoryId: metadata.categoryId,
    categoryName,
    estimatedMinutes: metadata.estimatedMinutes,
    variables,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };

  await uploadToStorage(templatePath, templateId);
  await createFirestoreDocument(template);
  await indexToTypesense(template);

  progress.imported.push(metadata.filename);
  progress.lastProcessed = metadata.filename;
  progress.totalProcessed++;
}

async function importTemplates(batchSize: number, resume: boolean): Promise<void> {
  console.log('🚀 NyayaMitra Template Import');
  console.log('==============================');
  console.log('');

  const metadata = loadMetadata();
  const progress = resume ? loadProgress() : {
    imported: [],
    failed: [],
    lastProcessed: null,
    totalProcessed: 0
  };

  const toProcess = resume
    ? metadata.filter((m) => !progress.imported.includes(m.filename) && !progress.failed.includes(m.filename))
    : metadata;

  console.log(`📊 Total templates: ${metadata.length}`);
  console.log(`📋 To process: ${toProcess.length}`);
  console.log(`✅ Already imported: ${progress.imported.length}`);
  console.log(`❌ Previously failed: ${progress.failed.length}`);
  console.log('');

  const categoryUpdates = new Set<string>();
  let processedInBatch = 0;

  for (const item of toProcess) {
    try {
      console.log(`📝 Processing: ${item.name} (${item.filename})`);

      await processTemplate(item, progress);
      categoryUpdates.add(item.categoryId);

      processedInBatch++;

      if (processedInBatch % PROGRESS_LOG_INTERVAL === 0) {
        console.log(`✅ Progress: ${progress.totalProcessed}/${metadata.length} templates imported`);
        saveProgress(progress);
      }

      if (processedInBatch >= batchSize) {
        console.log('');
        console.log(`⏸️  Batch limit reached (${batchSize}). Saving progress...`);
        saveProgress(progress);
        break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed: ${item.filename} - ${errorMessage}`);

      progress.failed.push(item.filename);
      logError({
        filename: item.filename,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });

      saveProgress(progress);
    }
  }

  console.log('');
  console.log('📊 Updating category counts...');

  for (const categoryId of categoryUpdates) {
    try {
      await updateCategoryCount(categoryId);
      console.log(`✅ Updated category: ${categoryId}`);
    } catch (error) {
      console.error(`❌ Failed to update category: ${categoryId}`);
    }
  }

  saveProgress(progress);

  console.log('');
  console.log('✅ Import complete!');
  console.log('==================');
  console.log(`Total processed: ${progress.totalProcessed}`);
  console.log(`Successfully imported: ${progress.imported.length}`);
  console.log(`Failed: ${progress.failed.length}`);
  console.log('');

  if (progress.failed.length > 0) {
    console.log(`See ${ERRORS_FILE} for error details`);
  }

  if (toProcess.length > processedInBatch) {
    console.log('');
    console.log('⚠️  Not all templates processed. Run with --resume to continue.');
  }
}

function parseArgs(): { batchSize: number; resume: boolean } {
  const args = process.argv.slice(2);
  let batchSize = DEFAULT_BATCH_SIZE;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch' && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--resume') {
      resume = true;
    }
  }

  return { batchSize, resume };
}

async function main(): Promise<void> {
  try {
    const { batchSize, resume } = parseArgs();

    console.log('⚙️  Initializing...');
    console.log('');

    initializeFirebase();
    initializeTypesense();

    console.log('✅ Firebase initialized');
    console.log('✅ Typesense initialized');
    console.log('');

    await importTemplates(batchSize, resume);

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    console.error('');
    process.exit(1);
  }
}

main();
