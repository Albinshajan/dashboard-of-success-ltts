const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Log API Key Loading (Masked)
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
  console.log(`✅ API Key loaded: ${apiKey.substring(0, 8)}...`);
} else {
  console.error('❌ API Key NOT found in .env');
}

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Backend is running' }));

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(apiKey || 'YOUR_API_KEY_HERE');

// Multer Setup for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

const crypto = require('crypto');
const ALTAIR_URL = process.env.ALTAIR_SERVICE_URL || 'http://localhost:8000';

// In-memory store of preprocessed datasets + chart plans, keyed by session id.
// Lets the user add custom charts to an existing dashboard without re-uploading.
// (Capped so a long-running server doesn't grow unbounded.)
const sessions = new Map();
const MAX_SESSIONS = 50;

function newSession(obj) {
  const id = crypto.randomUUID();
  if (sessions.size >= MAX_SESSIONS) {
    sessions.delete(sessions.keys().next().value); // evict oldest
  }
  sessions.set(id, obj);
  return id;
}

function rememberSession(rows, plan) {
  return newSession({ rows, plan });
}

// Parse a value to a number: strip thousands separators, currency, %, spaces —
// but never letters (so "Q1" / category codes stay non-numeric).
function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/[,$€£₹%\s]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isDateish(v) {
  if (v instanceof Date) return true;
  const s = String(v).trim();
  // Must contain a 4-digit year AND a date separator — otherwise codes like
  // "T-101" slip through because Date.parse() is far too lenient.
  if (!/\d{4}/.test(s) || !/[-/]/.test(s)) return false;
  return !Number.isNaN(Date.parse(s));
}

// Classify every column so the data is PROPERLY CATEGORIZED before analysis:
//   numeric  -> a measure (sum/avg)         categorical -> a dimension to group by
//   date     -> a timeline (temporal)       identifier  -> near-unique IDs/names (don't chart)
//   empty    -> all blank (ignore)
function profileColumns(rows) {
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  return cols.map((c) => {
    const present = rows.map((r) => r[c]).filter((v) => v !== null && v !== undefined && v !== '');
    const distinct = new Set(present.map((v) => String(v).trim().toLowerCase())).size;
    if (!present.length) return { name: c, role: 'empty', distinct: 0 };
    if (present.filter((v) => parseNumber(v) !== null).length / present.length >= 0.8) {
      return { name: c, role: 'numeric', distinct };
    }
    if (present.filter((v) => isDateish(v)).length / present.length >= 0.8) {
      return { name: c, role: 'date', distinct };
    }
    // Text: near-unique values are identifiers/free-text, not useful categories.
    if (distinct / present.length > 0.9 && distinct > 20) {
      return { name: c, role: 'identifier', distinct };
    }
    return { name: c, role: 'categorical', distinct };
  });
}

function profileToText(profile) {
  if (!profile.length) return '';
  const lines = profile.map((p) => `  - ${p.name}: ${p.role} (${p.distinct} distinct values)`);
  return `COLUMN PROFILE (auto-detected role | distinct count):\n${lines.join('\n')}`;
}

// Call the Altair service to compile the linked filter + highlight specs.
async function buildVega(rows, plan) {
  const res = await fetch(`${ALTAIR_URL}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: rows, plan }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Altair service error (${res.status}): ${detail}`);
  }
  return res.json();
}

