import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

import {
  parseFile,
  isSupportedFile
} from "./utils/fileParser.js";

import {
  isSupportedImage,
  getImageMimeType,
  imageToGeminiPart
} from "./utils/imageHandler.js";

import {
  parseDocument,
  isSupportedDocument
} from "./utils/documentParser.js";

// =====================================================
// PATH SETUP
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// APP SETUP
// =====================================================

const app = express();
const port = process.env.PORT || 3000;

// =====================================================
// GEMINI API KEY
// =====================================================

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "❌ GEMINI_API_KEY is missing in .env"
  );

  process.exit(1);
}

// =====================================================
// GEMINI CLIENT
// =====================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// =====================================================
// GEMINI MODEL FALLBACK
// =====================================================

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash"
];

// =====================================================
// UPLOAD DIRECTORY
// =====================================================

const uploadDirectory =
  path.join(__dirname, "uploads");

await fs.mkdir(
  uploadDirectory,
  {
    recursive: true
  }
);

// =====================================================
// MULTER STORAGE
// =====================================================

const storage =
  multer.diskStorage({

    destination: (
      req,
      file,
      cb
    ) => {
      cb(
        null,
        uploadDirectory
      );
    },

    filename: (
      req,
      file,
      cb
    ) => {

      const safeName =
        path
          .basename(
            file.originalname
          )
          .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

      const uniqueName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}-${safeName}`;

      cb(
        null,
        uniqueName
      );
    }
  });

// =====================================================
// FILE UPLOAD
// =====================================================

const upload =
  multer({

    storage,

    limits: {
      fileSize:
        20 * 1024 * 1024
    },

    fileFilter: (
      req,
      file,
      cb
    ) => {

      const extension =
        path
          .extname(
            file.originalname
          )
          .toLowerCase();

      const allowedExtensions =
        new Set([
          // Images
          ".jpg",
          ".jpeg",
          ".png",
          ".webp",
          ".gif",

          // Documents
          ".pdf",
          ".docx",

          // Text / Data
          ".txt",
          ".csv",
          ".json",
          ".xlsx",
          ".xls",

          // Programming
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
          ".sql",
          ".xml",
          ".yaml",
          ".yml",
          ".md",
          ".markdown",
          ".ipynb",

          // Other common code files
          ".php",
          ".go",
          ".rs",
          ".kt",
          ".kts",
          ".swift",
          ".dart",
          ".sh",
          ".bash",
          ".bat",
          ".ps1"
        ]);

      if (
        allowedExtensions.has(
          extension
        )
      ) {
        cb(
          null,
          true
        );
      } else {
        cb(
          new Error(
            `Unsupported file type: ${extension}`
          )
        );
      }
    }
  });

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  express.json({
    limit: "5mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb"
  })
);

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

// =====================================================
// SYSTEM INSTRUCTION
// =====================================================

const SYSTEM_INSTRUCTION = `
You are Nexora AI, a professional AI assistant.

You are designed especially to help students, programmers,
data science learners and developers.

GENERAL BEHAVIOR:
- Give accurate and useful answers.
- Explain difficult concepts in simple language.
- Use clear step-by-step explanations when appropriate.
- Do not unnecessarily repeat the user's question.
- Be friendly and professional.
- Use Markdown when useful.
- Use headings, bullet points and tables when they improve clarity.

STUDENT SUPPORT:
- Help with Computer Science subjects.
- Explain DBMS, OS, Computer Networks, DSA,
  Software Engineering, Computer Organization,
  Formal Languages and related topics.
- Help prepare notes, viva questions, MCQs and MSQs.
- Explain concepts at beginner level when requested.

PROGRAMMING:
- Help with Python, Java, C, C++, JavaScript,
  HTML, CSS, SQL and other programming languages.
- Provide clean, runnable code.
- Explain code when requested.
- Help debug errors.
- If an error message is provided, identify the likely cause
  and provide a practical solution.

DATA SCIENCE:
- Help with Python, NumPy, Pandas and Matplotlib.
- Help with data cleaning and EDA.
- Explain Machine Learning algorithms.
- Explain model evaluation metrics.
- Help with CSV and Excel data analysis.
- Help create project reports and documentation.

FILES:
- If the user uploads a file, carefully analyze its content.
- Never claim to have seen information that is not present
  in the uploaded file.
- For code files, explain and debug the actual code.
- For CSV/Excel files, discuss the actual data available.
- For PDF/DOCX files, answer using the extracted document content.
- For images, analyze the visible content.

LANGUAGE:
- If the user asks in Bengali, respond in Bengali.
- If the user asks in English, respond in English.
- If the user mixes Bengali and English, you may naturally
  use Bengali with English technical terms.

CODE FORMAT:
Always put programming code inside Markdown code blocks.
`;

// =====================================================
// CLEAN CHAT MESSAGES
// =====================================================

function cleanMessages(
  messages
) {

  if (
    !Array.isArray(
      messages
    )
  ) {
    return [];
  }

  return messages
    .filter(
      (
        message
      ) =>
        message &&
        (
          message.role === "user" ||
          message.role === "assistant"
        ) &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-30);
}

// =====================================================
// CONVERT CHAT HISTORY
// =====================================================

function convertMessages(
  messages
) {

  return messages.map(
    (
      message
    ) => ({
      role:
        message.role === "assistant"
          ? "model"
          : "user",

      parts: [
        {
          text:
            message.content
        }
      ]
    })
  );
}

// =====================================================
// FALLBACK ERROR CHECK
// =====================================================

function shouldFallback(
  error
) {

  const status =
    error?.status;

  const code =
    error?.code;

  const message =
    String(
      error?.message || ""
    ).toLowerCase();

  if (
    [
      429,
      500,
      502,
      503,
      504
    ].includes(status)
  ) {
    return true;
  }

  if (
    [
      429,
      500,
      502,
      503,
      504
    ].includes(code)
  ) {
    return true;
  }

  return (
    message.includes(
      "high demand"
    ) ||
    message.includes(
      "unavailable"
    ) ||
    message.includes(
      "overloaded"
    ) ||
    message.includes(
      "temporarily"
    ) ||
    message.includes(
      "rate limit"
    ) ||
    message.includes(
      "resource exhausted"
    )
  );
}

// =====================================================
// GENERATE TEXT RESPONSE
// =====================================================

async function generateTextResponse(
  messages
) {

  const contents =
    convertMessages(
      messages
    );

  let lastError =
    null;

  for (
    const model
    of GEMINI_MODELS
  ) {

    try {

      console.log(
        `\n🤖 Trying model: ${model}`
      );

      const response =
        await ai.models.generateContent({

          model,

          contents,

          config: {
            systemInstruction:
              SYSTEM_INSTRUCTION,

            temperature: 0.7,

            maxOutputTokens:
              4096
          }
        });

      const reply =
        response?.text;

      if (
        !reply ||
        !reply.trim()
      ) {
        throw new Error(
          `Empty response from ${model}`
        );
      }

      console.log(
        `✅ Gemini response: ${model}`
      );

      return {
        reply:
          reply.trim(),

        model
      };

    } catch (
      error
    ) {

      lastError =
        error;

      console.error(
        `❌ ${model} failed`
      );

      console.error(
        error?.message ||
        error
      );

      if (
        !shouldFallback(
          error
        )
      ) {
        throw error;
      }

      console.log(
        `🔄 Falling back...`
      );
    }
  }

  throw (
    lastError ||
    new Error(
      "All Gemini models failed."
    )
  );
}

// =====================================================
// GENERATE MULTIMODAL RESPONSE
// =====================================================

async function generateMultimodalResponse(
  messages,
  extraParts
) {

  const cleaned =
    cleanMessages(
      messages
    );

  if (
    !cleaned.length
  ) {
    throw new Error(
      "No messages provided."
    );
  }

  const lastMessage =
    cleaned[
      cleaned.length - 1
    ];

  const previousMessages =
    cleaned
      .slice(
        0,
        -1
      )
      .map(
        (
          message
        ) => ({
          role:
            message.role ===
            "assistant"
              ? "model"
              : "user",

          parts: [
            {
              text:
                message.content
            }
          ]
        })
      );

  const finalParts = [
    {
      text:
        lastMessage.content
    },

    ...extraParts
  ];

  const contents = [
    ...previousMessages,

    {
      role: "user",

      parts:
        finalParts
    }
  ];

  let lastError =
    null;

  for (
    const model
    of GEMINI_MODELS
  ) {

    try {

      console.log(
        `\n🖼️ Trying multimodal model: ${model}`
      );

      const response =
        await ai.models.generateContent({

          model,

          contents,

          config: {
            systemInstruction:
              SYSTEM_INSTRUCTION,

            temperature: 0.7,

            maxOutputTokens:
              4096
          }
        });

      const reply =
        response?.text;

      if (
        !reply ||
        !reply.trim()
      ) {
        throw new Error(
          `Empty response from ${model}`
        );
      }

      console.log(
        `✅ Multimodal response: ${model}`
      );

      return {
        reply:
          reply.trim(),

        model
      };

    } catch (
      error
    ) {

      lastError =
        error;

      console.error(
        `❌ ${model} failed`
      );

      console.error(
        error?.message ||
        error
      );

      if (
        !shouldFallback(
          error
        )
      ) {
        throw error;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "All Gemini multimodal models failed."
    )
  );
}

// =====================================================
// NORMAL CHAT API
// =====================================================

app.post(
  "/api/chat",
  async (
    req,
    res
  ) => {

    try {

      const messages =
        cleanMessages(
          req.body.messages
        );

      if (
        !messages.length
      ) {
        return res
          .status(400)
          .json({
            error:
              "No messages were provided."
          });
      }

      const result =
        await generateTextResponse(
          messages
        );

      return res.json({
        reply:
          result.reply,

        model:
          result.model
      });

    } catch (
      error
    ) {

      console.error(
        "\n❌ Chat API Error:"
      );

      console.error(
        error
      );

      return res
        .status(500)
        .json({
          error:
            error?.message ||
            "Something went wrong."
        });
    }
  }
);

// =====================================================
// FILE UPLOAD + AI ANALYSIS
// =====================================================

app.post(
  "/api/upload",
  upload.single("file"),

  async (
    req,
    res
  ) => {

    let uploadedFilePath =
      null;

    try {

      // -----------------------------------------------
      // CHECK FILE
      // -----------------------------------------------

      if (
        !req.file
      ) {
        return res
          .status(400)
          .json({
            error:
              "No file was uploaded."
          });
      }

      uploadedFilePath =
        req.file.path;

      const originalName =
        req.file.originalname;

      const extension =
        path
          .extname(
            originalName
          )
          .toLowerCase();

      const mimeType =
        req.file.mimetype;

      const userPrompt =
        typeof req.body.prompt ===
        "string"
          ? req.body.prompt.trim()
          : "";

      console.log(
        `\n📁 Uploaded file: ${originalName}`
      );

      console.log(
        `📦 Type: ${mimeType}`
      );

      // -----------------------------------------------
      // IMAGE
      // -----------------------------------------------

      if (
        isSupportedImage(
          mimeType
        )
      ) {

        const imagePart =
          await imageToGeminiPart(
            uploadedFilePath,
            mimeType ||
              getImageMimeType(
                uploadedFilePath
              )
          );

        const prompt =
          userPrompt ||
          "Analyze this image carefully and explain what you see.";

        const result =
          await generateMultimodalResponse(
            [
              {
                role: "user",
                content: prompt
              }
            ],
            [
              imagePart
            ]
          );

        return res.json({
          success: true,

          type: "image",

          fileName:
            originalName,

          reply:
            result.reply,

          model:
            result.model
        });
      }

      // -----------------------------------------------
      // PDF / DOCX
      // -----------------------------------------------

      if (
        isSupportedDocument(
          uploadedFilePath
        )
      ) {

        const document =
          await parseDocument(
            uploadedFilePath
          );

        const documentText =
          document.text ||
          "";

        if (
          !documentText.trim()
        ) {
          return res
            .status(400)
            .json({
              error:
                "No readable text was found in this document."
            });
        }

        const prompt =
          userPrompt ||
          "Analyze this document and provide a useful summary.";

        const combinedPrompt = `
The user uploaded a document.

File name:
${originalName}

Document type:
${extension}

Document content:
----------------
${documentText}
----------------

User request:
${prompt}

Please answer based on the uploaded document.
`;

        const result =
          await generateTextResponse(
            [
              {
                role:
                  "user",

                content:
                  combinedPrompt
              }
            ]
          );

        return res.json({
          success: true,

          type:
            document.type,

          fileName:
            originalName,

          reply:
            result.reply,

          model:
            result.model
        });
      }

      // -----------------------------------------------
      // TEXT / CODE / DATA / EXCEL
      // -----------------------------------------------

      if (
        isSupportedFile(
          uploadedFilePath
        )
      ) {

        const parsed =
          await parseFile(
            uploadedFilePath
          );

        if (
          !parsed.content ||
          !parsed.content.trim()
        ) {
          return res
            .status(400)
            .json({
              error:
                "The uploaded file contains no readable content."
            });
        }

        const prompt =
          userPrompt ||
          "Analyze this uploaded file and explain the important information.";

        const combinedPrompt = `
The user uploaded a file.

File name:
${originalName}

File type:
${parsed.type}

File extension:
${parsed.extension}

File content:
----------------
${parsed.content}
----------------

User request:
${prompt}

Analyze the actual uploaded content.
If it is code, explain or debug the code when appropriate.
If it is CSV/Excel/data, analyze the available data.
Do not invent information that is not present.
`;

        const result =
          await generateTextResponse(
            [
              {
                role:
                  "user",

                content:
                  combinedPrompt
              }
            ]
          );

        return res.json({
          success: true,

          type:
            parsed.type,

          fileName:
            originalName,

          reply:
            result.reply,

          model:
            result.model
        });
      }

      // -----------------------------------------------
      // UNSUPPORTED FILE
      // -----------------------------------------------

      return res
        .status(400)
        .json({
          error:
            `Unsupported file type: ${extension}`
        });

    } catch (
      error
    ) {

      console.error(
        "\n❌ File processing error:"
      );

      console.error(
        error
      );

      return res
        .status(500)
        .json({
          error:
            error?.message ||
            "Unable to process the uploaded file."
        });

    } finally {

      // -----------------------------------------------
      // DELETE TEMPORARY FILE
      // -----------------------------------------------

      if (
        uploadedFilePath
      ) {

        try {

          await fs.unlink(
            uploadedFilePath
          );

          console.log(
            "🗑️ Temporary upload deleted."
          );

        } catch (
          deleteError
        ) {

          console.error(
            "⚠️ Could not delete temporary file:",
            deleteError?.message
          );
        }
      }
    }
  }
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/api/health",
  (
    req,
    res
  ) => {

    res.json({
      success: true,

      app:
        "Nexora AI",

      status:
        "online",

      models:
        GEMINI_MODELS
    });
  }
);

// =====================================================
// FRONTEND ROUTE
// =====================================================

app.get(
  /.*/,
  (
    req,
    res
  ) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "❌ Server error:",
      error
    );

    if (
      error instanceof
      multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res
          .status(400)
          .json({
            error:
              "File is too large. Maximum size is 20 MB."
          });
      }
    }

    return res
      .status(500)
      .json({
        error:
          error?.message ||
          "Internal server error."
      });
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  port,
  () => {

    console.log(
      "\n============================================"
    );

    console.log(
      "🚀 Nexora AI is running!"
    );

    console.log(
      `🌐 http://localhost:${port}`
    );

    console.log(
      "============================================"
    );

    console.log(
      "\nGemini fallback models:"
    );

    GEMINI_MODELS.forEach(
      (
        model,
        index
      ) => {

        console.log(
          `${index + 1}. ${model}`
        );
      }
    );

    console.log(
      "\n📁 File upload: ENABLED"
    );

    console.log(
      "🖼️ Image analysis: ENABLED"
    );

    console.log(
      "📄 PDF analysis: ENABLED"
    );

    console.log(
      "📝 DOCX analysis: ENABLED"
    );

    console.log(
      "📊 CSV/Excel analysis: ENABLED"
    );

    console.log(
      "💻 Code file analysis: ENABLED"
    );

    console.log(
      "============================================\n"
    );
  }
);






