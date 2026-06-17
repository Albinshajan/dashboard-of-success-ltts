const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer'); // For file uploads
const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// We use gemini-1.5-flash as it is extremely fast for these tasks
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); 

// ---------------------------------------------------------
// 1. DATA EXTRACTION ENDPOINT (The Upload)
// ---------------------------------------------------------
app.post('/api/upload', upload.single('document'), async (req, res) => {
    try {
        // In a full app, you would read the uploaded file from req.file
        // and extract its text here (using libraries like pdf-parse).
        // For this example, let's assume we have the extracted text.
        const documentText = req.body.extractedText; 

        const prompt = `
        You are a data extraction assistant. Read this bid document text:
        "${documentText}"
        Extract the bidding information and output strictly in this JSON array format:
        [{"client": "String", "value": Number, "status": "Won/Lost/Pending", "date": "YYYY-MM-DD", "reason": "String"}]
        Return ONLY the raw JSON. No conversational text.
        `;

        const result = await model.generateContent(prompt);
        const jsonResponse = result.response.text().replace(/```json|```/g, ''); // Clean up formatting
        
        res.json(JSON.parse(jsonResponse));
    } catch (error) {
        res.status(500).json({ error: 'Failed to process document' });
    }
});

// ---------------------------------------------------------
// 2. HYPOTHESIS GENERATOR ENDPOINT
// ---------------------------------------------------------
app.post('/api/hypotheses', async (req, res) => {
    try {
        const dashboardData = req.body.data; // The JSON data sent from the frontend

        const prompt = `
        Act as a Chief Strategy Officer. Analyze this JSON dataset of our recent bids:
        ${JSON.stringify(dashboardData)}
        
        Generate 3 concise, data-driven hypotheses about our win/loss trends. 
        Format the output as a simple array of 3 strings.
        `;

        const result = await model.generateContent(prompt);
        res.json({ hypotheses: result.response.text() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate hypotheses' });
    }
});

// ---------------------------------------------------------
// 3. CONTEXTUAL CHATBOT ENDPOINT
// ---------------------------------------------------------
// We keep a simple memory map for this example
const chatSessions = {}; 

app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId, dashboardData } = req.body;

        // Start a new chat session with context if it doesn't exist
        if (!chatSessions[sessionId]) {
            chatSessions[sessionId] = model.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: `System Context: You are the Dashboard of Success AI assistant. Answer queries based ONLY on this data: ${JSON.stringify(dashboardData)}. Be concise and professional.` }],
                    },
                    {
                        role: "model",
                        parts: [{ text: "Understood. I am ready to answer questions based on the provided dashboard data." }],
                    }
                ],
            });
        }

        const chat = chatSessions[sessionId];
        const result = await chat.sendMessage(message);
        
        res.json({ reply: result.response.text() });
    } catch (error) {
        res.status(500).json({ error: 'Chat processing failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running securely on port ${PORT}`));
