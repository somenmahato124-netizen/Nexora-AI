import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;

const SUPPORTED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".docx"
]);

function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

export function getDocumentMimeType(filePath) {
  const extension = getExtension(filePath);

  if (extension === ".pdf") {
    return "application/pdf";
  }

  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return null;
}

export function isSupportedDocument(filePath) {
  if (!filePath) {
    return false;
  }

  const extension = getExtension(filePath);

  return SUPPORTED_EXTENSIONS.has(extension);
}

export async function validateDocument(filePath) {
  if (!filePath) {
    throw new Error("Document file path is required.");
  }

  const extension = getExtension(filePath);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(
      `Unsupported document type: ${extension || "unknown"}`
    );
  }

  const stats = await fs.stat(filePath);

  if (stats.size === 0) {
    throw new Error("The uploaded document is empty.");
  }

  if (stats.size > MAX_DOCUMENT_SIZE) {
    throw new Error(
      "Document is too large. Maximum supported size is 20 MB."
    );
  }

  return {
    valid: true,
    extension,
    mimeType: getDocumentMimeType(filePath),
    size: stats.size
  };
}


/* =========================================================
   PDF PARSER
========================================================= */

async function parsePDF(filePath) {
  const buffer = await fs.readFile(filePath);

  const parser = new PDFParse({
    data: buffer
  });

  try {
    const result = await parser.getText();

    return {
      text: result.text?.trim() || "",
      pages: result.total || 0
    };

  } finally {
    await parser.destroy();
  }
}


/* =========================================================
   DOCX PARSER
========================================================= */

async function parseDOCX(filePath) {
  const result = await mammoth.extractRawText({
    path: filePath
  });

  return {
    text: result.value?.trim() || "",
    messages: result.messages || []
  };
}


/* =========================================================
   MAIN DOCUMENT PARSER
========================================================= */

export async function parseDocument(filePath) {

  await validateDocument(filePath);

  const extension =
    getExtension(filePath);


  /* PDF */

  if (extension === ".pdf") {

    const result =
      await parsePDF(filePath);

    return {
      type: "pdf",

      fileName:
        path.basename(filePath),

      mimeType:
        "application/pdf",

      pages:
        result.pages,

      text:
        result.text
    };
  }


  /* DOCX */

  if (extension === ".docx") {

    const result =
      await parseDOCX(filePath);

    return {
      type: "docx",

      fileName:
        path.basename(filePath),

      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      text:
        result.text,

      messages:
        result.messages
    };
  }


  throw new Error(
    "Unable to parse this document."
  );
}


/* =========================================================
   DOCUMENT INFORMATION
========================================================= */

export async function getDocumentInfo(filePath) {

  const validation =
    await validateDocument(filePath);

  return {

    fileName:
      path.basename(filePath),

    extension:
      validation.extension,

    mimeType:
      validation.mimeType,

    size:
      validation.size,

    sizeInKB:
      Math.round(
        validation.size / 1024
      ),

    sizeInMB:
      Number(
        (
          validation.size /
          (1024 * 1024)
        ).toFixed(2)
      )
  };
}


/* =========================================================
   DOCUMENT LIMITS
========================================================= */

export const DOCUMENT_LIMITS = {

  maxSize:
    MAX_DOCUMENT_SIZE,

  maxSizeMB:
    MAX_DOCUMENT_SIZE /
    (1024 * 1024),

  supportedExtensions:
    Array.from(
      SUPPORTED_EXTENSIONS
    ),

  supportedMimeTypes:
    Array.from(
      SUPPORTED_DOCUMENT_TYPES
    )
};