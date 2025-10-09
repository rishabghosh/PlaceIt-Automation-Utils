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
const IMAGES_DIR = process.env.IMAGES_DIR
const MAPPING_FILE = process.env.MAPPING_FILE

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

    // Prepare output paths
    const outputDir = path.join(IMAGES_DIR, 'raw');
    await fs.mkdir(outputDir, { recursive: true });
    const outputFileName = `${config.renameTo}${ext}`;
    const rawPath = path.join(outputDir, outputFileName);
    const croppedPath = path.join(IMAGES_DIR, outputFileName);
    const tempCroppedPath = path.join(IMAGES_DIR, `_temp_${outputFileName}`);

    // Move and rename the original image to raw folder
    await fs.rename(inputPath, rawPath);
    console.log(`✅ Moved and renamed original: ${downloadedName} → raw/${config.renameTo}`);

    // Check if crop config is valid
    const shouldCrop = config.crop.width > 0 && config.crop.height > 0;

    if (shouldCrop) {
      // Crop from raw image and save to IMAGES_DIR
      await sharp(rawPath)
        .extract({
          left: config.crop.x,
          top: config.crop.y,
          width: config.crop.width,
          height: config.crop.height
        })
        .toFile(tempCroppedPath);
      await fs.rename(tempCroppedPath, croppedPath);
      console.log(`✅ Cropped: raw/${config.renameTo} → ${config.renameTo}`);
    } else {
      // Just copy the raw image to IMAGES_DIR (no crop)
      await fs.copyFile(rawPath, croppedPath);
      console.log(`✅ Copied (no crop): raw/${config.renameTo} → ${config.renameTo}`);
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
    // Ensure raw directory exists
    const rawDir = path.join(IMAGES_DIR, 'raw');
    await fs.mkdir(rawDir, { recursive: true });
    console.log(`📁 Images directory: ${IMAGES_DIR}`);
    console.log(`📁 Raw directory: ${rawDir}\n`);

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