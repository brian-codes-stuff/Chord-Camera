import { Platform, AppState } from 'react-native';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';

// iPadOS / iOS silently *denies* ATT if you call it before the scene is
// fully active. The prompt then never appears, the OS sets the status to
// "denied" forever, and Apple's reviewer rejects with "we are unable to
// locate the App Tracking Transparency permission request."
//
// We gate the request on AppState === 'active' plus a short delay so the
// system has actually finished presenting our root scene.
function waitForActive() {
  return new Promise((resolve) => {
    const settle = () => setTimeout(resolve, 500);
    if (AppState.currentState === 'active') return settle();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        settle();
      }
    });
  });
}

export async function requestTrackingPermission() {
  if (Platform.OS !== 'ios') return 'granted';
  try {
    const existing = await getTrackingPermissionsAsync();
    if (existing.status !== 'undetermined') return existing.status;
    await waitForActive();
    const result = await requestTrackingPermissionsAsync();
    return result.status;
  } catch {
    return 'unavailable';
  }
}
