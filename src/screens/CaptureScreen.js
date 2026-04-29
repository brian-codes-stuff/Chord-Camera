import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, typography } from '../theme';
import { recognizeText, OCR_AVAILABLE } from '../services/ocr';

export default function CaptureScreen({ navigation }) {
  const [busy, setBusy] = useState(false);

  const handleResult = async (result) => {
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setBusy(true);
    try {
      const { text } = await recognizeText(asset.uri);
      if (!text || !text.trim()) {
        Alert.alert(
          'No text found',
          'We couldn\'t read any text from that photo. Try a clearer, well-lit shot.',
        );
        setBusy(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('Editor', {
        rawText: text,
        sourceUri: asset.uri,
      });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not read photo', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera permission needed',
        'Please enable camera access in Settings to capture chord charts.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
    });
    await handleResult(result);
  };

  const handleLibrary = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo library permission needed',
        'Please enable photo access in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsEditing: false,
    });
    await handleResult(result);
  };

  const handleDemo = async () => {
    Haptics.selectionAsync();
    setBusy(true);
    const { text } = await recognizeText(null);
    setBusy(false);
    navigation.replace('Editor', { rawText: text });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Chart</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        {busy ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Reading chord chart…</Text>
          </View>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>📷</Text>
            </View>
            <Text style={styles.heading}>Capture a chord chart</Text>
            <Text style={styles.sub}>
              Take a photo or pick from your library. Works best with clean,
              well-lit prints.
            </Text>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleCamera}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleLibrary}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Choose from Library</Text>
            </TouchableOpacity>

            {!OCR_AVAILABLE && (
              <TouchableOpacity
                style={styles.demoButton}
                onPress={handleDemo}
                activeOpacity={0.7}
              >
                <Text style={styles.demoText}>
                  Try with a sample chart →
                </Text>
                <Text style={styles.demoSub}>
                  (OCR requires a development build)
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
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
  },
  cancel: { ...typography.body, color: colors.accent },
  title: { ...typography.heading, color: colors.textPrimary },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bgCard,
    borderColor: colors.bgCardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconText: { fontSize: 44 },
  heading: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    ...typography.heading,
    color: '#0A0E1A',
  },
  secondaryButton: {
    backgroundColor: colors.bgCard,
    borderColor: colors.bgCardBorder,
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  demoButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  demoText: { ...typography.body, color: colors.accent },
  demoSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  loading: { alignItems: 'center' },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
