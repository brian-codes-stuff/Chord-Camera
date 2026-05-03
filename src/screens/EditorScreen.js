import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, typography } from '../theme';
import { parseChart, transposeChart, extractChords } from '../services/chordParser';
import { detectKey, keyDistance, ALL_KEYS } from '../services/transposer';
import { saveChart, getChart, incrementSaveCount } from '../services/storage';
import { showInterstitial } from '../services/ads.native';
import Banner from '../components/Banner';

const INTERSTITIAL_EVERY_N_SAVES = 4;

const MONO_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

function ChordLine({ line }) {
  if (line.type === 'section') {
    return (
      <Text style={styles.sectionLine}>[{line.text}]</Text>
    );
  }
  if (line.type === 'blank') {
    return <Text style={styles.blankLine}> </Text>;
  }
  if (line.type === 'chord') {
    return <Text style={[styles.line, styles.chordLine]}>{line.text}</Text>;
  }
  return <Text style={[styles.line, styles.lyricLine]}>{line.text}</Text>;
}

export default function EditorScreen({ route, navigation }) {
  const { rawText: initialText, chartId, sourceUri } = route.params || {};

  const [title, setTitle] = useState('Untitled');
  const [originalText, setOriginalText] = useState(initialText || '');
  const [editing, setEditing] = useState(false);
  const [originalKey, setOriginalKey] = useState('C');
  const [targetKey, setTargetKey] = useState('C');
  const [savedId, setSavedId] = useState(chartId || null);

  // Hydrate from saved chart if opening from history
  useEffect(() => {
    if (!chartId) return;
    (async () => {
      const chart = await getChart(chartId);
      if (chart) {
        setTitle(chart.title);
        setOriginalText(chart.text);
        setOriginalKey(chart.originalKey);
        setTargetKey(chart.originalKey);
      }
    })();
  }, [chartId]);

  // Detect original key and title on first load
  useEffect(() => {
    if (chartId) return; // already-saved charts have their key
    if (!originalText) return;
    const parsed = parseChart(originalText);
    const chords = extractChords(parsed);
    const detected = detectKey(chords);
    setOriginalKey(detected);
    setTargetKey(detected);
    // Use the first non-empty, non-section, non-chord line as the title
    const firstLine = originalText
      .split('\n')
      .map(l => l.trim())
      .find(l => l && !l.startsWith('['));
    if (firstLine) setTitle(firstLine);
  }, [originalText, chartId]);

  const parsed = useMemo(() => parseChart(originalText), [originalText]);

  const transposed = useMemo(() => {
    const semitones = keyDistance(originalKey, targetKey);
    return transposeChart(parsed, semitones, targetKey);
  }, [parsed, originalKey, targetKey]);

  const handleKeyChange = (key) => {
    Haptics.selectionAsync();
    setTargetKey(key);
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const entry = await saveChart({
      id: savedId,
      title: title.trim() || 'Untitled',
      originalKey,
      text: originalText,
    });
    setSavedId(entry.id);

    // Fire an interstitial every Nth save (skip the first, only show on subsequent
    // saves so we never block the very first delight moment)
    const newSaveOnly = !savedId;
    if (newSaveOnly) {
      const count = await incrementSaveCount();
      if (count > 1 && count % INTERSTITIAL_EVERY_N_SAVES === 0) {
        setTimeout(() => showInterstitial(), 400);
      }
    }

    Alert.alert('Saved', `"${entry.title}" saved to your library.`);
  };

  const handleClose = () => {
    if (!savedId && originalText) {
      Alert.alert(
        'Discard chart?',
        'You haven\'t saved this chart yet.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.popToTop() },
          { text: 'Save', onPress: async () => { await handleSave(); navigation.popToTop(); } },
        ],
      );
    } else {
      navigation.popToTop();
    }
  };

  const semitones = keyDistance(originalKey, targetKey);
  const isTransposed = semitones !== 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} hitSlop={12}>
          <Text style={styles.headerAction}>Done</Text>
        </TouchableOpacity>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={styles.titleInput}
          placeholder="Chart title"
          placeholderTextColor={colors.textMuted}
          textAlign="center"
          returnKeyType="done"
        />
        <TouchableOpacity onPress={handleSave} hitSlop={12}>
          <Text style={[styles.headerAction, { color: colors.accent }]}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Key strip — scrollable target key pills */}
      <View style={styles.keyStrip}>
        <Text style={styles.keyLabel}>KEY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.keyPicker}
        >
          {ALL_KEYS.map(key => {
            const active = key === targetKey;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.keyPill, active && styles.keyPillActive]}
                onPress={() => handleKeyChange(key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.keyPillText,
                    active && styles.keyPillTextActive,
                  ]}
                >
                  {key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Edit toggle */}
      <View style={styles.editToggleRow}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setEditing(e => !e);
          }}
          hitSlop={12}
        >
          <Text style={styles.editToggleText}>
            {editing ? '✓ Done editing' : '✎ Edit chart'}
          </Text>
        </TouchableOpacity>
        {editing && (
          <Text style={styles.editHint}>
            Fix any OCR mistakes — chord changes apply when you switch back
          </Text>
        )}
      </View>

      {/* Chart display — view mode or edit mode */}
      {editing ? (
        <TextInput
          style={styles.editorTextInput}
          value={originalText}
          onChangeText={setOriginalText}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />
      ) : (
      <ScrollView
        style={styles.chartScroll}
        contentContainerStyle={styles.chartContent}
        horizontal={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chartInner}>
            {transposed.length === 0 ? (
              <Text style={styles.placeholder}>
                No chart text yet. Capture a chord chart to begin.
              </Text>
            ) : (
              transposed.map((line, i) => (
                <ChordLine key={i} line={line} />
              ))
            )}
          </View>
        </ScrollView>
      </ScrollView>
      )}
      <Banner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.bgCardBorder,
    borderBottomWidth: 1,
  },
  headerAction: {
    ...typography.body,
    color: colors.textSecondary,
    minWidth: 50,
  },
  titleInput: {
    flex: 1,
    ...typography.heading,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  keyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderBottomColor: colors.bgCardBorder,
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingLeft: spacing.md,
  },
  keyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginRight: spacing.sm,
    minWidth: 28,
  },
  keyPicker: {
    paddingRight: spacing.md,
    alignItems: 'center',
  },
  keyPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bgCardElevated,
    marginRight: 6,
    minWidth: 38,
    alignItems: 'center',
  },
  keyPillActive: {
    backgroundColor: colors.accent,
  },
  keyPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  keyPillTextActive: {
    color: '#0A0E1A',
  },
  chartScroll: { flex: 1 },
  chartContent: { flexGrow: 1 },
  chartInner: {
    padding: spacing.lg,
    minHeight: '100%',
  },
  line: {
    fontFamily: MONO_FONT,
    fontSize: 15,
    lineHeight: 22,
  },
  chordLine: {
    color: colors.chord,
    fontWeight: '700',
  },
  lyricLine: {
    color: colors.lyric,
  },
  sectionLine: {
    fontFamily: MONO_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentLight,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blankLine: {
    fontFamily: MONO_FONT,
    fontSize: 15,
    lineHeight: 22,
  },
  editToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderBottomColor: colors.bgCardBorder,
    borderBottomWidth: 1,
  },
  editToggleText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  editHint: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },
  editorTextInput: {
    flex: 1,
    fontFamily: MONO_FONT,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
  },
  placeholder: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: spacing.xxl,
  },
});
