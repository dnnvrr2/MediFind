import React from 'react';
import { Slot, router, usePathname } from 'expo-router';
import { View, Pressable, useWindowDimensions, ActivityIndicator, Text as NativeText } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { CartProvider, useCart } from '../state/cart';
import { CheckoutProvider } from '../state/checkout';
import { PrescriptionsProvider } from '../state/prescriptions';
import { ProfileProvider } from '../state/profile';
import { OrdersProvider } from '../state/orders';
import { colors, Text, s } from '../components/ui';
import { Icon, type IconName } from '../components/icon';
import { FontsReady } from '../components/typography';
import { useProfile } from '../state/profile';

function Shell() {
  const wide = useWindowDimensions().width >= 760;
  const pathname = usePathname();
  const { items } = useCart();
  const { ready: profileReady } = useProfile();
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const destinations: { path: '/' | '/prescriptions' | '/cart' | '/orders' | '/profile'; label: string; icon: IconName }[] = [
    { path: '/', label: 'Home', icon: 'home' }, { path: '/prescriptions', label: 'Prescriptions', icon: 'prescription' }, { path: '/cart', label: count ? `Cart (${count})` : 'Cart', icon: 'cart' }, { path: '/orders', label: 'Orders', icon: 'orders' }, { path: '/profile', label: 'Profile', icon: 'profile' },
  ];
  const nav = <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: wide ? 8 : 0, justifyContent: 'space-around' }}>{destinations.map(n => {
    const active = n.path === '/' ? pathname === '/' || pathname.startsWith('/search') || pathname.startsWith('/medicine') || pathname.startsWith('/availability') || pathname.startsWith('/pharmac') : n.path === '/prescriptions' ? pathname.startsWith('/prescriptions') : n.path === '/cart' ? pathname.startsWith('/cart') || pathname.startsWith('/checkout') : n.path === '/orders' ? pathname.startsWith('/orders') : pathname.startsWith('/profile') || pathname.startsWith('/account');
    return <Pressable key={n.path} accessibilityRole="tab" aria-selected={active} accessibilityState={{ selected: active }} onPress={() => router.navigate(n.path)}
      style={{ flex: wide ? undefined : 1, minHeight: wide ? 48 : 58, paddingHorizontal: wide ? 16 : 6, paddingVertical: 6, flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: wide ? 8 : 3, borderRadius: 8, backgroundColor: wide && active ? colors.pale : 'transparent' }}>
      <Icon name={n.icon} size={22} color={active ? colors.teal : colors.muted} />
      <Text style={{ color: active ? colors.teal : colors.muted, fontSize: wide ? 14 : 12, lineHeight: 18, fontWeight: active ? '600' : '500' }}>{n.label}</Text>
    </Pressable>;
  })}</View>;
  if (!profileReady) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.bg }}><ActivityIndicator accessibilityLabel="Restoring your account" color={colors.teal} /><NativeText style={{ color: colors.muted }}>Loading your account…</NativeText></View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
    <StatusBar style="dark" />
    <View style={{ backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.line }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: wide ? 14 : 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="MediFind home" onPress={() => router.navigate('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
          <Icon name="medicine" size={28} /><Text style={{ fontSize: 21, lineHeight: 28, fontWeight: '700', letterSpacing: -0.6 }}>MediFind</Text>
        </Pressable>{wide ? nav : <Text style={s.caption}>Customer preview</Text>}
      </View>
    </View>
    <View style={{ backgroundColor: '#EEF2EF', paddingVertical: 7, paddingHorizontal: 20 }}>
      <Text style={[s.caption, { textAlign: 'center', fontWeight: '400' }]}>Sample catalog · Prices and stock are examples · No real orders</Text>
    </View>
    <View style={{ flex: 1 }}><Slot /></View>
    {!wide && <View style={{ backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 3 }}>{nav}</View>}
  </SafeAreaView>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular: require('../../assets/fonts/Inter-Regular.ttf'),
    Inter_500Medium: require('../../assets/fonts/Inter-Medium.ttf'),
    Inter_600SemiBold: require('../../assets/fonts/Inter-SemiBold.ttf'),
    Inter_700Bold: require('../../assets/fonts/Inter-Bold.ttf'),
  });
  return <SafeAreaProvider><FontsReady.Provider value={loaded}><CartProvider><CheckoutProvider><ProfileProvider><PrescriptionsProvider><OrdersProvider>
    {!loaded && !error ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: colors.bg }}><ActivityIndicator accessibilityLabel="Loading fonts" color={colors.teal} /><NativeText>Loading MediFind…</NativeText></View> : <Shell />}
  </OrdersProvider></PrescriptionsProvider></ProfileProvider></CheckoutProvider></CartProvider></FontsReady.Provider></SafeAreaProvider>;
}
