import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const IMAGES_DIR = process.env.IMAGES_DIR || './downloads'; // Directory where images are stored
const MAPPING_FILE = process.env.MAPPING_FILE || './src/mapping_sample.json';

/**
 * Processes a single image: crops it (if needed) and renames it
 */
async function processImage(downloadedName, config) {
  try {
    // Find the image file (try common extensions)
    const extensions = ['.jpg', '.jpeg', '.png'];
    let inputPath = null;
    let ext = null;

    for (const extension of extensions) {
      const testPath = path.join(IMAGES_DIR, `${downloadedName}${extension}`);
      try {
        await fs.access(testPath);
        inputPath = testPath;
        ext = extension;
        break;
      } catch {
        // File doesn't exist with this extension, try next
      }
    }

    if (!inputPath) {
      console.log(`⚠️  Skipping ${downloadedName} - file not found`);
      return;
    }

    // Check if crop config is valid
    const shouldCrop = config.crop.width > 0 && config.crop.height > 0;

    // Prepare output path (same directory, new name)
    const outputFileName = `${config.renameTo}${ext}`;
    const outputPath = path.join(IMAGES_DIR, outputFileName);
    const tempPath = path.join(IMAGES_DIR, `_temp_${outputFileName}`);

    if (shouldCrop) {
      // Crop and save to temp file first
      await sharp(inputPath)
        .extract({
          left: config.crop.x,
          top: config.crop.y,
          width: config.crop.width,
          height: config.crop.height
        })
        .toFile(tempPath);

      // Delete original file
      await fs.unlink(inputPath);

      // Rename temp file to final name
      await fs.rename(tempPath, outputPath);

      console.log(`✅ Cropped and renamed: ${downloadedName} → ${config.renameTo}`);
    } else {
      // Just rename (no crop needed)
      await fs.rename(inputPath, outputPath);

      console.log(`✅ Renamed (no crop): ${downloadedName} → ${config.renameTo}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${downloadedName}:`, error.message);
  }
}

/**
 * Main function to process all images from the mapping
 */
async function main() {
  try {
    // Ensure images directory exists
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    console.log(`📁 Images directory: ${IMAGES_DIR}\n`);

    // Load the mapping file
    const mappingData = await fs.readFile(MAPPING_FILE, 'utf-8');
    const mapping = JSON.parse(mappingData);

    console.log(`📋 Processing ${Object.keys(mapping).length} images...\n`);

    // Process each image
    for (const config of Object.values(mapping)) {
      await processImage(config.downloadedName, config);
    }

    console.log('\n✨ Processing complete!');
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();