/**
 * Chord parsing + transposition.
 *
 * Handles standard pop/worship chord notation:
 *   C, Am, G7, Dsus4, F#m7, Bb/D, Cmaj7, A7sus4, etc.
 */

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Major keys that conventionally use flats. C and all sharp keys use sharps.
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);

// Strict chord regex. Quality must match a known pattern; arbitrary letters are rejected.
// Catches: C, Cm, Cmaj7, Cm7b5, C7sus4, Cadd9, C/E, F#m7, Bb, Bbmaj9, D(4), C(2), Em(7), D(maj7), etc.
// Rejects: "Bridge", "Chorus", "Cornerstone", "Be", "Free", song titles in general.
//
// CCLI / SongSelect charts wrap extensions in parens (D⁽⁴⁾ → "D(4)" after OCR);
// parens may appear anywhere within the quality block (e.g. Em(7), D(maj7), C(2)).
const CHORD_REGEX =
  /^([A-G])([#b])?[()]*(?:(m|min|M|maj|Maj|dim|aug|sus|add|°|\+)?[()]*(?:(\d+))?[()]*(?:sus[24])?[()]*(?:add\d+)?[()]*(?:[#b]\d+)*[()]*)(?:\/([A-G])([#b])?)?$/;

export const ALL_KEYS = [
  'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F',
  'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
];

export function noteToIndex(note) {
  const sharpIdx = SHARP_NOTES.indexOf(note);
  if (sharpIdx >= 0) return sharpIdx;
  const flatIdx = FLAT_NOTES.indexOf(note);
  if (flatIdx >= 0) return flatIdx;
  return -1;
}

function indexToNote(index, useFlats) {
  const i = ((index % 12) + 12) % 12;
  return useFlats ? FLAT_NOTES[i] : SHARP_NOTES[i];
}

/**
 * Parse a chord token into root, accidental, quality, bass.
 * Returns null if the token isn't a chord.
 */
export function parseChord(token) {
  if (!token) return null;
  const match = token.match(CHORD_REGEX);
  if (!match) return null;
  const [whole, root, accidental = '', , , bassRoot, bassAccidental = ''] = match;
  // The full chord text minus root/accidental/bass is the quality
  const bassPart = bassRoot ? '/' + bassRoot + bassAccidental : '';
  const quality = whole.slice((root + accidental).length, whole.length - bassPart.length);
  return {
    root: root + accidental,
    quality,
    bass: bassRoot ? bassRoot + bassAccidental : null,
    raw: token,
  };
}

export function isChord(token) {
  return parseChord(token) !== null;
}

/**
 * Transpose a single chord by `semitones`, rendering with sharps/flats based on target key.
 */
export function transposeChord(chordStr, semitones, targetKey) {
  const parsed = parseChord(chordStr);
  if (!parsed) return chordStr;

  const useFlats = FLAT_KEYS.has(targetKey);
  const rootIdx = noteToIndex(parsed.root);
  if (rootIdx < 0) return chordStr;
  const newRoot = indexToNote(rootIdx + semitones, useFlats);

  let result = newRoot + parsed.quality;
  if (parsed.bass) {
    const bassIdx = noteToIndex(parsed.bass);
    if (bassIdx >= 0) {
      result += '/' + indexToNote(bassIdx + semitones, useFlats);
    }
  }
  return result;
}

/**
 * Calculate semitone offset between two keys.
 */
export function keyDistance(fromKey, toKey) {
  const fromIdx = noteToIndex(fromKey);
  const toIdx = noteToIndex(toKey);
  if (fromIdx < 0 || toIdx < 0) return 0;
  return ((toIdx - fromIdx) % 12 + 12) % 12;
}

/**
 * Detect the most likely key of a chart by tallying chord roots.
 * Heuristic: the most-frequent chord root is usually the tonic.
 */
export function detectKey(chordList) {
  if (!chordList.length) return 'C';
  const counts = {};
  for (const chord of chordList) {
    const parsed = parseChord(chord);
    if (!parsed) continue;
    counts[parsed.root] = (counts[parsed.root] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : 'C';
}
