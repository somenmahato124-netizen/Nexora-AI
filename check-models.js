import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function checkModels() {
  try {
    console.log("\nAvailable Gemini Models:\n");

    const models = await ai.models.list();

    for await (const model of models) {
      console.log(model.name);
    }

  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkModels();