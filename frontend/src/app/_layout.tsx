import React, { useEffect } from 'react';
import { Slot, router, usePathname, useGlobalSearchParams } from 'expo-router';
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
import { LocationProvider } from '../state/location';
import { accountHome, pharmacyTabs, needsCustomer, navigationPortal } from '../domain/public-access';
import { PortalNavigation } from '../components/portal-navigation';
import { sessionGeneration } from '../api/client';
import { CatalogProvider } from '../state/catalog';

function Shell() {
  const wide = useWindowDimensions().width >= 760;
  const pathname = usePathname();
  const { tab: adminTab } = useGlobalSearchParams<{ tab?: string }>();
  const { items } = useCart();
  const { ready: profileReady, profile } = useProfile();
  const portal = navigationPortal(pathname, profile);
  const adminMode = portal === 'admin';
  const riderMode = portal === 'rider';
  const partnerMode = portal === 'partner';
  const guestMode = !profile;
  const restricted = !profile && pathname !== '/rider/login' && needsCustomer(pathname);
  useEffect(() => {
    if (profileReady && restricted) router.replace({ pathname: '/account/sign-in', params: { returnTo: pathname } });
  }, [profileReady, restricted, pathname]);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const customerDestinations: { path: '/home' | '/prescriptions' | '/cart' | '/orders' | '/profile'; label: string; icon: IconName }[] = [
    { path: '/home', label: 'Home', icon: 'home' }, { path: '/prescriptions', label: 'Prescriptions', icon: 'prescription' }, { path: '/cart', label: count ? `Cart (${count})` : 'Cart', icon: 'cart' }, { path: '/orders', label: 'Orders', icon: 'orders' }, { path: '/profile', label: 'Profile', icon: 'profile' },
  ];
  const riderDestinations: { path: '/rider' | '/rider/deliveries' | '/rider/history' | '/rider/profile'; label: string; icon: IconName }[] = [
    { path: '/rider', label: 'Today', icon: 'home' }, { path: '/rider/deliveries', label: 'Deliveries', icon: 'orders' }, { path: '/rider/history', label: 'History', icon: 'orders' }, { path: '/rider/profile', label: 'Profile', icon: 'profile' },
  ];
  const guestDestinations: { path: '/' | '/search' | '/pharmacies' | '/profile'; label: string; icon: IconName }[] = [
    { path: '/', label: 'Home', icon: 'home' }, { path: '/search', label: 'Search', icon: 'search' },
    { path: '/pharmacies', label: 'Pharmacies', icon: 'pharmacy' }, { path: '/profile', label: 'Login', icon: 'profile' },
  ];
  const destinations = riderMode ? riderDestinations : guestMode ? guestDestinations : customerDestinations;
  const adminDestinations: { key: string; label: string; icon: IconName }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home' },
    { key: 'pharmacies', label: 'Pharmacies', icon: 'pharmacy' },
    { key: 'catalog', label: 'Catalog', icon: 'medicine' },
    { key: 'profile', label: 'Profile', icon: 'profile' },
  ];
  const partnerDestinations = pharmacyTabs(profile?.pharmacyStatus === 'Approved');
  const selectedAdminTab = adminDestinations.some(item => item.key === adminTab) ? adminTab : 'dashboard';
  const nav = <PortalNavigation items={adminMode ? adminDestinations.map(item => ({
    ...item, active: selectedAdminTab === item.key,
    onPress: () => router.navigate({ pathname: '/admin', params: { tab: item.key } }),
  })) : partnerMode ? partnerDestinations.map(item => ({ ...item, active: (partnerDestinations.some(item => item.key === adminTab) ? adminTab : 'dashboard') === item.key, onPress: () => router.navigate({ pathname: '/partner', params: { tab: item.key } }) })) : destinations.map(n => {
    const active = !riderMode && guestMode ? (n.path === '/' ? pathname === '/' : n.path === '/search' ? ['/search', '/medicine', '/availability'].some(p => pathname.startsWith(p)) : n.path === '/pharmacies' ? pathname.startsWith('/pharmac') : pathname.startsWith('/profile') || pathname.startsWith('/account')) : riderMode ? (n.path === '/rider' ? pathname === '/rider' : pathname.startsWith(n.path)) : (n.path === '/home' ? pathname === '/home' || pathname.startsWith('/search') || pathname.startsWith('/medicine') || pathname.startsWith('/availability') || pathname.startsWith('/pharmac') : n.path === '/prescriptions' ? pathname.startsWith('/prescriptions') : n.path === '/cart' ? pathname.startsWith('/cart') || pathname.startsWith('/checkout') : n.path === '/orders' ? pathname.startsWith('/orders') : pathname.startsWith('/profile') || pathname.startsWith('/account'));
    return { key: n.path, label: n.label, icon: n.icon, active, onPress: () => router.navigate(n.path) };
  })} />;
  if (!profileReady) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.bg }}><ActivityIndicator accessibilityLabel="Restoring your account" color={colors.teal} /><NativeText style={{ color: colors.muted }}>Loading your account…</NativeText></View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
    <StatusBar style="dark" />
    <View style={{ backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.line }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: wide ? 14 : 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="MediFind home" onPress={() => router.navigate(accountHome(profile))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
          <Icon name="medicine" size={28} /><Text style={{ fontSize: 21, lineHeight: 28, fontWeight: '700', letterSpacing: -0.6 }}>MediFind</Text>
        </Pressable>{wide ? nav : <Text style={s.caption}>{partnerMode ? 'Pharmacy portal' : adminMode ? 'Staff portal' : riderMode ? 'Rider portal' : guestMode ? 'Browse medicines' : 'Customer preview'}</Text>}
      </View>
    </View>
    {!adminMode && !riderMode && !partnerMode && <View style={{ backgroundColor: '#EEF2EF', paddingVertical: 7, paddingHorizontal: 20 }}>
      <Text style={[s.caption, { textAlign: 'center', fontWeight: '400' }]}>Prototype - Sample listings are labeled - No online payments</Text>
    </View>}
    <View style={{ flex: 1, display: restricted ? 'none' : 'flex' }}><Slot /></View>
    {restricted && <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator accessibilityLabel="Opening sign in" color={colors.teal} /></View>}
    {!wide && <View style={{ backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 3 }}>{nav}</View>}
  </SafeAreaView>;
}

function AccountScope() {
  const { profile } = useProfile();
  return <CartProvider key={profile ? `${profile.id ?? profile.email}:${sessionGeneration()}` : 'guest'}><CheckoutProvider><PrescriptionsProvider><OrdersProvider><Shell /></OrdersProvider></PrescriptionsProvider></CheckoutProvider></CartProvider>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular: require('../../assets/fonts/Inter-Regular.ttf'),
    Inter_500Medium: require('../../assets/fonts/Inter-Medium.ttf'),
    Inter_600SemiBold: require('../../assets/fonts/Inter-SemiBold.ttf'),
    Inter_700Bold: require('../../assets/fonts/Inter-Bold.ttf'),
  });
  return <SafeAreaProvider><FontsReady.Provider value={loaded}><ProfileProvider><CatalogProvider><LocationProvider>
    {!loaded && !error ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: colors.bg }}><ActivityIndicator accessibilityLabel="Loading fonts" color={colors.teal} /><NativeText>Loading MediFind…</NativeText></View> : <AccountScope />}
  </LocationProvider></CatalogProvider></ProfileProvider></FontsReady.Provider></SafeAreaProvider>;
}
