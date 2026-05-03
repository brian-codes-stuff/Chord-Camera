import * as FileSystem from 'expo-file-system';

/**
 * On-device OCR via @react-native-ml-kit/text-recognition.
 *
 * Apple Vision on iOS, Google ML Kit on Android. Both run fully offline.
 *
 * Requires a development build — does NOT work in Expo Go. Run:
 *   npx expo prebuild
 *   npx expo run:ios   (or run:android)
 *
 * In Expo Go, OCR_AVAILABLE is false and `recognizeText` returns sample text
 * so the rest of the app stays usable for development.
 */

let TextRecognition;
export let OCR_AVAILABLE = false;
export const OCR_ENGINE = (process.env.EXPO_PUBLIC_OCR_ENGINE || 'device').toLowerCase();
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
export const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-pro';
export const GEMINI_AVAILABLE = !!GEMINI_API_KEY;

try {
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
  OCR_AVAILABLE = !!TextRecognition;
} catch (_) {
  // Native module not linked — OCR runs in demo mode
}

const SAMPLE_CHART = `[Verse 1]
G              D            Em        C
Amazing grace how sweet the sound
G            D       G
That saved a wretch like me
G                  D            Em       C
I once was lost but now am found
G          D       G
Was blind but now I see

[Chorus]
C        G       D       G
My chains are gone I've been set free
C       G            D       Em
My God my Savior has ransomed me
C        G       D       Em      C       G       D       G
And like a flood His mercy reigns unending love amazing grace`;

