import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Text, colors, s } from './ui';

export function ProfileLinks() {
  return <View style={{ gap: 4, paddingTop: 8 }}>
    {(['help', 'privacy', 'terms'] as const).map(page => <Pressable key={page} accessibilityRole="link" onPress={() => router.push(`/${page}`)}
      style={({ pressed }) => ({ minHeight: 48, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line, opacity: pressed ? 0.75 : 1 })}>
      <Text style={s.link}>{page[0].toUpperCase() + page.slice(1)}</Text>
    </Pressable>)}
  </View>;
}
