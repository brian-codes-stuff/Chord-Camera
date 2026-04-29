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

// Real Chord Camera ad units (publisher ID 6177580188526680)
const PROD_AD_UNITS = {
  banner: Platform.select({
    ios:     'ca-app-pub-6177580188526680/6273019056',
    android: 'ca-app-pub-6177580188526680/5585474568',
  }),
  interstitial: Platform.select({
    ios:     'ca-app-pub-6177580188526680/5039828430',
    android: 'ca-app-pub-6177580188526680/4715246024',
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

// ── Interstitial helper ──────────────────────────────────────────────────
//
// Pre-loads an interstitial in the background so it's ready when we want
// to show it (Google's load → show pattern; showing without a loaded ad
// is a no-op). After every show, we eagerly load the next one.

let _interstitial = null;
let _loaded = false;

function ensureLoaded() {
  if (!ADS_AVAILABLE || !AD_UNITS.interstitial) return;
  if (_interstitial && _loaded) return;

  _interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
    requestNonPersonalizedAdsOnly: false,
  });

  const onLoaded = _interstitial.addAdEventListener(AdEventType.LOADED, () => {
    _loaded = true;
  });
  const onClosed = _interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    _loaded = false;
    _interstitial = null;
    onLoaded();
    onClosed();
    onError();
    // Pre-load the next one
    setTimeout(ensureLoaded, 250);
  });
  const onError = _interstitial.addAdEventListener(AdEventType.ERROR, (e) => {
    console.warn('[ads] interstitial error:', e?.message || e);
    _loaded = false;
    _interstitial = null;
  });

  try {
    _interstitial.load();
  } catch (e) {
    console.warn('[ads] interstitial load threw:', e);
  }
}

/**
 * Show an interstitial if one is ready. Safe to call any time — returns false
 * if not loaded yet (e.g., first call right after app launch).
 */
export function showInterstitial() {
  if (!ADS_AVAILABLE) return false;
  ensureLoaded();
  if (_interstitial && _loaded) {
    try {
      _interstitial.show();
      return true;
    } catch (e) {
      console.warn('[ads] interstitial show failed:', e);
    }
  }
  return false;
}

/**
 * Pre-warm the cache so the first show() lands an ad. Call once after init.
 */
export function preloadInterstitial() {
  if (!ADS_AVAILABLE) return;
  ensureLoaded();
}
