import React from 'react';
import { View, StyleSheet } from 'react-native';

import { ADS_AVAILABLE, BannerAd, BannerAdSize, AD_UNITS } from '../services/ads.native';
import { colors } from '../theme';

/**
 * AdMob banner. Renders nothing in Expo Go or on web (ADS_AVAILABLE = false).
 */
export default function Banner({ size = 'ANCHORED_ADAPTIVE_BANNER' }) {
  if (!ADS_AVAILABLE || !AD_UNITS.banner) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize[size] || BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderTopColor: colors.bgCardBorder,
    borderTopWidth: 1,
  },
});
