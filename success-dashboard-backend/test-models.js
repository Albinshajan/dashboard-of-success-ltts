const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
  const models = ["gemini-1.5-flash", "gemini-flash-latest", "gemini-pro"];
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  for (const m of models) {
    try {
      console.log(`Testing model: ${m}`);
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("Say hi");
      const response = await result.response;
      console.log(`SUCCESS for ${m}: ${response.text().substring(0, 20)}...`);
    } catch (e) {
      console.error(`FAILURE for ${m}: ${e.message}`);
    }
  }
}

test();
