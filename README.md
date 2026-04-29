# Chord Camera

Snap a photo of a chord chart, instantly transpose it to any key.

Built for worship leaders, guitarists, and anyone who plays from chord charts.
100% on-device — no cloud, no AI service, no subscriptions.

## Features

- **Camera + Photo Library capture** — read printed chord charts via on-device OCR (Apple Vision on iOS, ML Kit on Android)
- **Auto key detection** — guesses the original key from the chord usage
- **One-tap transposition** — pick any of 14 keys, instantly re-rendered
- **Smart accidentals** — sharp keys use sharps, flat keys use flats
- **Slash chord support** — `G/B`, `D/F#`, etc. transpose correctly
- **Local history** — saved charts stay on your device
- **Modern dark UI** — easy to read on stage

## Stack

- Expo / React Native (JavaScript)
- `@react-native-ml-kit/text-recognition` — on-device OCR
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
