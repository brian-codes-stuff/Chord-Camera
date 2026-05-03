const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

const PORT = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.use(cors());
app.use(express.json({ limit: '20mb' }));

function extractGeminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const joined = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();

  return joined
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, model: GEMINI_MODEL });
});

app.post('/ocr/chords', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: { message: 'GEMINI_API_KEY is not configured on the server.' },
    });
  }

  const imageBase64 = req.body?.imageBase64;
  const mimeType = req.body?.mimeType || 'image/jpeg';

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({
      error: { message: 'imageBase64 is required.' },
    });
  }

  const prompt = `You are an expert at reading printed chord charts used by musicians.

A chord chart has a specific two-line structure you must preserve:
- CHORD LINE: a line containing only chord symbols (like G, C, D/F#, Em7, C2, D(4), G/B, Am, Bb, F#m, etc.) positioned above the lyrics they belong to
- LYRIC LINE: the line of sung words directly below the chord line

CRITICAL RULES:
1. NEVER embed chord symbols inside a lyric line. Chords and lyrics are always on SEPARATE lines.
2. If a chord appears visually above a word, output the chord on its own line first, then the lyric line below it.
3. Preserve the horizontal spacing/column position of chords relative to each other on the same chord line.
4. Section headers like VERSE 1, CHORUS, BRIDGE, VERSE 2 should be on their own line in brackets, e.g. [VERSE 1].
5. Read slash chords carefully: D/F# means D-slash-F-sharp, G/B means G-slash-B. Do not confuse slash chords with section dividers.
6. Read the full width of each line — do not cut off text at the right edge.
7. Output plain text only. No markdown, no code fences, no commentary, no corrections.
8. Preserve blank lines between sections.

Return the complete chord chart text now:`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
        },
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = json?.error?.message || `HTTP ${response.status}`;
      return res.status(502).json({
        error: { message: `Gemini request failed: ${apiMessage}` },
      });
    }

    const text = extractGeminiText(json);
    if (!text) {
      return res.status(502).json({
        error: { message: 'Gemini returned an empty response.' },
      });
    }

    return res.json({ text });
  } catch (error) {
    return res.status(502).json({
      error: { message: `OCR upstream error: ${error.message}` },
    });
  }
});

app.listen(PORT, () => {
  console.log(`OCR backend listening on http://localhost:${PORT}`);
});