/* =========================================================
   AI IMAGE GENERATION
========================================================= */

async function generateImage(prompt) {

  console.log("\n🎨 Generating image...");
  console.log("📝 Prompt:", prompt);

  const response =
    await ai.models.generateContent({

      model: "gemini-2.5-flash-image",

      contents: prompt,

      config: {
        responseModalities: ["Image"]
      }

    });


  const parts =
    response?.candidates?.[0]?.content?.parts || [];


  for (const part of parts) {

    if (part.inlineData) {

      return {
        mimeType:
          part.inlineData.mimeType ||
          "image/png",

        data:
          part.inlineData.data
      };

    }

  }


  throw new Error(
    "No image was generated by Gemini."
  );
}


/* =========================================================
   IMAGE GENERATION API
========================================================= */

app.post(
  "/api/generate-image",

  async (req, res) => {

    try {

      const prompt =
        typeof req.body.prompt === "string"
          ? req.body.prompt.trim()
          : "";


      if (!prompt) {

        return res
          .status(400)
          .json({
            error:
              "Please provide an image prompt."
          });

      }


      if (prompt.length > 4000) {

        return res
          .status(400)
          .json({
            error:
              "Image prompt is too long. Maximum 4000 characters."
          });

      }


      const result =
        await generateImage(prompt);


      console.log(
        "✅ Image generated successfully."
      );


      return res.json({

        success: true,

        type: "image",

        mimeType:
          result.mimeType,

        image:
          result.data,

        prompt:
          prompt

      });

    } catch (error) {

      console.error(
        "\n❌ Image Generation Error:"
      );

      console.error(
        error?.message ||
        error
      );


      return res
        .status(500)
        .json({

          error:
            error?.message ||
            "Unable to generate image."

        });

    }

  }
);