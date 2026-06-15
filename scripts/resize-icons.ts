/**
 * Resize all icons under public/icons to fit within 128×128 (preserving aspect ratio).
 *
 * Run:  npm run icons:resize
 *
 * Behavior:
 *   - Recursively walks public/icons collecting .png/.jpg/.jpeg/.webp/.gif files.
 *   - Skips files already ≤ 128×128 in both dimensions (idempotent / safe to re-run).
 *   - Resizes in-place using a Buffer (never reads and writes the same path simultaneously).
 *   - Prints a summary of counts and byte savings.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sharp from 'sharp';

const ICONS_DIR = path.join(process.cwd(), 'public', 'icons');
const MAX_DIM = 128;
const SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

async function collectImages(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectImages(fullPath);
      results.push(...nested);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

async function main(): Promise<void> {
  console.log(`\nResize Icons — target: ${MAX_DIM}×${MAX_DIM}`);
  console.log('='.repeat(60));
  console.log(`  directory: ${ICONS_DIR}\n`);

  const images = await collectImages(ICONS_DIR);
  console.log(`  found ${images.length} image file(s)\n`);

  let resized = 0;
  let skipped = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;
  let errors = 0;

  for (const imgPath of images) {
    const name = path.relative(ICONS_DIR, imgPath);

    try {
      const statBefore = await fs.stat(imgPath);
      totalBytesBefore += statBefore.size;

      const metadata = await sharp(imgPath).metadata();
      const w = metadata.width ?? 0;
      const h = metadata.height ?? 0;

      if (w <= MAX_DIM && h <= MAX_DIM) {
        console.log(`  skip  ${name}  (already ${w}×${h})`);
        totalBytesAfter += statBefore.size;
        skipped++;
        continue;
      }

      // Resize to buffer first, then write — never open same path for read+write simultaneously.
      const ext = path.extname(imgPath).toLowerCase();
      let pipeline = sharp(imgPath).resize({
        width: MAX_DIM,
        height: MAX_DIM,
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Explicitly re-encode in the original format to preserve transparency (PNG) etc.
      if (ext === '.png') {
        pipeline = pipeline.png();
      } else if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg();
      } else if (ext === '.webp') {
        pipeline = pipeline.webp();
      } else if (ext === '.gif') {
        pipeline = pipeline.gif();
      }

      const buffer = await pipeline.toBuffer();
      await fs.writeFile(imgPath, buffer);

      const statAfter = await fs.stat(imgPath);
      totalBytesAfter += statAfter.size;

      const saving = statBefore.size - statAfter.size;
      console.log(
        `  resize  ${name}  ${w}×${h} → ≤${MAX_DIM}×${MAX_DIM}  (-${(saving / 1024).toFixed(1)} KB)`,
      );
      resized++;
    } catch (err) {
      console.error(
        `  ERROR  ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      errors++;
    }
  }

  const savedBytes = totalBytesBefore - totalBytesAfter;
  const savedMB = (savedBytes / 1024 / 1024).toFixed(2);
  const beforeMB = (totalBytesBefore / 1024 / 1024).toFixed(2);
  const afterMB = (totalBytesAfter / 1024 / 1024).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log(`  resized : ${resized}`);
  console.log(`  skipped : ${skipped} (already ≤${MAX_DIM}×${MAX_DIM})`);
  console.log(`  errors  : ${errors}`);
  console.log(`  before  : ${beforeMB} MB`);
  console.log(`  after   : ${afterMB} MB`);
  console.log(`  saved   : ${savedMB} MB`);
  console.log('='.repeat(60) + '\n');

  if (errors > 0) {
    process.exit(1);
  }
}

void main();
