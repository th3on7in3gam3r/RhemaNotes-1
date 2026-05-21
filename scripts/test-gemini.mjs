/**
 * Smoke-test Gemini transcribe + summarize pipeline.
 * Usage: node scripts/test-gemini.mjs
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
const keyMatch = envFile.match(/GEMINI_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Set GEMINI_API_KEY in .env.local');
  process.exit(1);
}

const MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const ai = new GoogleGenAI({ apiKey });

async function test() {
  console.log(`Testing model: ${MODEL}`);
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: 'Reply with exactly: RhemaNotes Gemini OK',
  });
  console.log('OK:', response.text?.trim());
}

test().catch((e) => {
  console.error('FAIL:', e.message || e);
  process.exit(1);
});
