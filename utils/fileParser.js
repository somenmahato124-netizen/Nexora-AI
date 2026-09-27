import fs from "fs/promises";
import path from "path";
import xlsx from "xlsx";

/**
 * ============================================
 * NEXORA AI
 * FILE PARSER
 * ============================================
 *
 * Supported:
 * - TXT
 * - CSV
 * - JSON
 * - Python
 * - Java
 * - C
 * - C++
 * - JavaScript
 * - HTML
 * - CSS
 * - Markdown
 * - SQL
 * - XML
 * - YAML
 * - YML
 * - IPYNB
 * - XLSX
 * - XLS
 */

/**
 * --------------------------------------------
 * Supported text/code extensions
 * --------------------------------------------
 */

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".csv",
  ".json",
  ".py",
  ".java",
  ".c",
  ".h",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".md",
  ".markdown",
  ".sql",
  ".xml",
  ".yaml",
  ".yml",
  ".ipynb",
  ".log",
  ".sh",
  ".bash",
  ".bat",
  ".ps1",
  ".php",
  ".go",
  ".rs",
  ".kt",
  ".kts",
  ".swift",
  ".dart"
]);

/**
 * --------------------------------------------
 * Maximum text size
 * --------------------------------------------
 *
 * Prevents extremely large files from being
 * loaded completely into memory.
 */

const MAX_TEXT_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * --------------------------------------------
 * Get file extension
 * --------------------------------------------
 */

function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

/**
 * --------------------------------------------
 * Read normal text/code file
 * --------------------------------------------
 */

async function parseTextFile(filePath) {
  const fileBuffer = await fs.readFile(filePath);

  if (fileBuffer.length > MAX_TEXT_SIZE) {
    throw new Error(
      "Text file is too large. Maximum supported size is 5 MB."
    );
  }

  return fileBuffer.toString("utf-8");
}

/**
 * --------------------------------------------
 * Parse JSON
 * --------------------------------------------
 */

async function parseJsonFile(filePath) {
  const text = await parseTextFile(filePath);

  try {
    const json = JSON.parse(text);

    return JSON.stringify(json, null, 2);
  } catch {
    // If JSON parsing fails, return original text.
    return text;
  }
}

/**
 * --------------------------------------------
 * Parse Jupyter Notebook
 * --------------------------------------------
 */

async function parseIpynbFile(filePath) {
  const text = await parseTextFile(filePath);

  try {
    const notebook = JSON.parse(text);

    if (!Array.isArray(notebook.cells)) {
      return text;
    }

    const output = [];

    output.push("# Jupyter Notebook\n");

    for (let index = 0; index < notebook.cells.length; index++) {
      const cell = notebook.cells[index];

      const cellType = cell.cell_type || "unknown";

      const source = Array.isArray(cell.source)
        ? cell.source.join("")
        : String(cell.source || "");

      output.push(
        `\n## Cell ${index + 1} — ${cellType}\n`
      );

      output.push(source);

      // Include notebook outputs when available.
      if (
        cellType === "code" &&
        Array.isArray(cell.outputs) &&
        cell.outputs.length
      ) {
        output.push("\n### Output\n");

        for (const cellOutput of cell.outputs) {
          if (cellOutput.text) {
            output.push(
              Array.isArray(cellOutput.text)
                ? cellOutput.text.join("")
                : String(cellOutput.text)
            );
          }

          if (cellOutput.data?.["text/plain"]) {
            const plainText =
              cellOutput.data["text/plain"];

            output.push(
              Array.isArray(plainText)
                ? plainText.join("")
                : String(plainText)
            );
          }
        }
      }
    }

    return output.join("\n");
  } catch {
    return text;
  }
}

/**
 * --------------------------------------------
 * Parse Excel file
 * --------------------------------------------
 */

async function parseExcelFile(filePath) {
  const workbook = xlsx.readFile(filePath);

  const output = [];

  output.push("# Excel Workbook\n");

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];

    const rows = xlsx.utils.sheet_to_json(
      worksheet,
      {
        header: 1,
        defval: ""
      }
    );

    output.push(`\n## Sheet: ${sheetName}\n`);

    if (!rows.length) {
      output.push("(Empty sheet)");
      continue;
    }

    for (const row of rows) {
      output.push(
        row
          .map((cell) => String(cell))
          .join(" | ")
      );
    }
  }

  return output.join("\n");
}

/**
 * --------------------------------------------
 * Main parser
 * --------------------------------------------
 */

export async function parseFile(filePath) {
  if (!filePath) {
    throw new Error("File path is required.");
  }

  const extension = getExtension(filePath);

  /**
   * Excel
   */
  if (
    extension === ".xlsx" ||
    extension === ".xls"
  ) {
    return {
      type: "spreadsheet",
      extension,
      content: await parseExcelFile(filePath)
    };
  }

  /**
   * Jupyter Notebook
   */
  if (extension === ".ipynb") {
    return {
      type: "notebook",
      extension,
      content: await parseIpynbFile(filePath)
    };
  }

  /**
   * JSON
   */
  if (extension === ".json") {
    return {
      type: "json",
      extension,
      content: await parseJsonFile(filePath)
    };
  }

  /**
   * Normal text/code files
   */
  if (TEXT_EXTENSIONS.has(extension)) {
    return {
      type: "text",
      extension,
      content: await parseTextFile(filePath)
    };
  }

  /**
   * Unsupported
   */
  return {
    type: "unsupported",
    extension,
    content: null
  };
}

/**
 * --------------------------------------------
 * Check whether file is supported
 * --------------------------------------------
 */

export function isSupportedFile(filePath) {
  const extension = getExtension(filePath);

  return (
    TEXT_EXTENSIONS.has(extension) ||
    extension === ".xlsx" ||
    extension === ".xls"
  );
}

/**
 * --------------------------------------------
 * Get file type
 * --------------------------------------------
 */

export function getFileType(filePath) {
  const extension = getExtension(filePath);

  if (
    extension === ".xlsx" ||
    extension === ".xls"
  ) {
    return "spreadsheet";
  }

  if (extension === ".ipynb") {
    return "notebook";
  }

  if (extension === ".json") {
    return "json";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  return "unsupported";
}