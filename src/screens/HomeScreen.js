import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, typography } from '../theme';
import { loadHistory, deleteChart } from '../services/storage';

function formatRelative(ts) {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HomeScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const items = await loadHistory();
    setHistory(items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleNewChart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Capture');
  };

  const handleOpenChart = (chart) => {
    Haptics.selectionAsync();
    navigation.navigate('Editor', { chartId: chart.id });
  };

  const handleDeleteChart = async (chart) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await deleteChart(chart.id);
    await refresh();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.appTitle}>Chord Camera</Text>
          <Text style={styles.appSubtitle}>Snap. Transpose. Play.</Text>
        </View>

        <TouchableOpacity
          style={styles.newButton}
          onPress={handleNewChart}
          activeOpacity={0.85}
        >
          <View style={styles.newButtonIcon}>
            <Text style={styles.newButtonIconText}>+</Text>
          </View>
          <View style={styles.newButtonText}>
            <Text style={styles.newButtonTitle}>New Chart</Text>
            <Text style={styles.newButtonSub}>Photo or photo library</Text>
          </View>
          <Text style={styles.newButtonArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.historyHeader}>
          <Text style={styles.historyLabel}>Recent</Text>
          {history.length > 0 && (
            <Text style={styles.historyCount}>{history.length}</Text>
          )}
        </View>

        {history.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎶</Text>
            <Text style={styles.emptyTitle}>No charts yet</Text>
            <Text style={styles.emptySub}>
              Tap "New Chart" to capture your first chord chart
            </Text>
          </View>
        ) : (
          history.map(chart => (
            <TouchableOpacity
              key={chart.id}
              style={styles.chartRow}
              onPress={() => handleOpenChart(chart)}
              onLongPress={() => handleDeleteChart(chart)}
              activeOpacity={0.7}
            >
              <View style={styles.chartKey}>
                <Text style={styles.chartKeyText}>{chart.originalKey}</Text>
              </View>
              <View style={styles.chartMeta}>
                <Text style={styles.chartTitle} numberOfLines={1}>
                  {chart.title}
                </Text>
                <Text style={styles.chartTime}>
                  {formatRelative(chart.updatedAt)}
                </Text>
              </View>
              <Text style={styles.chartArrow}>›</Text>
            </TouchableOpacity>
          ))
        )}

        {history.length > 0 && (
          <Text style={styles.hint}>Long-press a chart to delete</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginTop: spacing.md, marginBottom: spacing.xl },
  appTitle: { ...typography.display, color: colors.textPrimary },
  appSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderColor: colors.accent,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  newButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  newButtonIconText: {
    fontSize: 28,
    color: colors.accent,
    fontWeight: '300',
    lineHeight: 32,
  },
  newButtonText: { flex: 1 },
  newButtonTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  newButtonSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  newButtonArrow: {
    fontSize: 28,
    color: colors.accent,
    marginLeft: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  historyLabel: {
    ...typography.micro,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  historyCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderColor: colors.bgCardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chartKey: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  chartKeyText: {
    ...typography.heading,
    color: colors.accent,
  },
  chartMeta: { flex: 1 },
  chartTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  chartTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  chartArrow: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
