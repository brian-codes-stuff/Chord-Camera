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
 * Recognize text from a local image URI. Returns the extracted text as a string.
 * Falls back to sample text in environments without the native module.
 */
export async function recognizeText(imageUri) {
  if (!OCR_AVAILABLE) {
    // Demo fallback for Expo Go / web
    await new Promise(r => setTimeout(r, 600));
    return { text: SAMPLE_CHART, blocks: [] };
  }

  try {
    const result = await TextRecognition.recognize(imageUri);
    // ML Kit returns blocks with text + frame; we use the joined text directly
    // since the chord parser handles column positions from spacing.
    return {
      text: result.text || '',
      blocks: result.blocks || [],
    };
  } catch (e) {
    console.warn('[ocr] failed:', e);
    throw new Error('Could not read text from this image. Try a clearer photo.');
  }
}

export const SAMPLE_CHART_TEXT = SAMPLE_CHART;
