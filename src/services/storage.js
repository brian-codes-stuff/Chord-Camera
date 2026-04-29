import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@chord_camera/history';
const MAX_HISTORY = 50;

export async function loadHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[storage] loadHistory failed:', e);
    return [];
  }
}

export async function saveChart(chart) {
  const history = await loadHistory();
  const entry = {
    id: chart.id || `chart_${Date.now()}`,
    title: chart.title || 'Untitled',
    originalKey: chart.originalKey,
    text: chart.text,
    createdAt: chart.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  const filtered = history.filter(h => h.id !== entry.id);
  const next = [entry, ...filtered].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return entry;
}

export async function deleteChart(id) {
  const history = await loadHistory();
  const next = history.filter(h => h.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export async function getChart(id) {
  const history = await loadHistory();
  return history.find(h => h.id === id) || null;
}
