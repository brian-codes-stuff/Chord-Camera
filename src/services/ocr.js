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
  const rowTolerance = medianHeight * 0.6;

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

  // A token "looks chord-like" if it starts with A-G (any case). We use this
  // to decide whether a row needs column-aware spacing (chord rows) or just
  // simple word spacing (titles, credits, lyric-only rows).
  const looksChordy = (t) => /^[A-Ga-g]/.test(t.text);

  return rows.map(row => {
    row.sort((a, b) => a.x - b.x);
    const hasChord = row.some(looksChordy) && row.length <= 12 && row.every(el => el.text.length <= 8);

    if (!hasChord) {
      // Title / credit / lyric row — single-space join, no padding
      return row.map(el => el.text).join(' ');
    }

    // Chord-bearing row — preserve column positions
    let line = '';
    let cursor = 0;
    for (let i = 0; i < row.length; i++) {
      const el = row[i];
      let col = Math.round(el.x / charWidth);
      if (i > 0) col = Math.max(col, cursor + 1);
      if (col > cursor) line += ' '.repeat(col - cursor);
      line += el.text;
      cursor = col + el.text.length;
    }
    return line;
  }).join('\n');
}

/**
 * Recognize text from a local image URI. Returns the extracted text as a string.
 * Falls back to sample text in environments without the native module.
 */
export async function recognizeText(imageUri) {
  if (!OCR_AVAILABLE) {
    await new Promise(r => setTimeout(r, 600));
    return { text: SAMPLE_CHART, blocks: [] };
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

    return { text, blocks };
  } catch (e) {
    console.warn('[ocr] failed:', e);
    throw new Error('Could not read text from this image. Try a clearer photo.');
  }
}

export const SAMPLE_CHART_TEXT = SAMPLE_CHART;
