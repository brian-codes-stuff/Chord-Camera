# Chord Camera

Snap a photo of a chord chart, instantly transpose it to any key.

Built for worship leaders, guitarists, and anyone who plays from chord charts.
Default OCR is fully on-device, with optional secure Gemini proxy OCR for harder photos.

## Features

- **Camera + Photo Library capture** — read printed chord charts via on-device OCR (Apple Vision on iOS, ML Kit on Android)
- **Optional Gemini proxy OCR mode** — cloud OCR option for difficult photos and messy layouts
- **Auto key detection** — guesses the original key from the chord usage
- **One-tap transposition** — pick any of 14 keys, instantly re-rendered
- **Smart accidentals** — sharp keys use sharps, flat keys use flats
- **Slash chord support** — `G/B`, `D/F#`, etc. transpose correctly
- **Local history** — saved charts stay on your device
- **Modern dark UI** — easy to read on stage

## Stack

- Expo / React Native (JavaScript)
- `@react-native-ml-kit/text-recognition` — on-device OCR
- `expo-file-system` — image base64 conversion for optional proxy OCR
- `expo-image-picker` — camera + library access
- `@react-navigation/native-stack` — navigation
- `@react-native-async-storage/async-storage` — local persistence

## Getting started

```bash
npm install
npx expo prebuild      # generate native iOS/Android projects
npx expo run:ios       # or run:android
```

The app will not work in Expo Go — OCR requires a development build. There's a "Try with sample chart" button in Expo Go for testing the parser/transposer without OCR.

## Optional: Secure Gemini OCR Proxy

If chart quality is poor with on-device OCR, run the included backend proxy.

1. Install backend dependencies:

```bash
npm --prefix backend install
```

2. Configure server secrets:

```bash
copy backend\\.env.example backend\\.env
```

Set `GEMINI_API_KEY` in `backend/.env`.

3. Start backend:

```bash
npm run api
```

4. In the app terminal, set client env vars before `npm run android` or `npm run ios`:

```bash
EXPO_PUBLIC_OCR_ENGINE=auto
EXPO_PUBLIC_OCR_BACKEND_URL=http://<your-backend-ip>:8787
```

Engine values:

- `auto` (default): try proxy first when configured, then fall back to device OCR
- `proxy`: force backend proxy OCR only
- `device`: force on-device OCR only

For Android emulator, backend URL is usually `http://10.0.2.2:8787`.
For physical devices, use your computer's LAN IP.

## Project structure

```
src/
  screens/
    HomeScreen.js        — chart history + new chart CTA
    CaptureScreen.js     — camera / library picker
    EditorScreen.js      — chart display + key picker
  services/
    ocr.js               — ML Kit wrapper with Expo Go fallback
    chordParser.js       — line classification + chart transposition
    transposer.js        — chord parsing + semitone math
    storage.js           — AsyncStorage wrapper
  theme.js               — colors, spacing, typography
```

## Roadmap

- [ ] Edit / correct OCR mistakes inline
- [ ] Export chart as PDF or share to other apps
- [ ] Capo helper (target key + capo position)
- [ ] Setlists
- [ ] iCloud / Drive sync
