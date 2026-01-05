import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import Typesense from 'typesense';
import PizZip from 'pizzip';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// Types
interface TemplateVariable {
  name: string;
  label: string;
  type: 'STRING' | 'TEXT' | 'DATE' | 'NUMBER' | 'CURRENCY' | 'SELECT' | 'MULTISELECT' | 'PHONE' | 'EMAIL';
  required: boolean;
  order: number;
}

interface ImportedTemplate {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string;
  keywords: string[];
  templateFileURL: string;
  variables: TemplateVariable[];
  estimatedMinutes: number;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
}

interface ImportProgress {
  imported: string[];
  failed: Array<{ file: string; error: string }>;
  lastUpdated: string;
  totalProcessed: number;
}

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  templateCount: number;
}

// Configuration
const CONFIG = {
  sourceFolders: [
    '/Users/aabhinay/Desktop/English Legal draft',
    '/Users/aabhinay/Desktop/3500+ Legal Drafts',
  ],
  progressFile: './import-progress.json',
  errorLogFile: './import-errors.json',
  batchSize: 10,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  dryRun: process.env.DRY_RUN === 'true',
};

// Initialize Firebase
function initFirebase(): { db: Firestore; storage: Storage } {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

  const app = initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
    storageBucket: CONFIG.storageBucket,
  });

  return {
    db: getFirestore(app),
    storage: getStorage(app),
  };
}

// Initialize Typesense
function initTypesense(): Typesense.Client {
  return new Typesense.Client({
    nodes: [{
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: parseInt(process.env.TYPESENSE_PORT || '8108'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'https',
    }],
    apiKey: process.env.TYPESENSE_API_KEY || '',
    connectionTimeoutSeconds: 10,
  });
}

// Load progress
function loadProgress(): ImportProgress {
  if (fs.existsSync(CONFIG.progressFile)) {
    return JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf-8'));
  }
  return { imported: [], failed: [], lastUpdated: new Date().toISOString(), totalProcessed: 0 };
}

// Save progress
function saveProgress(progress: ImportProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
}

// Parse variables from .docx - supports {var} and [VAR] patterns
function parseVariables(filePath: string): TemplateVariable[] {
  const content = fs.readFileSync(filePath);
  const zip = new PizZip(content);
  const xml = zip.file('word/document.xml')?.asText() || '';

  // Find all {var} and [VAR] patterns
  const curlyMatches = xml.match(/\{[A-Za-z][^{}]*\}/g) || [];
  const squareMatches = xml.match(/\[[A-Z][^\]]*\]/g) || [];

  const allMatches = [...curlyMatches, ...squareMatches].map(m =>
    m.replace(/^\{|\}$|\[|\]/g, '').trim()
  );

  const uniqueVars = [...new Set(allMatches)].filter(v =>
    v.length > 0 && v.length < 100 && /^[A-Za-z]/.test(v)
  );

  return uniqueVars.map((name, index): TemplateVariable => {
    const lowerName = name.toLowerCase();

    // Infer type from variable name
    let type: TemplateVariable['type'] = 'STRING';
    if (lowerName.includes('date') || lowerName.includes('_on') || lowerName.includes('_at') || lowerName.includes(' on ') || lowerName.includes(' at ')) {
      type = 'DATE';
    } else if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('rent') || lowerName.includes('salary') || lowerName.includes('fee') || lowerName.includes('cost') || lowerName.includes('payment')) {
      type = 'CURRENCY';
    } else if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('contact')) {
      type = 'PHONE';
    } else if (lowerName.includes('email') || lowerName.includes('e-mail')) {
      type = 'EMAIL';
    } else if (lowerName.includes('address') || lowerName.includes('description') || lowerName.includes('details') || lowerName.includes('reason') || lowerName.includes('explanation')) {
      type = 'TEXT';
    } else if (lowerName.includes('number') || lowerName.includes('count') || lowerName.includes('quantity') || lowerName.includes('age') || lowerName.includes('years')) {
      type = 'NUMBER';
    }

    return {
      name,
      label: name.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      type,
      required: true,
      order: index + 1,
    };
  });
}