// Phase 1: ask the LLM whether anything about the data is genuinely ambiguous.
// Returns a (possibly empty) list of clarifying questions for the user.
async function getClarifications(model, columns, statsSummary, sampleRows, profileText) {
  const prompt = `
    You are preparing to analyze a BID/TENDER dataset to build a success dashboard.
    COLUMNS: ${JSON.stringify(columns)}
    ${profileText ? profileText + '\n' : ''}
    STATS: ${statsSummary}
    SAMPLE ROWS (first few): ${JSON.stringify(sampleRows)}

    Identify ONLY genuine ambiguities that would materially change the analysis or
    cause WRONG numbers (totals, status share). Typical doubts:
    - Which column is the monetary Total Contract Value (TCV), and what UNIT is it in
      (actual amounts, thousands, lakhs, crores, or millions)?
    - Which column records the bid/tender STATUS (e.g. Won / In Hand, Under Evaluation, Lost, Submitted)?
    - Which single column should the dashboard be sliced/cross-filtered by?
    - If there are multiple date columns, which one represents the timeline?
    - Any column whose business meaning is unclear from its name.

    Return STRICT JSON: {"clarifications":[{"id":"q1","question":"...","type":"select"|"text","options":["..."],"why":"short reason"}]}
    Rules:
    - Ask AT MOST 4 questions, and ONLY when genuinely ambiguous. If everything is clear,
      return {"clarifications":[]}.
    - For "select", options MUST be concrete: actual column names, or choices like
      ["Actual amounts","Thousands","Lakhs","Crores","Millions"] for units.
    - Always include a units question for the TCV/value column if one exists.
    - Keep each question short and business-friendly. Output JSON only.
  `;
  try {
    const r = await model.generateContent(prompt);
    const t = (await r.response).text().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(t);
    const qs = Array.isArray(parsed.clarifications) ? parsed.clarifications : [];
    return qs
      .filter((q) => q && q.question)
      .slice(0, 4)
      .map((q, i) => ({
        id: q.id || `q${i + 1}`,
        question: String(q.question),
        type: q.type === 'select' && Array.isArray(q.options) && q.options.length ? 'select' : 'text',
        options: Array.isArray(q.options) ? q.options.slice(0, 8) : [],
        why: q.why ? String(q.why) : '',
      }));
  } catch (e) {
    console.error('⚠️  Clarification check failed (proceeding without):', e.message);
    return [];
  }
}

