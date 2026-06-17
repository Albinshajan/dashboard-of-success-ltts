const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("MODELS:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("FAILURE:", error);
  }
}

listModels();