function inferMimeType(imageUri) {
  const lower = (imageUri || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function extractGeminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const joined = parts
    .map(part => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
  return joined
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Convert Gemini's tagged output (S:/C:/L: prefixes) into plain text
 * with chords and lyrics on correctly separated lines.
 */
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
      out.push(trimmed.slice(2)); // chord line — keep as-is
    } else if (trimmed.startsWith('L:')) {
      out.push(trimmed.slice(2).trim());
    } else {
      // untagged fallback — keep it
      out.push(trimmed);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function recognizeTextWithGemini(imageUri) {
  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

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

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

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
                mime_type: inferMimeType(imageUri),
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = json?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini OCR request failed: ${apiMessage}`);
  }

  const raw = extractGeminiText(json);
  if (!raw) {
    throw new Error('Gemini OCR returned an empty response.');
  }
  // If Gemini used tagged format, parse it; otherwise return raw.
  const hasTaggedLines = /^[SCL]:/m.test(raw);
  return hasTaggedLines ? parseTaggedOutput(raw) : raw;
}

// ---------------------------------------------------------------------------
// Chord-line classification (no AI required)
// ---------------------------------------------------------------------------

/**
 * Matches standard chord tokens: C, Am, F#m7, Gsus4, D/F#, Cadd9, Bb, D(4)
 * Root must be A-G (uppercase). Optional accidental, quality, number, bass note.
 */
const CHORD_TOKEN_RE =
  /^[A-G][#b]?(?:(?:maj|min|dim|aug|sus|add)\d*|\d+|m|M)*(?:\/[A-G][#b]?)?(?:\([^)]+\))?$/;

function isChordToken(token) {
  return CHORD_TOKEN_RE.test(token);
}

/**
 * Returns true when a line consists almost entirely of chord symbols.
 * Requires ≥80% of whitespace-separated tokens to match the chord pattern
 * and no single token longer than 8 characters (rules out regular words).
 */
function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.some(t => t.length > 8)) return false;
  const chordCount = tokens.filter(isChordToken).length;
  return chordCount > 0 && chordCount / tokens.length >= 0.8;
}

/**
 * Walk reconstructed lines and wrap obvious section headers in [brackets].
 * Leaves chord lines and lyric lines untouched.
 */
function classifyAndFormatLines(text) {
  const sectionRe = /^[A-Z][A-Z\s\d:]+$/; // e.g. "VERSE 1", "CHORUS", "BRIDGE"
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (
        sectionRe.test(trimmed) &&
        trimmed.length < 30 &&
        !isChordLine(trimmed) &&
        !/^\[/.test(trimmed)
      ) {
        return `[${trimmed}]`;
      }
      return line;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Reconstruct the chart's visual layout from ML Kit's bounding-box data.
 *
 * ML Kit returns text in reading order, which on a chord chart mangles the
 * chord-over-lyric structure: each chord ends up on its own line because the
 * spaces between chords are wider than spaces between letters. We need to
 * rebuild rows from Y-coordinates and re-space columns from X-coordinates.
 */
function reconstructLayout(blocks) {
  if (!blocks?.length) return '';

  // Flatten to per-element list with global coordinates.
  // Some ML Kit versions only expose lines (no elements); fall back to lines.
  const elements = [];
  for (const block of blocks) {
    for (const line of block.lines || []) {
      const elems = line.elements;
      if (elems?.length) {
        for (const el of elems) {
          const f = el.frame || {};
          elements.push({
            text: el.text,
            x: f.left ?? f.x ?? 0,
            y: f.top ?? f.y ?? 0,
            w: f.width ?? 0,
            h: f.height ?? 0,
          });
        }
      } else {
        const f = line.frame || {};
        elements.push({
          text: line.text,
          x: f.left ?? f.x ?? 0,
          y: f.top ?? f.y ?? 0,
          w: f.width ?? 0,
          h: f.height ?? 0,
        });
      }
    }
  }
  if (!elements.length) return '';

  // Median glyph height drives row tolerance; per-glyph width drives columns.
  const heights = elements.map(e => e.h).filter(h => h > 0).sort((a, b) => a - b);
  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 20;
  // Tighter tolerance: chord lines and lyric lines are usually at least half
  // a glyph height apart. 0.35 prevents chords from merging with the lyric
  // line immediately below them.
  const rowTolerance = medianHeight * 0.35;

  let totalW = 0, totalChars = 0;
  for (const el of elements) {
    if (el.text.length && el.w > 0) { totalW += el.w; totalChars += el.text.length; }
  }
  const charWidth = totalChars > 0 ? totalW / totalChars : Math.max(8, medianHeight * 0.5);

  // Group into rows by Y proximity (top-to-bottom).
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  let curr = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const el = sorted[i];
    const lastY = curr[curr.length - 1].y;
    if (Math.abs(el.y - lastY) < rowTolerance) curr.push(el);
    else { rows.push(curr); curr = [el]; }
  }
  rows.push(curr);

  // Build a spaced chord line from an array of elements.
  function buildChordLine(elems) {
    let line = '';
    let cursor = 0;
    for (let i = 0; i < elems.length; i++) {
      const el = elems[i];
      let col = Math.round(el.x / charWidth);
      if (i > 0) col = Math.max(col, cursor + 1);
      if (col > cursor) line += ' '.repeat(col - cursor);
      line += el.text;
      cursor = col + el.text.length;
    }
    return line;
  }

  const outputLines = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);

    const chordEls = row.filter(el => isChordToken(el.text));
    const lyricEls = row.filter(el => !isChordToken(el.text));
    const rowText  = row.map(el => el.text).join(' ');

    if (isChordLine(rowText)) {
      // Pure chord row — preserve column spacing
      outputLines.push(buildChordLine(row));
    } else if (chordEls.length > 0 && lyricEls.length > 0) {
      // Mixed row: ML Kit merged a chord token with the lyric below it.
      // Emit the chords first (with spacing), then the lyric words.
      outputLines.push(buildChordLine(chordEls));
      outputLines.push(lyricEls.map(el => el.text).join(' '));
    } else {
      // Pure lyric / title / section row
      outputLines.push(row.map(el => el.text).join(' '));
    }
  }
  return outputLines.join('\n');
}

/**
 * Recognize text from a local image URI. Returns the extracted text as a string.
 * Falls back to sample text in environments without the native module.
 */
export async function recognizeText(imageUri) {
  if (!imageUri) {
    await new Promise(r => setTimeout(r, 600));
    return { text: SAMPLE_CHART, blocks: [], provider: 'sample' };
  }

  const shouldTryGemini = OCR_ENGINE === 'auto' || OCR_ENGINE === 'gemini';
  const shouldTryDevice = OCR_ENGINE === 'auto' || OCR_ENGINE === 'device';

  if (shouldTryGemini) {
    if (!GEMINI_AVAILABLE && OCR_ENGINE === 'gemini') {
      throw new Error('Gemini OCR is enabled but EXPO_PUBLIC_GEMINI_API_KEY is missing.');
    }

    if (GEMINI_AVAILABLE) {
      try {
        const text = await recognizeTextWithGemini(imageUri);
        return { text, blocks: [], provider: 'gemini' };
      } catch (geminiError) {
        console.warn('[ocr] gemini failed, falling back to device OCR:', geminiError);
        if (OCR_ENGINE === 'gemini') {
          throw new Error('Could not read with Gemini OCR. Check API key and network connection.');
        }
      }
    }
  }

  if (!shouldTryDevice) {
    throw new Error('OCR engine is disabled. Set EXPO_PUBLIC_OCR_ENGINE to auto, gemini, or device.');
  }

  if (!OCR_AVAILABLE) {
    throw new Error('On-device OCR is unavailable in this build. Use a development build or configure Gemini OCR.');
  }

  try {
    const result = await TextRecognition.recognize(imageUri);
    const blocks = result.blocks || [];

    // Reconstruct layout from bounding boxes; fall back to result.text if the
    // platform didn't give us frame data for some reason.
    let text = '';
    try {
      text = reconstructLayout(blocks);
    } catch (e) {
      console.warn('[ocr] layout reconstruction failed, using raw text:', e);
    }
    if (!text || !text.trim()) text = result.text || '';

    // Post-process: wrap section headers in brackets
    try { text = classifyAndFormatLines(text); } catch (_) {}

    return { text, blocks, provider: 'device' };
  } catch (e) {
    console.warn('[ocr] failed:', e);
    throw new Error('Could not read text from this image. Try a clearer photo.');
  }
}

export const SAMPLE_CHART_TEXT = SAMPLE_CHART;