// Build the chart-plan prompt, optionally injecting the user's clarifications.
function buildPlanPrompt(statsSummary, columns, chartCount, clarificationText, profileText) {
  return `
      ACT AS A SENIOR DATA SCIENTIST & BUSINESS ANALYST.
      DATASET CONTEXT: ${statsSummary}
      AVAILABLE COLUMNS (use these EXACT names, case-sensitive): ${JSON.stringify(columns)}
      ${profileText ? `\n${profileText}\n` : ''}
      ${clarificationText ? `\n${clarificationText}\n` : ''}
      The data has already been cleaned and type-inferred: numbers/dates coerced,
      blank columns dropped, and spelling/spacing/case variants of the same category
      merged (e.g. "ICCC", "ICCC ", "iccc" count as ONE). Categorize using the COLUMN
      PROFILE above: chart 'categorical' columns as dimensions, 'numeric' as measures,
      'date' as temporal. NEVER chart 'identifier' or 'empty' columns. Pick the
      cross-filter dimension from a meaningful LOW-cardinality 'categorical' column.

      TASK:
      1. Analyze the uploaded dataset using the provided statistical summary.
      2. Identify the most critical trends, correlations, or anomalies in the data.
      3. Design EXACTLY ${chartCount} charts for an INTERACTIVE LINKED DASHBOARD where selecting
         a value in one chart cross-filters/highlights all the others.
      4. Choose ONE categorical column as "crossfilter_field" (e.g. Country, Region, Category,
         Segment) — the most important primary dimension users will click to slice the dashboard.
      5. Use ONLY these four chart types — pick the PERFECT one for each relationship:
         - "bar"   (bar/column): compare a measure across categories
         - "line":  trend over time or an ordered axis
         - "point" (scatter): correlation between two numeric measures
         - "arc"   (PIE chart): use this ONE chart EXCLUSIVELY to show the share of
           tenders/bids by their STATUS — i.e. the column that records whether a
           tender is "In Hand"/"Won", "Under Evaluation", "Lost", "Submitted", etc.
           This pie visualises overall success status.
           * Set "x" to that status column and "y" to a count of records
             (use "aggregate": "count"), so slices = proportion of tenders per status.
           * Include the pie ONLY IF such a status column exists; otherwise use the
             other chart types and skip the pie. Never use a pie for anything else.
      6. Express each chart as a structured PLAN (NOT Plotly, NOT Vega). A separate Altair
         engine compiles your plan into interactive charts, so just describe encodings.
      7. Mark exactly ONE chart as "is_filter_source": true — it MUST encode the
         crossfilter_field (usually a bar/arc chart broken down by that field).
      8. Also provide an overall summary and 3 strategic hypotheses for the business.

      QUALITY RULES — charts must be MEANINGFUL, never random or decorative:
      - Each chart MUST answer a specific, important question about THIS dataset and be
        backed by a real pattern (a trend, a correlation, a ranking, a concentration,
        an outlier, or a composition). State that insight in "description".
      - Every chart must be DISTINCT — never two charts showing the same relationship or
        the same pair of fields. Together they should cover different angles
        (composition, comparison, trend, correlation, distribution).
      - Only chart columns that carry analytical meaning. NEVER plot ID columns,
        names, free-text, row indices, or near-unique identifier fields.
      - Always aggregate a measure when grouping by a category (don't plot raw rows as bars).
      - Prefer the dataset's strongest signals (largest variance, clearest correlation,
        biggest gaps between categories) over trivial ones.

      ENCODING RULES:
      - Every "field" MUST be one of AVAILABLE COLUMNS exactly. Never invent columns.
      - "type" is one of: "nominal" (categories), "quantitative" (numbers),
        "temporal" (dates), "ordinal" (ranked categories).
      - "aggregate" is optional, one of: "sum", "mean", "count", "median", "min", "max",
        or null. Aggregate quantitative measures when the x/color axis is categorical.
      - "mark" is one of ONLY: "bar", "line", "point", "arc". Do NOT use any other type.

      JSON SCHEMA REQUIREMENT (return EXACTLY ${chartCount} items in dynamic_charts):
      {
        "overall_health": 0-100,
        "overall_summary": "A 2-3 sentence executive summary...",
        "dashboard_title": "Short dashboard title",
        "crossfilter_field": "ExactColumnName",
        "strategic_hypotheses": [
          { "id": "h1", "title": "...", "evidence": "The data shows...", "action_item": "We should..." }
        ],
        "dynamic_charts": [
          {
            "id": "unique_string_id",
            "title": "Insightful Chart Title",
            "description": "What the chart shows and the business implication...",
            "mark": "bar",
            "is_filter_source": true,
            "x": { "field": "ExactColumnName", "type": "nominal", "aggregate": null },
            "y": { "field": "ExactColumnName", "type": "quantitative", "aggregate": "sum" },
            "color": null
          }
        ]
      }

      ONLY return valid JSON matching the schema. Adapt entirely to the provided data context;
      do not generate generic charts.
    `;
}

// Phase 2: generate the chart plan with Gemini, compile via Altair, store session.
async function runGeneration(model, ctx, clarificationText, existingSessionId) {
  const prompt = buildPlanPrompt(ctx.statsSummary, ctx.columns, ctx.chartCount, clarificationText, ctx.profileText);
  const result = await model.generateContent([prompt, ctx.promptData]);
  const text = (await result.response).text();
  const data = JSON.parse(text.replace(/```json|```/g, '').trim());

  if (ctx.jsonData.length > 0 && Array.isArray(data.dynamic_charts) && data.dynamic_charts.length > 0) {
    const plan = {
      dashboard_title: data.dashboard_title,
      crossfilter_field: data.crossfilter_field,
      dynamic_charts: data.dynamic_charts,
    };
    try {
      data.vega = await buildVega(ctx.jsonData, plan);
      if (existingSessionId && sessions.has(existingSessionId)) {
        const s = sessions.get(existingSessionId);
        s.rows = ctx.jsonData;
        s.plan = plan;
        data.session_id = existingSessionId;
      } else {
        data.session_id = rememberSession(ctx.jsonData, plan);
      }
      data.columns = data.vega.columns;
      data.column_types = data.vega.column_types;
      console.log(`📊 Altair compiled linked dashboard (cross-filter: ${data.vega.crossfilter_field}, charts: ${data.dynamic_charts.length})`);
    } catch (e) {
      console.error('⚠️  Altair build failed:', e.message);
      data.vega_error = e.message.includes('fetch')
        ? `Could not reach Altair service at ${ALTAIR_URL}. Is it running on :8000?`
        : e.message;
    }
  }
  return data;
}

