/**
 * Test the Gemini OCR prompt against a local image file.
 * Usage: node scripts/test-ocr.mjs path/to/chart.jpg
 *
 * Reads GEMINI_API_KEY and GEMINI_MODEL from backend/.env automatically.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env
const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const imagePath = process.argv[2];

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not found in backend/.env');
  process.exit(1);
}
if (!imagePath) {
  console.error('Usage: node scripts/test-ocr.mjs <image-path>');
  process.exit(1);
}

function inferMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic' || ext === '.heif') return 'image/heic';
  return 'image/jpeg';
}

function parseTaggedOutput(raw) {
  const lines = raw.split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') { out.push(''); continue; }
    if (trimmed.startsWith('S:')) {
      const label = trimmed.slice(2).trim().replace(/^\[?(.+?)\]?$/, '[$1]');
      out.push(label);
    } else if (trimmed.startsWith('C:')) {
      out.push(trimmed.slice(2));
    } else if (trimmed.startsWith('L:')) {
      out.push(trimmed.slice(2).trim());
    } else {
      out.push(trimmed);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const prompt = `You are reading a printed chord chart image for a musician.

Your job: transcribe every line and tag it with a prefix so the app can reconstruct the layout correctly.

TAG RULES — prefix EVERY line with exactly one of these tags:
  S: — section header (e.g. VERSE 1, CHORUS, BRIDGE, VERSE 2, TAG)
  C: — a chord line (contains ONLY chord symbols like G, C, Em7, D/F#, G/B, C2, D(4), Bb — no regular words)
  L: — a lyric line (the sung words)

IMPORTANT:
- A chord line and a lyric line are NEVER the same line. They are always separate lines in the chart.
- If you see chords printed ABOVE lyric words, they are two separate lines: output the C: line first, then the L: line.
- Never put a chord symbol inside an L: line.
- Never put a regular English word inside a C: line.
- Slash chords like D/F# and G/B are single chord symbols — keep them together.
- Include ALL text from the image including title and metadata lines (tag those as L:).
- Output a blank line between sections.
- Do not output any markdown, code fences, or explanation — only the tagged lines.

EXAMPLE INPUT (what you see in the image):
  VERSE 1
        G           C              G
  I love You Lord oh Your mercy never fails me
      D/F#   Em7      C       D(4)
  All my days I've been held in Your hands

EXAMPLE OUTPUT (what you must produce):
S: VERSE 1
C:       G           C              G
L: I love You Lord oh Your mercy never fails me
C:     D/F#   Em7      C       D(4)
L: All my days I've been held in Your hands

Now tag and transcribe the entire chord chart from the image:`;

const imageBase64 = fs.readFileSync(imagePath).toString('base64');
const mimeType = inferMimeType(imagePath);

console.log(`Model:  ${GEMINI_MODEL}`);
console.log(`Image:  ${imagePath} (${mimeType})`);
console.log('Calling Gemini...\n');

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
    generationConfig: { temperature: 0 },
  }),
});

const json = await res.json();
if (!res.ok) {
  console.error('Gemini error:', json?.error?.message || res.status);
  process.exit(1);
}

const parts = json?.candidates?.[0]?.content?.parts || [];
const raw = parts.map(p => p.text || '').join('\n')
  .replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/i, '').trim();

console.log('─── RAW GEMINI OUTPUT ───────────────────────────────────');
console.log(raw);

const hasTaggedLines = /^[SCL]:/m.test(raw);
const text = hasTaggedLines ? parseTaggedOutput(raw) : raw;

console.log('\n─── PARSED OUTPUT ───────────────────────────────────────');
console.log(text);
console.log('═'.repeat(60));
