/**
 * Centralized ad configuration for react-native-google-mobile-ads.
 *
 * Requires a development build — this module will NOT work in Expo Go.
 * Run `npx expo prebuild` then `npx expo run:ios` / `npx expo run:android`.
 *
 * Before shipping with real revenue:
 *   1. Create an AdMob account at admob.google.com
 *   2. Create app entries (iOS + Android) and grab the App IDs
 *   3. Replace the iosAppId / androidAppId in app.json
 *   4. Create banner + interstitial ad units per platform
 *   5. Replace PROD_AD_UNITS values below with your real unit IDs
 *
 * Until then, Google's official test IDs serve real ads but generate no revenue
 * — safe for dev / TestFlight / early App Store submissions.
 */

import { Platform } from 'react-native';

let BannerAd, BannerAdSize, InterstitialAd, AdEventType, MobileAds;
export let ADS_AVAILABLE = false;

try {
  const m = require('react-native-google-mobile-ads');
  BannerAd       = m.BannerAd;
  BannerAdSize   = m.BannerAdSize;
  InterstitialAd = m.InterstitialAd;
  AdEventType    = m.AdEventType;
  MobileAds      = m.default;
  ADS_AVAILABLE  = true;
} catch (_) {
  // Native module not linked — ads silently disabled (Expo Go)
}

export { BannerAd, BannerAdSize, InterstitialAd, AdEventType, MobileAds };

// Google's official test IDs — safe for development, generate no revenue
const TEST_IDS = {
  banner: Platform.select({
    ios:     'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
  }),
  interstitial: Platform.select({
    ios:     'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
  }),
};

// Replace these with real IDs from the AdMob console before releasing for revenue
const PROD_AD_UNITS = {
  banner: Platform.select({
    ios:     'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
  }),
  interstitial: Platform.select({
    ios:     'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
  }),
};

export const AD_UNITS = __DEV__ ? TEST_IDS : PROD_AD_UNITS;

export async function initAds() {
  if (!ADS_AVAILABLE) return;
  try {
    await MobileAds().initialize();
  } catch (e) {
    console.warn('[ads] init failed:', e);
  }
}