// Helper to convert file to generative part
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

const XLSX = require('xlsx');

// 1. Intelligent Upload Endpoint (Extraction)
app.post('/api/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log(`📂 Received file: ${req.file.originalname} (${req.file.mimetype})`);

  try {
    const modelName = "gemini-flash-latest"; 
    const model = genAI.getGenerativeModel({ model: modelName });
    
    let promptData;
    let mimeType = req.file.mimetype;

    // 2. CALCULATE STATISTICAL SUMMARY & SET PROMPT DATA
    let statsSummary = "";
    let jsonData = [];
    let csvData = "";
    
    if (req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.xls')) {
      // cellDates keeps real dates as Date objects instead of Excel serial numbers.
      const workbook = XLSX.readFile(req.file.path, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      csvData = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      promptData = { text: `Analyze this spreadsheet data:\n\n${csvData}` };
      console.log('📊 Converted Excel to CSV for AI analysis');
    } else if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
      const content = fs.readFileSync(req.file.path, 'utf8');
      const workbook = XLSX.read(content, { type: 'string', cellDates: true });
      jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      promptData = { text: `Analyze this CSV data:\n\n${content}` };
      console.log('📄 Processed CSV for AI analysis');
    } else {
      // For other files, use the generative part logic
      const supportedMimeTypes = [
        'application/pdf', 
        'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
        'text/plain', 'text/html', 'text/md',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (supportedMimeTypes.includes(mimeType)) {
        promptData = fileToGenerativePart(req.file.path, mimeType);
      } else {
        try {
          const content = fs.readFileSync(req.file.path, 'utf8');
          promptData = { text: content };
        } catch (e) {
          throw new Error(`Unsupported file type: ${mimeType}. Please use PDF, Word, Excel, CSV, or Images.`);
        }
      }
    }

    if (jsonData.length > 0) {
      const cols = Object.keys(jsonData[0]);
      // A column is numeric if >=80% of its non-empty values parse as numbers —
      // checked across ALL rows, not just the first (which may be blank/text).
      const numericCols = cols.filter((c) => {
        const present = jsonData
          .map((d) => d[c])
          .filter((v) => v !== null && v !== undefined && v !== '');
        if (!present.length) return false;
        const numeric = present.filter((v) => parseNumber(v) !== null).length;
        return numeric / present.length >= 0.8;
      });

      const stats = numericCols.map((col) => {
        const values = jsonData.map((d) => parseNumber(d[col])).filter((v) => v !== null);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / (values.length || 1);
        // Full precision for the sum so totals like TCV aren't rounded/garbled.
        return `${col}: (Count: ${values.length}, Sum: ${sum}, Avg: ${avg.toFixed(2)})`;
      }).join(' | ');

      statsSummary = `COLUMNS: ${cols.join(', ')}. NUMERIC STATS: ${stats}. TOTAL RECORDS: ${jsonData.length}`;
      console.log('📈 Calculated statistical summary for AI');
    }

    const columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

    // How many charts to generate (user-selectable 4-6, default 5).
    let chartCount = parseInt(req.body.chart_count, 10);
    if (Number.isNaN(chartCount)) chartCount = 5;
    chartCount = Math.max(4, Math.min(6, chartCount));

    // Profile every column so the data is properly categorized for the AI.
    const profile = profileColumns(jsonData);
    const profileText = profileToText(profile);
    if (profile.length) {
      console.log('🏷️  Column profile: ' + profile.map((p) => `${p.name}=${p.role}`).join(', '));
    }

    const ctx = { promptData, statsSummary, columns, chartCount, jsonData, profileText };

    // Phase 1 — for tabular data, ask the LLM if anything is ambiguous. If so,
    // return clarifying questions to the user BEFORE generating the dashboard.
    if (jsonData.length > 0) {
      const sampleRows = jsonData.slice(0, 3);
      const clarifications = await getClarifications(model, columns, statsSummary, sampleRows, profileText);
      if (clarifications.length > 0) {
        const session_id = newSession({
          rows: jsonData,
          columns,
          statsSummary,
          chartCount,
          promptText: promptData.text,
          profileText,
          questions: clarifications,
        });
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.log(`❓ Asking user ${clarifications.length} clarifying question(s) before analysis`);
        return res.json({ needs_clarification: true, clarifications, session_id, columns });
      }
    }

    // Phase 2 — no ambiguity (or non-tabular): generate the dashboard directly.
    const data = await runGeneration(model, ctx, '', null);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json(data);
  } catch (error) {
    console.error('Extraction Error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: error.message });
  }
});

// 1a. Generate Endpoint — phase 2 of upload: the user has answered the
// clarifying questions, so generate the dashboard using those answers.
app.post('/api/generate', async (req, res) => {
  const { session_id, answers } = req.body || {};
  const session = session_id && sessions.get(session_id);
  if (!session || !session.rows) {
    return res.status(404).json({ error: 'Session expired. Please re-upload your file.' });
  }

  // Turn the Q&A into authoritative guidance for the generation prompt.
  let clarificationText = '';
  if (Array.isArray(session.questions) && answers) {
    const lines = session.questions
      .map((q) => {
        const a = answers[q.id];
        return a ? `- ${q.question} => ${a}` : null;
      })
      .filter(Boolean);
    if (lines.length) {
      clarificationText =
        'USER CLARIFICATIONS (authoritative — follow these EXACTLY when choosing columns, ' +
        'the status field, the cross-filter dimension, and especially when interpreting units ' +
        'of monetary/TCV values):\n' + lines.join('\n');
    }
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  const ctx = {
    promptData: { text: session.promptText || '' },
    statsSummary: session.statsSummary || '',
    columns: session.columns || [],
    chartCount: session.chartCount || 5,
    jsonData: session.rows,
    profileText: session.profileText || '',
  };

  try {
    const data = await runGeneration(model, ctx, clarificationText, session_id);
    res.json(data);
  } catch (e) {
    console.error('Generation Error:', e);
    res.status(400).json({ error: e.message });
  }
});

// 1b. Custom Chart Endpoint — append a user-defined chart to an existing
// dashboard and recompile the linked specs so it cross-filters with the rest.
app.post('/api/custom-chart', async (req, res) => {
  const { session_id, chart } = req.body || {};
  const session = session_id && sessions.get(session_id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired. Please re-upload your file.' });
  }
  if (!chart || !chart.mark || !(chart.x && chart.x.field) || !(chart.y && chart.y.field)) {
    return res.status(400).json({ error: 'Chart needs at least a mark, an X field and a Y field.' });
  }

  const validColumns = new Set(session.rows.length ? Object.keys(session.rows[0]).map(c => c.trim()) : []);
  for (const ch of [chart.x, chart.y, chart.color]) {
    if (ch && ch.field && !validColumns.has(String(ch.field).trim())) {
      return res.status(400).json({ error: `Unknown column "${ch.field}".` });
    }
  }

  const newChart = {
    id: `custom_${crypto.randomUUID().slice(0, 8)}`,
    title: chart.title || `${chart.y.field} by ${chart.x.field}`,
    description: 'User-defined chart.',
    mark: chart.mark,
    is_filter_source: false,
    x: chart.x,
    y: chart.y,
    color: chart.color || null,
    custom: true,
  };

  const plan = {
    ...session.plan,
    dynamic_charts: [...session.plan.dynamic_charts, newChart],
  };

  try {
    const vega = await buildVega(session.rows, plan);
    session.plan = plan; // persist so further custom charts accumulate
    console.log(`➕ Added custom ${newChart.mark} chart (now ${plan.dynamic_charts.length} charts)`);
    res.json({ vega, dynamic_charts: plan.dynamic_charts });
  } catch (e) {
    console.error('⚠️  Custom chart build failed:', e.message);
    res.status(400).json({ error: e.message });
  }
});

// 2. Chatbot Assistant Endpoint
app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "You are the Success Dashboard Assistant for LTTS. Help the user analyze their strategic data." }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I am ready to assist with LTTS business intelligence and document analysis." }],
        },
      ],
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'AI Assistant failed to respond' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Success Dashboard Backend running at http://localhost:${port}`);
});
