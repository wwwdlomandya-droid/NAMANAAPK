import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy Google GenAI Client initialization
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Resilient helper to query Gemini with fallback models on 503 / high demand spikes
async function generateGeminiContentWithFallback(
  ai: GoogleGenAI,
  promptText: string
): Promise<string> {
  const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const isTransient =
        err?.status === 503 ||
        err?.code === 503 ||
        err?.status === 429 ||
        err?.code === 429 ||
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('Resource has been exhausted');

      console.warn(`[Gemini Voice Scribe] Model ${model} encountered error (isTransient: ${isTransient}):`, errMsg);

      if (i < modelsToTry.length - 1) {
        // Wait 400ms before retrying with fallback model
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }

  throw lastError;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Voice AI field extraction endpoint
app.post('/api/voice-fill', async (req, res) => {
  try {
    const { transcript, currentData } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ success: false, error: 'Transcript is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        success: false,
        fallback: true,
        message: 'GEMINI_API_KEY not configured on server; fallback to client parser',
      });
    }

    const systemPrompt = `You are an expert clinical medical scribe and clinic operations AI for Namana Physiotherapy Clinic.
Given a spoken medical or administrative voice command/transcript from a physiotherapist or clinic staff, analyze the user's intent, recognize existing patient context, and extract structured actions and clinical fields covering everything from patient demographics, clinical assessment, treatment modalities, to follow-up sessions.

CRITICAL INTENT RULES:
1. 'create_patient' - ONLY if the user explicitly wants to add/register a NEW patient from scratch (e.g., "Add new patient...", "Register patient...", "Create patient...", "New patient Ramesh 45 male...").
2. 'add_followup' - If the user is recording a follow-up visit/session for the patient (e.g., "Add follow up session today pain scale 4 notes patient improved fee 500 UPI", "Follow up visit today IFT given pain 3", "Add next session...").
3. 'update_followup' - If the user is modifying an existing follow-up session (e.g., "Update session 2 pain scale to 3", "In latest follow up change notes to exercises tolerated well", "Update follow up fee to 400").
4. 'update_patient' - If the user is updating or editing ANY existing patient fields (demographics, clinical assessment, diagnosis, pain scales, comorbidities, modalities, fee, contact, etc.) for the currently open patient OR a named patient. Note: If an active patient exists in 'Current form context', any field dictations (like "change phone to...", "update age to...", "diagnosis cervical radiculopathy", "pain scale before 8 after 3", "add diabetes", "fee 600") MUST be classified as 'update_patient' (or 'add_followup'/'update_followup'), NEVER 'create_patient'!
5. 'find_patient' - If the user wants to open/find a patient (e.g., "Open patient Priya", "Find patient Ramesh").
6. 'navigate' - If the user wants to switch tabs (e.g., "Go to monthly report", "Show fees", "Show IT return", "Go to backup", "Locum doctors", "Show all patients").
7. 'search' - If the user wants to search (e.g., "Search 9880517715", "Search frozen shoulder").
8. 'download_pdf' - If user says "Download case sheet" or "Export PDF".
9. 'create_receipt' - If user says "Create receipt" or "Generate bill".

JSON schema to return:
{
  "action": "create_patient" | "update_patient" | "add_followup" | "update_followup" | "find_patient" | "navigate" | "search" | "download_pdf" | "create_receipt",
  "targetPatientName": string | null,
  "targetView": "patients" | "monthly" | "fees" | "itreturn" | "backup" | "locum" | null,
  "searchQuery": string | null,
  "actionSummary": string,
  "fields": {
    "name": string | null,
    "age": number | null,
    "sex": "Male" | "Female" | "Other" | null,
    "contact": string | null,
    "address": string | null,
    "height": string | null,
    "weight": string | null,
    "bloodGroup": string | null,
    "date": string | null,
    "time": string | null,
    "diagnosis": string | null,
    "history": string | null,
    "painScaleBefore": number | null,
    "painScaleAfter": number | null,
    "treatmentFee": number | null,
    "paymentMethod": "Cash" | "UPI" | "Card" | "Bank Transfer" | null,
    "visitType": "Clinic" | "Home Visit" | null,
    "referredBy": string | null,
    "seenBy": string | null,
    "comorbid": { "diabetes"?: boolean, "bp"?: boolean, "thyroid"?: boolean, "other"?: boolean, "otherText"?: string },
    "modalities": string[],
    "followUp": {
      "action": "add" | "update" | null,
      "sessionNumber": number | null,
      "date": string | null,
      "time": string | null,
      "notes": string | null,
      "painScaleBefore": number | null,
      "painScaleAfter": number | null,
      "treatmentsGiven": string[],
      "fee": number | null,
      "paymentMethod": "Cash" | "UPI" | "Card" | "Bank Transfer" | null,
      "visitType": "Clinic" | "Home Visit" | null,
      "seenBy": string | null
    }
  }
}

Return ONLY valid JSON matching this schema. If a field was not mentioned or unchanged, set it to null or omit it.`;

    let text = '{}';
    try {
      const fullPrompt = `${systemPrompt}\n\nTranscript: "${transcript}"\nCurrent form context: ${JSON.stringify(currentData || {})}`;
      text = await generateGeminiContentWithFallback(ai, fullPrompt);
    } catch (genErr: any) {
      console.warn(
        '[Gemini Voice Scribe] AI models temporarily busy, safely activating client-side clinical NLP:',
        genErr?.message || genErr
      );
      return res.json({
        success: false,
        fallback: true,
        message: 'AI models temporarily experiencing high demand, falling back to local NLP parser',
      });
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const finalFields = parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : parsed;

    return res.json({
      success: true,
      action: parsed.action || 'update_patient',
      targetPatientName: parsed.targetPatientName || null,
      targetView: parsed.targetView || null,
      searchQuery: parsed.searchQuery || null,
      actionSummary: parsed.actionSummary || null,
      fields: finalFields,
    });
  } catch (error: any) {
    console.warn('[Voice Scribe Route] Handled error in /api/voice-fill:', error?.message || error);
    return res.json({
      success: false,
      fallback: true,
      error: error?.message || 'Error processing speech',
    });
  }
});

// Vite middleware for dev / static for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Namana Physiotherapy Clinic server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
