"use strict";

/* =========================================================
   NEXORA AI - MAIN FRONTEND JAVASCRIPT
========================================================= */

/* =========================================================
   1. DOM ELEMENTS
========================================================= */

const messagesEl = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const welcome = document.getElementById("welcome");
const attachBtn = document.getElementById("attachBtn");


/* =========================================================
   2. STATE
========================================================= */

let conversation = [];
let isLoading = false;
let selectedFile = null;


/* =========================================================
   3. SUPPORTED FILE TYPES
========================================================= */

const SUPPORTED_FILE_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",

    ".pdf",
    ".docx",

    ".txt",
    ".csv",
    ".json",
    ".xlsx",
    ".xls",

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
];


/* =========================================================
   4. INITIALIZE
========================================================= */

initialize();


function initialize() {

    if (!messagesEl || !input || !sendBtn) {
        console.error(
            "❌ Nexora AI: Required HTML elements are missing."
        );
        return;
    }

    setupTextarea();
    setupEnterKey();
    setupSendButton();
    setupSuggestions();
    setupAttachButton();

    console.log(
        "✅ Nexora AI frontend initialized."
    );
}


/* =========================================================
   5. TEXTAREA AUTO RESIZE
========================================================= */

function setupTextarea() {

    input.addEventListener(
        "input",
        resizeTextarea
    );
}


function resizeTextarea() {

    input.style.height = "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            180
        ) + "px";
}


/* =========================================================
   6. ENTER TO SEND
========================================================= */

function setupEnterKey() {

    input.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );
}


/* =========================================================
   7. SEND BUTTON
========================================================= */

function setupSendButton() {

    sendBtn.addEventListener(
        "click",
        sendMessage
    );
}


/* =========================================================
   8. SUGGESTION BUTTONS
========================================================= */

function setupSuggestions() {

    const suggestionButtons =
        document.querySelectorAll(
            ".suggestion"
        );

    suggestionButtons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const prompt =
                        button.dataset.prompt;

                    if (!prompt) {
                        return;
                    }

                    input.value = prompt;

                    resizeTextarea();

                    sendMessage();
                }
            );
        }
    );
}


/* =========================================================
   9. FILE ATTACHMENT
========================================================= */

function setupAttachButton() {

    if (!attachBtn) {
        return;
    }

    attachBtn.addEventListener(
        "click",
        openFilePicker
    );
}


/* =========================================================
   10. OPEN FILE PICKER
========================================================= */

function openFilePicker() {

    if (isLoading) {
        return;
    }

    const fileInput =
        document.createElement("input");

    fileInput.type = "file";

    fileInput.accept =
        SUPPORTED_FILE_EXTENSIONS.join(",");

    fileInput.style.display = "none";

    document.body.appendChild(
        fileInput
    );

    fileInput.addEventListener(
        "change",
        async () => {

            const file =
                fileInput.files?.[0];

            if (!file) {

                fileInput.remove();

                return;
            }

            selectedFile = file;

            fileInput.remove();

            await uploadFile(file);
        }
    );

    fileInput.click();
}


/* =========================================================
   11. CHECK FILE EXTENSION
========================================================= */

function isSupportedFile(file) {

    if (!file || !file.name) {
        return false;
    }

    const fileName =
        file.name.toLowerCase();

    return SUPPORTED_FILE_EXTENSIONS.some(
        (extension) =>
            fileName.endsWith(extension)
    );
}


/* =========================================================
   12. UPLOAD FILE
========================================================= */

