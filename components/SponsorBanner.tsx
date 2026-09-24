import React from 'react';
import { View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Heart } from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';

export default function SponsorBanner({ style }: { style?: any }) {
  const { settings } = useApp();

  if (settings?.hideSponsor) {
    return null;
  }

  return (
    <View style={[{ marginVertical: 12, padding: 12, backgroundColor: IDE.surface, borderRadius: 8, borderWidth: 1, borderColor: IDE.border }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Heart size={16} color={IDE.primary} style={{ marginRight: 8 }} />
        <Text style={{ color: IDE.text, fontWeight: '600', fontSize: 14 }}>Unterstütze EZdev!</Text>
      </View>
      <Text style={{ color: IDE.muted, fontSize: 13, marginBottom: 8, lineHeight: 18 }}>
        Eine kleine Unterstützung würde sehr gut tun! Schau doch mal bei unserem Sponsor-Programm vorbei oder kontaktiere uns unter EZdev-info@proton.me für Feedback und Ideen.
        Du kannst diese Nachricht in den Einstellungen verstecken, aber wir würden uns freuen, wenn du uns wenigstens einmal schreibst oder folgst!
      </Text>
      <View style={{ height: 32, width: 114, overflow: 'hidden', borderRadius: 6 }}>
        <WebView
          source={{ uri: 'https://github.com/sponsors/EZdev0/button' }}
          style={{ height: 32, width: 114, backgroundColor: 'transparent' }}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}
