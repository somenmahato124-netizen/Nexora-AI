import fs from "fs/promises";
import path from "path";

/**
 * ============================================
 * NEXORA AI
 * IMAGE HANDLER
 * ============================================
 *
 * Supported image types:
 * - JPG / JPEG
 * - PNG
 * - WEBP
 * - GIF
 *
 * This module:
 * 1. Validates image files
 * 2. Reads image as Buffer
 * 3. Converts image to Base64
 * 4. Returns Gemini-compatible inlineData
 * ============================================
 */

// ============================================
// SUPPORTED MIME TYPES
// ============================================

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
]);

// ============================================
// MAX IMAGE SIZE
// ============================================

// 10 MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// ============================================
// CHECK IMAGE TYPE
// ============================================

export function isSupportedImage(mimeType) {
  if (!mimeType) {
    return false;
  }

  return SUPPORTED_IMAGE_TYPES.has(
    mimeType.toLowerCase()
  );
}

// ============================================
// GET MIME TYPE FROM FILE EXTENSION
// ============================================

export function getImageMimeType(filePath) {
  const extension = path
    .extname(filePath)
    .toLowerCase();

  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif"
  };

  return mimeTypes[extension] || null;
}

// ============================================
// VALIDATE IMAGE
// ============================================

export async function validateImage(
  filePath,
  mimeType
) {
  if (!filePath) {
    throw new Error(
      "Image file path is required."
    );
  }

  const detectedMimeType =
    mimeType || getImageMimeType(filePath);

  if (!detectedMimeType) {
    throw new Error(
      "Unable to determine image type."
    );
  }

  if (!isSupportedImage(detectedMimeType)) {
    throw new Error(
      `Unsupported image type: ${detectedMimeType}`
    );
  }

  const stats = await fs.stat(filePath);

  if (stats.size === 0) {
    throw new Error(
      "The uploaded image is empty."
    );
  }

  if (stats.size > MAX_IMAGE_SIZE) {
    throw new Error(
      "Image is too large. Maximum supported size is 10 MB."
    );
  }

  return {
    valid: true,
    mimeType: detectedMimeType,
    size: stats.size
  };
}

// ============================================
// READ IMAGE
// ============================================

export async function readImage(
  filePath,
  mimeType
) {
  await validateImage(
    filePath,
    mimeType
  );

  const buffer =
    await fs.readFile(filePath);

  const detectedMimeType =
    mimeType ||
    getImageMimeType(filePath);

  return {
    buffer,
    mimeType: detectedMimeType,
    size: buffer.length
  };
}

// ============================================
// CONVERT IMAGE TO BASE64
// ============================================

export async function imageToBase64(
  filePath,
  mimeType
) {
  const image = await readImage(
    filePath,
    mimeType
  );

  return {
    base64: image.buffer.toString(
      "base64"
    ),

    mimeType: image.mimeType,

    size: image.size
  };
}

// ============================================
// GEMINI INLINE IMAGE
// ============================================

export async function imageToGeminiPart(
  filePath,
  mimeType
) {
  const image =
    await imageToBase64(
      filePath,
      mimeType
    );

  return {
    inlineData: {
      mimeType: image.mimeType,
      data: image.base64
    }
  };
}

// ============================================
// IMAGE INFORMATION
// ============================================

export async function getImageInfo(
  filePath,
  mimeType
) {
  const image =
    await validateImage(
      filePath,
      mimeType
    );

  return {
    fileName: path.basename(filePath),

    mimeType: image.mimeType,

    size: image.size,

    sizeInKB:
      Math.round(
        image.size / 1024
      ),

    sizeInMB:
      Number(
        (
          image.size /
          (1024 * 1024)
        ).toFixed(2)
      )
  };
}

// ============================================
// EXPORT CONSTANTS
// ============================================

export const IMAGE_LIMITS = {
  maxSize: MAX_IMAGE_SIZE,

  maxSizeMB:
    MAX_IMAGE_SIZE /
    (1024 * 1024),

  supportedTypes:
    Array.from(
      SUPPORTED_IMAGE_TYPES
    )
};