async function uploadFile(file) {

    if (isLoading) {
        return;
    }

    if (!isSupportedFile(file)) {

        addMessage(
            "assistant",
            `Sorry, this file type is not supported.

Supported files include:

- JPG / PNG / WEBP / GIF
- PDF
- DOCX
- TXT
- CSV
- XLSX / XLS
- Python
- Java
- C / C++
- JavaScript
- HTML / CSS
- SQL
- Jupyter Notebook
- and other common code files.`
        );

        selectedFile = null;

        return;
    }

    const maxSize =
        20 * 1024 * 1024;

    if (file.size > maxSize) {

        addMessage(
            "assistant",
            "The selected file is too large. Maximum file size is 20 MB."
        );

        selectedFile = null;

        return;
    }

    hideWelcome();

    addFileMessage(file);

    setLoading(true);

    const typingElement =
        addTyping();

    try {

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        const prompt =
            input.value.trim();

        if (prompt) {

            formData.append(
                "prompt",
                prompt
            );

            input.value = "";

            resizeTextarea();
        }

        const response =
            await fetch(
                "/api/upload",
                {
                    method: "POST",
                    body: formData
                }
            );

        let data = {};

        try {

            data =
                await response.json();

        } catch {

            data = {};
        }

        removeElement(
            typingElement
        );

        if (!response.ok) {

            throw new Error(
                data.error ||
                `Server error: ${response.status}`
            );
        }

        const reply =
            data.reply ||
            "I couldn't analyze this file.";

        addMessage(
            "assistant",
            reply
        );

        conversation.push({
            role: "user",
            content:
                prompt ||
                `Analyze the uploaded file: ${file.name}`
        });

        conversation.push({
            role: "assistant",
            content: reply
        });

        if (data.model) {

            console.log(
                `🤖 File analysis generated using: ${data.model}`
            );
        }

    } catch (error) {

        console.error(
            "❌ File upload error:",
            error
        );

        removeElement(
            typingElement
        );

        addMessage(
            "assistant",
            `Sorry, I couldn't analyze the uploaded file.

${error.message || "Unknown error."}`
        );

    } finally {

        setLoading(false);

        selectedFile = null;

        input.focus();
    }
}


/* =========================================================
   13. DISPLAY UPLOADED FILE
========================================================= */

function addFileMessage(file) {

    const row =
        document.createElement("div");

    row.className =
        "message user";

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    const fileName =
        escapeHTML(file.name);

    const fileSize =
        formatFileSize(file.size);

    content.innerHTML = `
        <div class="uploaded-file">
            <strong>📎 ${fileName}</strong>
            <small>${fileSize}</small>
        </div>
    `;

    row.appendChild(
        content
    );

    messagesEl.appendChild(
        row
    );

    scrollToBottom();
}


/* =========================================================
   14. FORMAT FILE SIZE
========================================================= */

function formatFileSize(bytes) {

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {

        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        bytes / (1024 * 1024)
    ).toFixed(2)} MB`;
}


/* =========================================================
   15. SEND NORMAL CHAT MESSAGE
========================================================= */

async function sendMessage() {

    if (isLoading) {
        return;
    }

    const text =
        input.value.trim();

    if (!text) {
        return;
    }

    hideWelcome();

    addMessage(
        "user",
        text
    );

    input.value = "";

    resizeTextarea();


    /* =====================================================
       IMAGE GENERATION
    ===================================================== */

    if (isImageGenerationRequest(text)) {

        conversation.push({
            role: "user",
            content: text
        });

        setLoading(true);

        const typingElement =
            addTyping();

        try {

            const result =
                await generateImage(text);

            removeElement(
                typingElement
            );

            if (
                result &&
                result.image
            ) {

                addGeneratedImage(
                    result
                );

                conversation.push({
                    role: "assistant",
                    content:
                        "[Image generated successfully]"
                });

            } else {

                throw new Error(
                    "No image was returned by the server."
                );
            }

        } catch (error) {

            console.error(
                "❌ Image generation error:",
                error
            );

            removeElement(
                typingElement
            );

            addMessage(
                "assistant",
                `Sorry, I couldn't generate the image.

${error.message || "Unknown error."}`
            );

        } finally {

            setLoading(false);

            input.focus();
        }

        return;
    }


    /* =====================================================
       NORMAL CHAT
    ===================================================== */

    conversation.push({
        role: "user",
        content: text
    });

    setLoading(true);

    const typingElement =
        addTyping();

    try {

        const response =
            await fetch(
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            messages:
                                conversation
                        })
                }
            );

        let data = {};

        try {

            data =
                await response.json();

        } catch {

            data = {};
        }

        removeElement(
            typingElement
        );

        if (!response.ok) {

            throw new Error(
                data.error ||
                `Server error: ${response.status}`
            );
        }

        const reply =
            data.reply ||
            "Sorry, I couldn't generate a response.";

        addMessage(
            "assistant",
            reply
        );

        conversation.push({
            role: "assistant",
            content: reply
        });

        if (data.model) {

            console.log(
                `🤖 Response generated using: ${data.model}`
            );
        }

    } catch (error) {

        console.error(
            "❌ Chat error:",
            error
        );

        removeElement(
            typingElement
        );

        addMessage(
            "assistant",
            `Sorry, I couldn't connect to Nexora AI.