// Generate slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// Extract category from folder path
function extractCategory(filePath: string, sourceFolder: string): { name: string; slug: string } {
  const relativePath = path.relative(sourceFolder, filePath);
  const parts = relativePath.split(path.sep);

  if (parts.length > 1) {
    const categoryName = parts[0];
    return { name: categoryName, slug: slugify(categoryName) };
  }

  return { name: 'General', slug: 'general' };
}

// Get all .docx files
function getAllDocxFiles(): Array<{ path: string; sourceFolder: string }> {
  const files: Array<{ path: string; sourceFolder: string }> = [];

  for (const sourceFolder of CONFIG.sourceFolders) {
    if (!fs.existsSync(sourceFolder)) {
      console.warn(\`Source folder not found: \${sourceFolder}\`);
      continue;
    }

    const walkDir = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith('.docx') && !entry.name.startsWith('~$')) {
          files.push({ path: fullPath, sourceFolder });
        }
      }
    };

    walkDir(sourceFolder);
  }

  return files;
}

// Ensure category exists
async function ensureCategory(
  db: Firestore,
  categorySlug: string,
  categoryName: string,
  categories: Map<string, CategoryInfo>
): Promise<string> {
  if (categories.has(categorySlug)) {
    return categories.get(categorySlug)!.id;
  }

  // Check if exists in Firestore
  const existing = await db.collection('categories').where('slug', '==', categorySlug).get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    const info: CategoryInfo = {
      id: doc.id,
      name: doc.data().name,
      slug: categorySlug,
      templateCount: doc.data().templateCount || 0,
    };
    categories.set(categorySlug, info);
    return doc.id;
  }

  // Create new category
  const categoryId = \`cat-\${categorySlug}\`;

  if (!CONFIG.dryRun) {
    await db.collection('categories').doc(categoryId).set({
      id: categoryId,
      name: categoryName,
      slug: categorySlug,
      icon: 'file-text',
      description: \`\${categoryName} legal documents and templates\`,
      order: categories.size + 1,
      templateCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const info: CategoryInfo = {
    id: categoryId,
    name: categoryName,
    slug: categorySlug,
    templateCount: 0,
  };
  categories.set(categorySlug, info);

  console.log(\`  ✓ Created category: \${categoryName}\`);
  return categoryId;
}

// Upload template to storage
async function uploadTemplate(
  storage: Storage,
  filePath: string,
  templateId: string
): Promise<string> {
  if (CONFIG.dryRun) {
    return \`gs://\${CONFIG.storageBucket}/templates/\${templateId}.docx\`;
  }

  const bucket = storage.bucket();
  const destination = \`templates/\${templateId}.docx\`;

  await bucket.upload(filePath, {
    destination,
    metadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      metadata: {
        originalFilename: path.basename(filePath),
      },
    },
  });

  return \`gs://\${bucket.name}/\${destination}\`;
}

// Ensure Typesense collection exists
async function ensureTypesenseCollection(typesense: Typesense.Client): Promise<void> {
  try {
    await typesense.collections('templates').retrieve();
  } catch (error) {
    if ((error as any).httpStatus === 404) {
      console.log('Creating Typesense collection: templates');
      await typesense.collections().create({
        name: 'templates',
        fields: [
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'categoryId', type: 'string', facet: true },
          { name: 'categoryName', type: 'string', facet: true },
          { name: 'keywords', type: 'string[]', facet: true },
          { name: 'variableCount', type: 'int32' },
          { name: 'estimatedMinutes', type: 'int32' },
          { name: 'hasVariables', type: 'bool', facet: true },
        ],
        default_sorting_field: 'estimatedMinutes',
      });
    } else {
      throw error;
    }
  }
}

// Index template in Typesense
async function indexTemplate(
  typesense: Typesense.Client,
  template: ImportedTemplate
): Promise<void> {
  if (CONFIG.dryRun) {
    return;
  }

  try {
    await typesense.collections('templates').documents().upsert({
      id: template.id,
      name: template.name,
      description: template.description,
      categoryId: template.categoryId,
      categoryName: template.categoryName,
      keywords: template.keywords,
      variableCount: template.variables.length,
      estimatedMinutes: template.estimatedMinutes,
      hasVariables: template.variables.length > 0,
    });
  } catch (error) {
    console.error(\`  ✗ Failed to index in Typesense: \${(error as Error).message}\`);
  }
}

// Main import function
async function importTemplates(): Promise<void> {
  console.log('========================================');
  console.log('NyayaMitra Template Import System');
  console.log('========================================\\n');

  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\\n');
  }

  console.log('Initializing services...');
  const { db, storage } = initFirebase();
  const typesense = initTypesense();

  if (!CONFIG.dryRun) {
    await ensureTypesenseCollection(typesense);
  }

  const progress = loadProgress();
  const categories = new Map<string, CategoryInfo>();

  console.log('\\nScanning source folders...');
  const allFiles = getAllDocxFiles();
  console.log(\`Found \${allFiles.length} .docx files\`);

  const pendingFiles = allFiles.filter(f => !progress.imported.includes(f.path));
  console.log(\`\${pendingFiles.length} files pending import\`);
  console.log(\`\${progress.imported.length} files already imported\\n\`);

  if (pendingFiles.length === 0) {
    console.log('✓ All files already imported!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  console.log('Starting import...\\n');

  // Process in batches
  for (let i = 0; i < pendingFiles.length; i += CONFIG.batchSize) {
    const batch = pendingFiles.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(pendingFiles.length / CONFIG.batchSize);

    console.log(\`\\n--- Batch \${batchNum}/\${totalBatches} ---\`);

    for (const file of batch) {
      const fileName = path.basename(file.path, '.docx');

      try {
        // Generate unique template ID
        const baseSlug = slugify(fileName);
        const templateId = \`tpl-\${baseSlug}-\${randomUUID().slice(0, 8)}\`;

        // Extract category
        const { name: categoryName, slug: categorySlug } = extractCategory(file.path, file.sourceFolder);
        const categoryId = await ensureCategory(db, categorySlug, categoryName, categories);

        // Parse variables
        const variables = parseVariables(file.path);

        // Upload to storage
        const templateFileURL = await uploadTemplate(storage, file.path, templateId);

        // Generate keywords from filename and category
        const keywords = [
          categoryName.toLowerCase(),
          ...fileName.toLowerCase().split(/[\s_-]+/).filter(w => w.length > 2),
        ];

        // Create template document
        const template: ImportedTemplate = {
          id: templateId,
          categoryId,
          categoryName,
          name: fileName,
          slug: baseSlug,
          description: variables.length > 0
            ? \`\${fileName} - \${variables.length} customizable field\${variables.length > 1 ? 's' : ''}\`
            : \`\${fileName} - Ready to use template\`,
          keywords: [...new Set(keywords)],
          templateFileURL,
          variables,
          estimatedMinutes: variables.length > 0 ? Math.max(5, variables.length * 2) : 2,
          isActive: true,
          usageCount: 0,
          createdAt: new Date(),
        };

        if (!CONFIG.dryRun) {
          await db.collection('templates').doc(templateId).set(template);

          // Update category count
          await db.collection('categories').doc(categoryId).update({
            templateCount: FieldValue.increment(1),
            updatedAt: new Date(),
          });

          // Index in Typesense
          await indexTemplate(typesense, template);
        }

        // Track progress
        progress.imported.push(file.path);
        progress.totalProcessed++;
        successCount++;

        const varInfo = variables.length > 0 ? \` (\${variables.length} vars)\` : ' (static)';
        console.log(\`  ✓ \${fileName}\${varInfo}\`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(\`  ✗ \${fileName}: \${errorMessage}\`);

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
  console.log('\\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');
  console.log(\`Total files found: \${allFiles.length}\`);
  console.log(\`Successfully imported: \${successCount}\`);
  console.log(\`Failed: \${errorCount}\`);
  console.log(\`Categories created: \${categories.size}\`);
  console.log(\`Duration: \${duration}s\`);
  console.log(\`Progress saved to: \${CONFIG.progressFile}\`);

  if (errorCount > 0) {
    console.log(\`\\n⚠️  Error details saved to: \${CONFIG.errorLogFile}\`);
    fs.writeFileSync(CONFIG.errorLogFile, JSON.stringify(progress.failed, null, 2));
  }

  if (CONFIG.dryRun) {
    console.log('\\n🔍 DRY RUN - No actual changes were made');
  }
}

// Run
importTemplates().catch((error) => {
  console.error('\\n❌ Fatal error:', error);
  process.exit(1);
});
