import React, { useEffect, useState } from 'react';
import { Slot, router, usePathname, useGlobalSearchParams } from 'expo-router';
import { View, Pressable, Image, Platform, useWindowDimensions, ActivityIndicator, Text as NativeText } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { CartProvider, useCart } from '../state/cart';
import { CheckoutProvider } from '../state/checkout';
import { PrescriptionsProvider } from '../state/prescriptions';
import { ProfileProvider } from '../state/profile';
import { OrdersProvider } from '../state/orders';
import { colors, Text, s } from '../components/ui';
import type { IconName } from '../components/icon';
import { FontsReady } from '../components/typography';
import { useProfile } from '../state/profile';
import { LocationProvider } from '../state/location';
import { accountHome, pharmacyTabs, needsCustomer, navigationPortal } from '../domain/public-access';
import { PortalNavigation } from '../components/portal-navigation';
import { api, sessionGeneration } from '../api/client';
import { CatalogProvider } from '../state/catalog';
import { useOrders } from '../state/orders';
import { usePrescriptions } from '../state/prescriptions';
import { isCurrentOrder } from '../domain/orders';
import { readPortalRequests, savePortalRequests, type ReadPortalRequests } from '../state/portal-notifications';

function Shell() {
  const wide = useWindowDimensions().width >= 760;
  const pathname = usePathname();
  const { tab: adminTab } = useGlobalSearchParams<{ tab?: string }>();
  const { items } = useCart();
  const { orders: customerOrders } = useOrders();
  const { records: customerPrescriptions } = usePrescriptions();
  const { ready: profileReady, profile } = useProfile();
  const [portalRequests, setPortalRequests] = useState<ReadPortalRequests>({});
  const accountKey = profile ? String(profile.id ?? profile.email) : '';
  const readKey = accountKey ? `medifind.portal-reads.v1.${encodeURIComponent(accountKey)}` : '';
  const [seenState, setSeenState] = useState<{ account: string; requests: ReadPortalRequests }>({ account: '', requests: {} });
  const seenRequests = seenState.account === accountKey ? seenState.requests : {};
  const portal = navigationPortal(pathname, profile);
  const adminMode = portal === 'admin';
  const riderMode = portal === 'rider';
  const partnerMode = portal === 'partner';
  const guestMode = !profile;
  const profileLabel = profile?.firstName ? `Hi, ${profile.firstName}` : 'Profile';
  const pharmacyPath = /^\/pharmac(?:ies|y)(?:\/|$)/.test(pathname);
  const desktopHeader = Platform.OS === 'web' && wide;
  const portalLabel = adminMode ? 'Admin portal' : partnerMode ? 'Pharmacy portal' : riderMode ? 'Rider portal' : null;
  const restricted = !profile && pathname !== '/rider/login' && needsCustomer(pathname);
  useEffect(() => { setSeenState({ account: accountKey, requests: readKey ? readPortalRequests(readKey) : {} }); }, [accountKey, readKey]);
  useEffect(() => {
    let live = true;
    setPortalRequests({});
    const refresh = async () => {
      if (!profile) return;
      try {
        if (portal === 'partner' && profile.pharmacyStatus === 'Approved') {
          const [orders, prescriptions, medicines] = await Promise.allSettled([api.pharmacyOrders(), api.pharmacyPrescriptions(), api.pharmacyMedicines()]);
          if (!live) return;
          if ([orders, prescriptions, medicines].some(result => result.status === 'rejected')) return;
          const orderIds = orders.status === 'fulfilled' ? orders.value.filter(order => order.data.status === 'awaiting_confirmation').map(order => `${order.id}:${order.version}`) : [];
          const prescriptionIds = prescriptions.status === 'fulfilled' ? prescriptions.value.filter(request => request.status === 'pending').map(request => `${request.id}:${request.version}`) : [];
          const inventoryIds = medicines.status === 'fulfilled' ? medicines.value.filter(request => request.status === 'Pending').map(request => `${request.id}:${request.version}`) : [];
          setPortalRequests({ orders: orderIds, prescriptions: prescriptionIds, inventory: inventoryIds, dashboard: [...orderIds.map(id => `orders:${id}`), ...prescriptionIds.map(id => `prescriptions:${id}`), ...inventoryIds.map(id => `inventory:${id}`)] });
        } else if (portal === 'admin' && profile.isStaff) {
          const [pharmacies, catalog, riders] = await Promise.allSettled([api.adminPharmacies(), api.adminMedicines(), api.adminRiderApplications()]);
          if (!live) return;
          if ([pharmacies, catalog, riders].some(result => result.status === 'rejected')) return;
          const pharmacyIds = pharmacies.status === 'fulfilled' ? pharmacies.value.filter(request => ['Pending', 'Needs Info'].includes(request.status)).map(request => `${request.id}:${request.version}`) : [];
          const catalogIds = catalog.status === 'fulfilled' ? catalog.value.filter(request => request.status === 'Pending').map(request => `${request.id}:${request.version}`) : [];
          const riderIds = riders.status === 'fulfilled' ? riders.value.filter(request => request.status === 'Pending').map(request => `${request.id}:${request.version}`) : [];
          setPortalRequests({ pharmacies: pharmacyIds, catalog: catalogIds, riders: riderIds, dashboard: [...pharmacyIds.map(id => `pharmacies:${id}`), ...catalogIds.map(id => `catalog:${id}`), ...riderIds.map(id => `riders:${id}`)] });
        } else if (portal === 'rider' && profile.isRider) {
          const deliveries = await api.riderDeliveries();
          if (!live) return;
          setPortalRequests({ '/rider/deliveries': deliveries.filter(delivery => delivery.status === 'offered').map(delivery => `${delivery.id}:${delivery.updated_at}`) });
        }
      } catch { /* Keep navigation usable if a portal count cannot refresh. */ }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    return () => { live = false; clearInterval(timer); };
  }, [portal, profile?.email, profile?.pharmacyStatus, profile?.isStaff, profile?.isRider]);
  useEffect(() => {
    if (profileReady && restricted) router.replace({ pathname: '/account/sign-in', params: { returnTo: pathname } });
  }, [profileReady, restricted, pathname]);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const customerDestinations: { path: '/home' | '/pharmacies' | '/prescriptions' | '/cart' | '/orders' | '/profile'; label: string; icon: IconName }[] = [
    { path: '/home', label: 'Home', icon: 'home' }, { path: '/pharmacies', label: 'Pharmacies', icon: 'pharmacy' }, { path: '/prescriptions', label: 'Prescriptions', icon: 'prescription' }, { path: '/cart', label: count ? `Cart (${count})` : 'Cart', icon: 'cart' }, { path: '/orders', label: 'Orders', icon: 'orders' }, { path: '/profile', label: profileLabel, icon: 'profile' },
  ];
  const riderDestinations: { path: '/rider' | '/rider/apply' | '/rider/deliveries' | '/rider/history' | '/rider/profile' | '/profile'; label: string; icon: IconName }[] = profile?.isRider ? [
    { path: '/rider', label: 'Today', icon: 'home' }, { path: '/rider/deliveries', label: 'Deliveries', icon: 'orders' }, { path: '/rider/history', label: 'History', icon: 'orders' }, { path: '/rider/profile', label: profileLabel, icon: 'profile' },
  ] : [{ path: '/rider/apply', label: 'Application', icon: 'home' }, { path: '/profile', label: profileLabel, icon: 'profile' }];
  const guestDestinations: { path: '/' | '/search' | '/pharmacies' | '/profile'; label: string; icon: IconName }[] = [
    { path: '/', label: 'Home', icon: 'home' }, { path: '/search', label: 'Search', icon: 'search' },
    { path: '/pharmacies', label: 'Pharmacies', icon: 'pharmacy' }, { path: '/profile', label: 'Login', icon: 'profile' },
  ];
  const destinations = riderMode ? riderDestinations : guestMode ? guestDestinations : customerDestinations;
  const adminDestinations: { key: string; label: string; icon: IconName }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home' },
    { key: 'pharmacies', label: 'Pharmacies', icon: 'pharmacy' },
    { key: 'catalog', label: 'Catalog', icon: 'medicine' },
    { key: 'riders', label: 'Riders', icon: 'profile' },
    { key: 'profile', label: profileLabel, icon: 'profile' },
  ];
  const partnerDestinations = pharmacyTabs(profile?.pharmacyStatus === 'Approved');
  const selectedAdminTab = adminDestinations.some(item => item.key === adminTab) ? adminTab : 'dashboard';
  const customerRequests: ReadPortalRequests = {
    '/orders': customerOrders.filter(isCurrentOrder).map(order => `${order.id}:${order.status}:${order.updatedAt}`),
    '/prescriptions': customerPrescriptions.filter(record => record.status === 'pending').map(record => `${record.id}:${record.revision}:${record.updatedAt}`),
  };
  const allRequests = { ...portalRequests, ...customerRequests };
  const unreadCount = (key: string) => {
    const seen = new Set(seenRequests[key] || []);
    return (allRequests[key] || []).filter(id => !seen.has(id)).length;
  };
  const markRequestsSeen = (key: string) => {
    if (!readKey) return;
    const current = allRequests[key] || [];
    if (!current.length) return;
    const previous = seenRequests[key] || [];
    const combined = [...new Set([...previous, ...current])].slice(-500);
    if (combined.length === previous.length && combined.every((id, index) => id === previous[index])) return;
    const requests = { ...seenRequests, [key]: combined };
    setSeenState({ account: accountKey, requests });
    savePortalRequests(readKey, requests);
  };
  const activeRequestTab = adminMode ? selectedAdminTab : partnerMode ? (partnerDestinations.some(item => item.key === adminTab) ? adminTab : 'dashboard') : riderMode ? (pathname.startsWith('/rider/deliveries') || pathname.startsWith('/rider/delivery/') ? '/rider/deliveries' : '') : pathname.startsWith('/orders') ? '/orders' : pathname.startsWith('/prescriptions') ? '/prescriptions' : '';
  useEffect(() => { if (activeRequestTab) markRequestsSeen(activeRequestTab); }, [activeRequestTab, portalRequests, customerOrders, customerPrescriptions, seenRequests, readKey]);
  const nav = <PortalNavigation items={adminMode ? adminDestinations.map(item => ({
    ...item, active: selectedAdminTab === item.key,
    badge: unreadCount(item.key),
    onPress: () => { markRequestsSeen(item.key); router.navigate({ pathname: '/admin', params: { tab: item.key } }); },
  })) : partnerMode ? partnerDestinations.map(item => ({ ...item, label: item.key === 'profile' ? profileLabel : item.label, active: (partnerDestinations.some(item => item.key === adminTab) ? adminTab : 'dashboard') === item.key, badge: unreadCount(item.key), onPress: () => { markRequestsSeen(item.key); router.navigate({ pathname: '/partner', params: { tab: item.key } }); } })) : destinations.map(n => {
    const active = !riderMode && guestMode ? (n.path === '/' ? pathname === '/' : n.path === '/search' ? ['/search', '/medicine', '/availability'].some(p => pathname.startsWith(p)) : n.path === '/pharmacies' ? pharmacyPath : pathname.startsWith('/profile') || pathname.startsWith('/account')) : riderMode ? (n.path === '/rider' ? pathname === '/rider' : pathname.startsWith(n.path)) : (n.path === '/home' ? pathname === '/home' || pathname.startsWith('/search') || pathname.startsWith('/medicine') || pathname.startsWith('/availability') : n.path === '/pharmacies' ? pharmacyPath : n.path === '/prescriptions' ? pathname.startsWith('/prescriptions') : n.path === '/cart' ? pathname.startsWith('/cart') || pathname.startsWith('/checkout') : n.path === '/orders' ? pathname.startsWith('/orders') : pathname.startsWith('/profile') || pathname.startsWith('/account'));
    const key = n.path;
    const badge = unreadCount(key);
    return { key: n.path, label: n.label, icon: n.icon, active, badge, onPress: () => { markRequestsSeen(key); router.navigate(n.path); } };
  })} />;
  if (!profileReady) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.bg }}><ActivityIndicator accessibilityLabel="Restoring your account" color={colors.teal} /><NativeText style={{ color: colors.muted }}>Loading your account…</NativeText></View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
    <StatusBar style="dark" />
    <View style={{ backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.line }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: wide ? 14 : 12, flexDirection: 'row', flexWrap: desktopHeader ? 'wrap' : 'nowrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={desktopHeader && portalLabel ? `MediFind ${portalLabel} home` : 'MediFind home'} onPress={() => router.navigate(accountHome(profile))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
          <Image source={require('../../assets/brand/mark.png')} style={{ width: 28, height: 28 }} />
          <Text style={{ fontSize: 21, lineHeight: 28, fontWeight: '700', letterSpacing: -0.6, color: colors.dark }}>MediFind</Text>
          {desktopHeader && portalLabel && <View style={{ backgroundColor: colors.pale, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 }}><Text style={[s.caption, { color: colors.teal }]}>{portalLabel}</Text></View>}
        </Pressable>{wide ? nav : (partnerMode || adminMode || riderMode) && <Text style={s.caption}>{partnerMode ? 'Pharmacy portal' : adminMode ? 'Staff portal' : riderMode ? 'Rider portal' : null}</Text>}
      </View>
    </View>
    <View style={{ flex: 1, display: restricted ? 'none' : 'flex' }}><Slot /></View>
    {restricted && <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator accessibilityLabel="Opening sign in" color={colors.teal} /></View>}
    {!wide && <View style={{ backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 3 }}>{nav}</View>}
  </SafeAreaView>;
}

function AccountScope() {
  const { profile } = useProfile();
  return <CartProvider key={profile ? `${profile.id ?? profile.email}:${sessionGeneration()}` : 'guest'} accountId={profile ? String(profile.id ?? profile.email) : undefined}><CheckoutProvider><PrescriptionsProvider><OrdersProvider><Shell /></OrdersProvider></PrescriptionsProvider></CheckoutProvider></CartProvider>;
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