${error.message || "Unknown error."}`
        );

    } finally {

        setLoading(false);

        input.focus();
    }
}


/* =========================================================
   16. ADD MESSAGE
========================================================= */

function addMessage(
    role,
    text
) {

    const row =
        document.createElement("div");

    row.className =
        `message ${role}`;

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    if (role === "user") {

        content.innerHTML =
            escapeHTML(text);

    } else {

        content.innerHTML =
            formatAIResponse(text);
    }

    row.appendChild(
        content
    );

    messagesEl.appendChild(
        row
    );

    scrollToBottom();

    if (role === "assistant") {

        addCopyButton(
            row,
            text
        );

        setupCodeCopyButtons(
            row
        );
    }
}


/* =========================================================
   17. COPY AI RESPONSE
========================================================= */

function addCopyButton(
    row,
    text
) {

    const button =
        document.createElement(
            "button"
        );

    button.className =
        "copy-response";

    button.type =
        "button";

    button.textContent =
        "Copy";

    button.addEventListener(
        "click",
        async () => {

            try {

                await navigator.clipboard.writeText(
                    text
                );

                button.textContent =
                    "Copied";

                setTimeout(
                    () => {

                        button.textContent =
                            "Copy";

                    },
                    1500
                );

            } catch (error) {

                console.error(
                    "Copy failed:",
                    error
                );
            }
        }
    );

    row.appendChild(
        button
    );
}


/* =========================================================
   18. FORMAT AI RESPONSE
========================================================= */

function formatAIResponse(text) {

    let source =
        String(text || "");

    const codeBlocks = [];


    /* =====================================================
       STEP 1
       EXTRACT CODE BLOCKS FIRST
    ===================================================== */

    source =
        source.replace(
            /```([a-zA-Z0-9_+#.-]*)[ \t]*\n?([\s\S]*?)```/g,
            (match, language, code) => {

                const index =
                    codeBlocks.length;

                codeBlocks.push({

                    language:
                        language?.trim() ||
                        "code",

                    code:
                        String(code)
                            .replace(/^\n/, "")
                            .replace(/\n$/, "")
                            .trim()
                });

                return `___NEXORA_CODE_${index}___`;
            }
        );


    /* =====================================================
       STEP 2
       ESCAPE NORMAL TEXT
    ===================================================== */

    let html =
        escapeHTML(source);


    /* =====================================================
       STEP 3
       HEADINGS
    ===================================================== */

    html =
        html.replace(
            /^### (.+)$/gm,
            "<h3>$1</h3>"
        );

    html =
        html.replace(
            /^## (.+)$/gm,
            "<h2>$1</h2>"
        );

    html =
        html.replace(
            /^# (.+)$/gm,
            "<h1>$1</h1>"
        );


    /* =====================================================
       STEP 4
       BOLD
    ===================================================== */

    html =
        html.replace(
            /\*\*(.+?)\*\*/g,
            "<strong>$1</strong>"
        );


    /* =====================================================
       STEP 5
       ITALIC
    ===================================================== */

    html =
        html.replace(
            /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
            "<em>$1</em>"
        );


    /* =====================================================
       STEP 6
       INLINE CODE
    ===================================================== */

    html =
        html.replace(
            /`([^`\n]+)`/g,
            "<code>$1</code>"
        );


    /* =====================================================
       STEP 7
       BULLET LIST
    ===================================================== */

    html =
        html.replace(
            /^[ \t]*[-*•]\s+(.+)$/gm,
            "<li>$1</li>"
        );


    /* =====================================================
       STEP 8
       NUMBERED LIST
    ===================================================== */

    html =
        html.replace(
            /^[ \t]*\d+\.\s+(.+)$/gm,
            "<li>$1</li>"
        );


    /* =====================================================
       STEP 9
       GROUP LIST ITEMS
    ===================================================== */

    html =
        html.replace(
            /(?:<li>.*?<\/li>\s*)+/gs,
            (list) => {

                return `<ul>${list}</ul>`;
            }
        );


    /* =====================================================
       STEP 10
       LINE BREAKS
    ===================================================== */

    html =
        html.replace(
            /\n\n+/g,
            "<br><br>"
        );

    html =
        html.replace(
            /\n/g,
            "<br>"
        );


    /* =====================================================
       STEP 11
       RESTORE CODE BLOCKS LAST
    ===================================================== */

    codeBlocks.forEach(
        (block, index) => {

            const language =
                escapeHTML(
                    block.language
                );

            const code =
                escapeHTML(
                    block.code
                );

            const codeHTML = `
                <div class="code-block">

                    <div class="code-header">

                        <span>
                            ${language}
                        </span>

                        <button
                            class="copy-code"
                            type="button"
                        >Copy</button>

                    </div>

                    <pre><code>${code}</code></pre>

                </div>
            `;

            html =
                html.replace(
                    `___NEXORA_CODE_${index}___`,
                    codeHTML
                );
        }
    );


    return html;
}


/* =========================================================
   19. ESCAPE HTML
========================================================= */

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(text ?? "");

    return div.innerHTML;
}


/* =========================================================
   20. CODE COPY BUTTON
========================================================= */

function setupCodeCopyButtons(
    row
) {

    const buttons =
        row.querySelectorAll(
            ".copy-code"
        );

    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                async () => {

                    const codeBlock =
                        button.closest(
                            ".code-block"
                        );

                    if (!codeBlock) {
                        return;
                    }

                    const code =
                        codeBlock.querySelector(
                            "code"
                        );

                    if (!code) {
                        return;
                    }

                    try {

                        await navigator.clipboard.writeText(
                            code.innerText
                        );

                        button.textContent =
                            "Copied";

                        setTimeout(
                            () => {

                                button.textContent =
                                    "Copy";

                            },
                            1500
                        );

                    } catch (error) {

                        console.error(
                            "Code copy failed:",
                            error
                        );
                    }
                }
            );
        }
    );
}


/* =========================================================
   21. IMAGE GENERATION DETECTION
========================================================= */

function isImageGenerationRequest(
    text
) {

    const value =
        String(text || "")
            .toLowerCase()
            .trim();

    const patterns = [

        /\bgenerate\s+(an?\s+)?image\b/,
        /\bcreate\s+(an?\s+)?image\b/,
        /\bdraw\s+(an?\s+)?image\b/,
        /\bmake\s+(an?\s+)?image\b/,
        /\bdesign\s+(an?\s+)?image\b/,
        /\brender\s+(an?\s+)?image\b/,

        /\bcreate\s+a\s+picture\b/,
        /\bgenerate\s+a\s+picture\b/,
        /\bmake\s+a\s+picture\b/,
        /\bdraw\s+a\s+picture\b/,

        /\bimage\s+of\b/,
        /\bpicture\s+of\b/
    ];

    return patterns.some(
        (pattern) =>
            pattern.test(value)
    );
}


/* =========================================================
   22. CLEAN IMAGE PROMPT
========================================================= */

function cleanImagePrompt(
    text
) {

    let prompt =
        String(text || "").trim();

    prompt =
        prompt.replace(
            /^(please\s+)?/i,
            ""
        );

    prompt =
        prompt.replace(
            /^(generate|create|make|draw|design|render)\s+(an?\s+)?(image|picture)\s*(of)?\s*/i,
            ""
        );

    return prompt.trim() || text;
}


/* =========================================================
   23. GENERATE IMAGE
========================================================= */

async function generateImage(
    userPrompt
) {

    const prompt =
        cleanImagePrompt(
            userPrompt
        );

    const response =
        await fetch(
            "/api/generate-image",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        prompt: prompt
                    })
            }
        );

    let data = {};

    try {

        data =
            await response.json();

    } catch {

        data = {};
    }

    if (!response.ok) {

        throw new Error(
            data.error ||
            `Image generation failed: ${response.status}`
        );
    }

    return data;
}


/* =========================================================
   24. ADD GENERATED IMAGE
========================================================= */

function addGeneratedImage(
    result
) {

    const row =
        document.createElement("div");

    row.className =
        "message assistant";

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "generated-image-wrapper";

    const image =
        document.createElement("img");

    image.className =
        "generated-image";

    image.alt =
        "Generated by Nexora AI";

    const mimeType =
        result.mimeType ||
        "image/png";

    image.src =
        `data:${mimeType};base64,${result.image}`;

    image.loading =
        "lazy";

    wrapper.appendChild(
        image
    );

    content.appendChild(
        wrapper
    );

    row.appendChild(
        content
    );

    messagesEl.appendChild(
        row
    );

    scrollToBottom();
}


/* =========================================================
   25. TYPING INDICATOR
========================================================= */

function addTyping() {

    const row =
        document.createElement(
            "div"
        );

    row.className =
        "message assistant";

    row.innerHTML = `
        <div class="message-content">

            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>

        </div>
    `;

    messagesEl.appendChild(
        row
    );

    scrollToBottom();

    return row;
}


/* =========================================================
   26. LOADING STATE
========================================================= */

function setLoading(
    loading
) {

    isLoading =
        loading;

    if (sendBtn) {

        sendBtn.disabled =
            loading;

        sendBtn.style.opacity =
            loading
                ? "0.55"
                : "1";
    }

    if (input) {

        input.disabled =
            loading;
    }

    if (attachBtn) {

        attachBtn.disabled =
            loading;
    }
}


/* =========================================================
   27. HIDE WELCOME
========================================================= */

function hideWelcome() {

    if (!welcome) {
        return;
    }

    welcome.style.display =
        "none";
}


/* =========================================================
   28. SCROLL TO BOTTOM
========================================================= */

function scrollToBottom() {

    requestAnimationFrame(
        () => {

            if (!messagesEl) {
                return;
            }

            messagesEl.scrollTop =
                messagesEl.scrollHeight;
        }
    );
}


/* =========================================================
   29. REMOVE ELEMENT
========================================================= */

function removeElement(
    element
) {

    if (
        element &&
        element.parentNode
    ) {

        element.remove();
    }
}


/* =========================================================
   30. NEW CHAT
========================================================= */

function newChat() {

    conversation = [];

    selectedFile = null;

    messagesEl.innerHTML = "";

    if (welcome) {

        messagesEl.appendChild(
            welcome
        );

        welcome.style.display =
            "flex";
    }

    input.value = "";

    resizeTextarea();

    input.focus();

    console.log(
        "🆕 New chat started."
    );
}


/* =========================================================
   31. CTRL + K
========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "k"
        ) {

            event.preventDefault();

            newChat();
        }
    }
);


/* =========================================================
   32. GLOBAL ERROR HANDLING
========================================================= */

window.addEventListener(
    "error",
    (event) => {

        console.error(
            "❌ Frontend error:",
            event.error ||
            event.message
        );
    }
);


/* =========================================================
   33. UNHANDLED PROMISE ERROR
========================================================= */

window.addEventListener(
    "unhandledrejection",
    (event) => {

        console.error(
            "❌ Unhandled promise rejection:",
            event.reason
        );
    }
);


// ===============================
// PWA Service Worker
// ===============================

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
                console.log(
                    "✅ Nexora AI PWA ready:",
                    registration.scope
                );
            })
            .catch((error) => {
                console.error(
                    "❌ Service Worker registration failed:",
                    error
                );
            });

    });

}


/* =========================================================
   34. STARTUP MESSAGE
========================================================= */

console.log(`
============================================
              NEXORA AI
============================================

Frontend loaded successfully.

✓ Gemini AI Chat
✓ Conversation Memory
✓ File Upload
✓ Image Analysis
✓ PDF Analysis
✓ DOCX Analysis
✓ CSV / Excel Analysis
✓ Code Analysis
✓ Markdown Formatting
✓ Code Blocks
✓ Copy Response
✓ Copy Code
✓ Image Generation
✓ Typing Indicator
✓ Suggestion Cards
✓ Enter to Send
✓ Shift + Enter
✓ Ctrl + K = New Chat

============================================
`);