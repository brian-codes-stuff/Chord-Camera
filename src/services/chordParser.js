/**
 * Parse a chord chart from raw text into structured lines.
 *
 * Each line is classified as:
 *   - 'chord'   — line is mostly chords, with column positions tracked
 *   - 'lyric'   — regular lyrics
 *   - 'section' — [Verse], [Chorus], etc.
 *   - 'blank'   — empty
 */

import { isChord, parseChord, transposeChord } from './transposer';

const SECTION_REGEX = /^\s*\[([^\]]+)\]\s*$/;
const SECTION_KEYWORD_REGEX =
  /^\s*((?:pre[-\s]?)?(?:verse|chorus|bridge|intro|outro|interlude|tag|coda|refrain|ending|hook|solo|instrumental|breakdown|vamp|turnaround|prechorus)(?:\s*\d+)?)\s*:?\s*$/i;

// Metadata header lines (chart info, not chords) — leave as plain lyric so the
// chord roots in them ("G" in "Key - G") don't get transposed.
const METADATA_REGEX =
  /\b(key|tempo|bpm|time|time\s*signature|capo|ccli|songselect|copyright|©|\(c\)|words?\s*(?:&|and)\s*music|arr\.?|arrangement|recorded\s+by|based\s+on)\b/i;

// Logo / brand strings worth skipping outright (often OCR'd from the chart header)
const BRAND_REGEX = /\b(songselect|ccli|onsong|chordpro|planning\s*center|propresenter)\b/i;


/**
 * Classify and parse a single line.
 */
function classifyLine(line) {
  if (!line.trim()) return { type: 'blank', text: '' };

  const sectionMatch = line.match(SECTION_REGEX);
  if (sectionMatch) return { type: 'section', text: sectionMatch[1].trim() };

  const keywordMatch = line.match(SECTION_KEYWORD_REGEX);
  if (keywordMatch) return { type: 'section', text: keywordMatch[1].trim() };

  // Metadata / brand / copyright headers — never transpose
  if (METADATA_REGEX.test(line) || BRAND_REGEX.test(line)) {
    return { type: 'lyric', text: line };
  }

  // Find all whitespace-separated tokens with their column positions
  const tokens = [];
  const tokenRegex = /\S+/g;
  let match;
  while ((match = tokenRegex.exec(line)) !== null) {
    tokens.push({ text: match[0], col: match.index });
  }

  if (!tokens.length) return { type: 'blank', text: '' };

  // Classify as chord line if >=60% of tokens parse as chords. (Metadata
  // and brand headers are caught earlier, so a stray "G" in "Key - G" never
  // reaches this code path.)
  const chordTokens = tokens.filter(t => isChord(t.text));
  const ratio = chordTokens.length / tokens.length;

  if (ratio >= 0.6) {
    return {
      type: 'chord',
      text: line,
      chords: tokens.map(t => ({
        chord: t.text,
        col: t.col,
        isChord: isChord(t.text),
      })),
    };
  }

  return { type: 'lyric', text: line };
}

export function parseChart(rawText) {
  const lines = rawText.split('\n').map(classifyLine);
  return lines;
}

/**
 * Re-render a chord line after transposition, preserving approximate column positions.
 */
function renderChordLine(chords, semitones, targetKey) {
  let result = '';
  for (const { chord, col, isChord: validChord } of chords) {
    const newChord = validChord ? transposeChord(chord, semitones, targetKey) : chord;
    if (col > result.length) {
      result += ' '.repeat(col - result.length);
    }
    result += newChord + ' ';
  }
  return result.replace(/\s+$/, '');
}

/**
 * Transpose every chord in a parsed chart by the given number of semitones.
 */
export function transposeChart(parsedLines, semitones, targetKey) {
  return parsedLines.map(line => {
    if (line.type === 'chord') {
      return {
        ...line,
        text: renderChordLine(line.chords, semitones, targetKey),
        chords: line.chords.map(c => ({
          ...c,
          chord: c.isChord ? transposeChord(c.chord, semitones, targetKey) : c.chord,
        })),
      };
    }
    return line;
  });
}

/**
 * Extract all unique chord tokens from a parsed chart (for key detection).
 */
export function extractChords(parsedLines) {
  const chords = [];
  for (const line of parsedLines) {
    if (line.type === 'chord') {
      for (const c of line.chords) {
        if (c.isChord) chords.push(c.chord);
      }
    }
  }
  return chords;
}
