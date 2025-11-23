/**
 * Script to help identify and update remaining action files that need database client updates
 *
 * This script scans action files and identifies functions that still use direct prisma imports
 * instead of using the prisma client from context.
 */

import fs from 'fs';
import path from 'path';

const FEATURES_DIR = path.join(process.cwd(), 'src', 'features');

interface ActionFile {
  path: string;
  content: string;
  needsUpdate: boolean;
  issues: string[];
}

function scanActionFiles(): ActionFile[] {
  const actionFiles: ActionFile[] = [];

  // Get all feature directories
  const featureDirs = fs
    .readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const featureDir of featureDirs) {
    const actionsPath = path.join(FEATURES_DIR, featureDir, 'actions.ts');

    if (fs.existsSync(actionsPath)) {
      const content = fs.readFileSync(actionsPath, 'utf-8');
      const issues = analyzeActionFile(content);

      actionFiles.push({
        path: actionsPath,
        content,
        needsUpdate: issues.length > 0,
        issues,
      });
    }
  }

  return actionFiles;
}

function analyzeActionFile(content: string): string[] {
  const issues: string[] = [];
  // const lines = content.split('\n'); // Commented out as not used

  // Check for direct prisma import
  if (content.includes("import prisma from '@/lib/prisma'")) {
    issues.push('Still imports prisma directly');
  }

  // Check for handler functions that don't destructure ctx
  const handlerRegex =
    /\.handler\s*\(\s*async\s*\(\s*\{\s*([^}]*)\s*\}\s*\)\s*=>/g;
  let match;

  while ((match = handlerRegex.exec(content)) !== null) {
    const params = match[1];
    if (!params.includes('ctx:')) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      issues.push(`Line ${lineNumber}: Handler doesn't destructure ctx`);
    }
  }

  // Check for direct prisma usage
  const prismaUsageRegex = /await\s+prisma\./g;
  while ((match = prismaUsageRegex.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    issues.push(`Line ${lineNumber}: Direct prisma usage found`);
  }

  return issues;
}

function generateUpdateInstructions(actionFiles: ActionFile[]): void {
  console.log('='.repeat(80));
  console.log('DATABASE SEPARATION - REMAINING ACTION FILE UPDATES');
  console.log('='.repeat(80));
  console.log();

  const filesToUpdate = actionFiles.filter((file) => file.needsUpdate);

  if (filesToUpdate.length === 0) {
    console.log('✅ All action files are already updated!');
    return;
  }

  console.log(`Found ${filesToUpdate.length} files that need updates:\n`);

  filesToUpdate.forEach((file, index) => {
    const relativePath = path.relative(process.cwd(), file.path);
    console.log(`${index + 1}. ${relativePath}`);
    console.log(`   Issues found:`);
    file.issues.forEach((issue) => {
      console.log(`   - ${issue}`);
    });
    console.log();
  });

  console.log('UPDATE INSTRUCTIONS:');
  console.log('='.repeat(40));
  console.log();
  console.log('For each file above, make these changes:');
  console.log();
  console.log('1. Remove the direct prisma import:');
  console.log("   - Remove: import prisma from '@/lib/prisma';");
  console.log();
  console.log('2. Update handler functions to destructure ctx:');
  console.log('   - Change: .handler(async ({ input }) => {');
  console.log('   - To:     .handler(async ({ input, ctx: { prisma } }) => {');
  console.log();
  console.log('3. For handlers with no input:');
  console.log('   - Change: .handler(async () => {');
  console.log('   - To:     .handler(async ({ ctx: { prisma } }) => {');
  console.log();
  console.log('4. For handlers with multiple parameters:');
  console.log('   - Change: .handler(async ({ input: { id, ...rest } }) => {');
  console.log(
    '   - To:     .handler(async ({ input: { id, ...rest }, ctx: { prisma } }) => {',
  );
  console.log();
}

// Run the analysis
if (require.main === module) {
  try {
    const actionFiles = scanActionFiles();
    generateUpdateInstructions(actionFiles);
  } catch (error) {
    console.error('Error analyzing action files:', error);
    process.exit(1);
  }
}

export { scanActionFiles, analyzeActionFile };
