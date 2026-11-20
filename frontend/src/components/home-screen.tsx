import { useState } from 'react';
import { View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, TextLink, colors, Text, s, Button } from '../components/ui';
import { Icon } from '../components/icon';
import { MedicineRow } from '../components/medicine-row';
import { LocationPicker } from './location-picker';
import { useLocation } from '../state/location';
import { matchesArea } from '../domain/locations';
import { useProfile } from '../state/profile';
import { useCatalog, medicines, pharmacies, offers, money } from '../data/catalog';

function CatalogSkeleton({ rows = 3 }: { rows?: number }) {
  return <View accessibilityLabel="Loading listings" accessibilityRole="progressbar" style={s.list}>
    {Array.from({ length: rows }, (_, i) => <View key={i} style={[{ flexDirection: 'row', gap: 12, padding: 16, alignItems: 'center' }, i < rows - 1 && s.divider]}>
      <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: '#E8EFEC' }} />
      <View style={{ flex: 1, gap: 9 }}><View style={{ width: '62%', height: 14, borderRadius: 7, backgroundColor: '#E8EFEC' }} /><View style={{ width: '38%', height: 11, borderRadius: 6, backgroundColor: '#F0F4F2' }} /></View>
    </View>)}
  </View>;
}

export function HomeScreen({ guest = false }: { guest?: boolean }) {
  const { status: catalogStatus } = useCatalog();
  const { profile } = useProfile();
  const { area } = useLocation();
  const localPharmacies = pharmacies.filter(p => matchesArea(p.address, area));
  const localPharmacyIds = new Set(localPharmacies.map(p => p.id));
  const localMedicineIds = new Set(offers.filter(o => localPharmacyIds.has(o.pharmacyId) && o.stock > 0).map(o => o.medicineId));
  const featuredMedicines = medicines.filter(m => localMedicineIds.has(m.id)).slice(0, 3);
  const quickSearches = ['Paracetamol', 'Amoxicillin', 'Vitamin C', 'Cough syrup'];
  const previewCards = featuredMedicines.slice(0, 3).map(m => {
    const liveOffers = offers.filter(o => o.medicineId === m.id && localPharmacyIds.has(o.pharmacyId) && o.stock > 0);
    return { title: `${m.name} ${m.strength}`, detail: `From ${money(Math.min(...liveOffers.map(o => o.price)))}`, note: `In stock at ${new Set(liveOffers.map(o => o.pharmacyId)).size} pharmacies`, icon: 'medicine' as const };
  });
  const heroPreviews = previewCards.length ? previewCards : [
    { title: 'Compare local options', detail: 'Review pharmacy prices', note: 'Find what fits your needs', icon: 'pharmacy' as const },
    { title: 'Check availability', detail: 'View listed stock', note: 'Before visiting a pharmacy', icon: 'check' as const },
    { title: 'Choose how to get it', detail: 'Pickup or delivery', note: 'Available at checkout', icon: 'delivery' as const },
  ];
  const customer = !guest && profile;
  const [query, setQuery] = useState('');
  const viewportWidth = useWindowDimensions().width;
  const wide = viewportWidth >= 900;
  const compact = viewportWidth < 560;
  const search = (q = query) => router.push({ pathname: '/search', params: { q } });
  const loading = catalogStatus === 'loading';
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
    <View style={{ flexGrow: 1 }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingTop: wide ? 36 : 24, paddingBottom: 36, gap: wide ? 20 : 24 }}>
      <LinearGradient colors={['#0F766E', '#115E59']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'relative', overflow: 'hidden', padding: wide ? 32 : compact ? 18 : 22, borderRadius: 20 }}>
        <View pointerEvents="none" style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, right: -80, top: -110, backgroundColor: '#FFFFFF', opacity: 0.07 }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, left: '40%', bottom: -120, backgroundColor: '#A7F3D0', opacity: 0.08 }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 110, height: 30, borderRadius: 20, right: '32%', top: 36, backgroundColor: '#FFFFFF', opacity: 0.06, transform: [{ rotate: '-28deg' }] }} />
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 30 : compact ? 15 : 20 }}>
          <View style={{ flex: 1.35, width: '100%', gap: compact ? 13 : 17, zIndex: 1 }}>
            <View style={{ gap: 6 }}><Text style={{ color: '#D4F0E9', fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.5 }}>BROWSING NEAR</Text><LocationPicker onDark /></View>
            <View style={{ gap: 0 }}>
              <Text accessibilityRole="header" style={{ fontSize: wide ? 38 : compact ? 27 : 30, lineHeight: wide ? 46 : compact ? 34 : 38, fontWeight: '700', letterSpacing: -0.8, color: colors.white }}>Find the medicine you need,</Text>
              <Text style={{ fontSize: wide ? 44 : compact ? 33 : 36, lineHeight: wide ? 50 : compact ? 39 : 42, fontWeight: '700', letterSpacing: -1, color: '#A7F3D0' }}>nearby.</Text>
              <Text style={{ color: '#D7F0E9', fontSize: compact ? 14 : 15, lineHeight: compact ? 21 : 23, marginTop: 4 }}>Compare prices and stock across Cagayan de Oro pharmacies.</Text>
            </View>
            <Search value={query} onChange={setQuery} onSubmit={() => search()} hero />
            {compact ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 2 }}>
              {quickSearches.map(term => <Pressable key={term} accessibilityRole="button" onPress={() => { setQuery(term); search(term); }} style={({ pressed }) => ({ minHeight: 32, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', opacity: pressed ? 0.72 : 1 })}><Text style={{ color: colors.white, fontSize: 12, lineHeight: 18, fontWeight: '500' }}>{term}</Text></Pressable>)}
            </ScrollView> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {quickSearches.map(term => <Pressable key={term} accessibilityRole="button" onPress={() => { setQuery(term); search(term); }} style={({ pressed }) => ({ minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', opacity: pressed ? 0.72 : 1 })}><Text style={{ color: colors.white, fontSize: 13, lineHeight: 19, fontWeight: '500' }}>{term}</Text></Pressable>)}
            </View>}
            <View style={{ flexDirection: 'row', flexWrap: compact ? 'nowrap' : 'wrap', justifyContent: compact ? 'space-between' : undefined, columnGap: compact ? 7 : 16, rowGap: 8, paddingTop: 1 }}>
              {[['check', 'Verified pharmacies'], ['refresh', 'Live stock info'], ['pickup', 'Pickup or delivery']].map(([icon, label]) => <View key={label} style={{ flexDirection: 'row', flexShrink: compact ? 1 : 0, alignItems: 'center', gap: compact ? 4 : 6 }}><Icon name={icon as 'check' | 'refresh' | 'pickup'} size={compact ? 13 : 15} color="#D4F0E9" /><Text numberOfLines={1} style={{ color: '#E6F5F1', fontSize: compact ? 10 : 12, lineHeight: 18, fontWeight: '500', flexShrink: 1 }}>{label}</Text></View>)}
            </View>
          </View>
          {wide && <View style={{ flex: 0.85, minWidth: 280, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, zIndex: 1 }}>
            {heroPreviews.map((preview, i) => <View key={`${preview.title}-${i}`} style={{ width: '94%', minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.97)', shadowColor: '#003B35', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 7, transform: [{ rotate: i === 0 ? '-3deg' : i === 2 ? '2deg' : '0deg' }], marginLeft: i === 1 ? 16 : 0, marginTop: i === 0 ? 0 : -12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name={preview.icon} size={21} color={colors.teal} /></View>
              <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.dark, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{preview.title}</Text><Text style={{ color: colors.teal, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{preview.detail}</Text><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{preview.note}</Text></View>
            </View>)}
          </View>}
        </View>
      </LinearGradient>
      <View style={{ gap: 12 }}>
        <Pressable accessibilityRole="link" onPress={() => router.push(guest ? { pathname: '/account/sign-in', params: { returnTo: '/prescriptions/upload' } } : '/prescriptions/upload')} style={({ pressed }) => [s.card, { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: pressed ? colors.pale : colors.white }]}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name="prescription" size={25} color={colors.teal} /></View>
          <View style={{ flex: 1, gap: 6 }}><Text style={s.heading}>Have a prescription?</Text><Text style={s.muted}>{customer ? 'Upload for pharmacy review.' : 'Sign in to upload.'}</Text></View>
          <Icon name="arrow-right" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 32 : 28, alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1.6 : undefined, width: wide ? undefined : '100%', gap: 8 }}>
          <View style={s.between}><Text accessibilityRole="header" style={s.heading}>Browse medicines</Text><TextLink title="View all" icon="arrow-right" onPress={() => search('')} /></View>
          {loading ? <CatalogSkeleton /> : catalogStatus === 'unavailable' ? <View style={[s.list, { padding: 16 }]}><Text style={s.muted}>Catalog unavailable. Try again shortly.</Text></View> : <View style={s.list}>{!featuredMedicines.length && <Text style={[s.muted, { padding: 16 }]}>{medicines.length ? `No medicines available near ${area}.` : 'No medicines listed yet.'}</Text>}{featuredMedicines.map((m, i) => <MedicineRow key={m.id} medicine={m} last={i === featuredMedicines.length - 1} onPress={() => router.push({ pathname: '/medicine/[id]', params: { id: m.id } })} />)}</View>}
        </View>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 8 }}>
          <View style={s.between}><Text accessibilityRole="header" style={s.heading}>Pharmacies</Text><TextLink title="View all" icon="arrow-right" onPress={() => router.push({ pathname: '/pharmacies', params: { scope: 'all' } })} /></View>
          {loading ? <CatalogSkeleton rows={2} /> : catalogStatus === 'unavailable' ? <View style={[s.list, { padding: 16 }]}><Text style={s.muted}>Catalog unavailable. Try again shortly.</Text></View> : <View style={s.list}>{!localPharmacies.length && <View style={{ padding: 20, gap: 8 }}><Text style={s.muted}>{pharmacies.length ? `No pharmacies listed near ${area}.` : 'No pharmacies listed in this area.'}</Text></View>}{localPharmacies.slice(0, 3).map((p, i) => <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`View ${p.name}`} onPress={() => router.push({ pathname: '/pharmacy/[id]', params: { id: p.id } })} style={({ pressed }) => [{ padding: 16, gap: 8, backgroundColor: pressed ? colors.neutral : colors.white }, i < Math.min(localPharmacies.length, 3) - 1 && s.divider]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="pharmacy" size={20} color={colors.muted} /><Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', flex: 1 }}>{p.name}</Text><Icon name="arrow-right" size={16} color={colors.muted} /></View><Text style={s.muted}>{p.address}</Text>
          </Pressable>)}</View>}
        </View>
      </View>
      <View style={{ gap: 14 }}>
        <Text accessibilityRole="header" style={s.heading}>How it works</Text>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
          {([['search', 'Search', 'Find a medicine by name or generic.'], ['medicine', 'Compare', 'Review prices and nearby stock.'], ['cart', 'Reserve or order', 'Choose pickup or delivery.']] as const).map(([icon, title, detail], index) => <View key={title} style={[s.card, { flex: 1, minHeight: compact ? 140 : 170, padding: compact ? 14 : 18, alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative' }]}>
            <Text style={{ position: 'absolute', top: 12, left: 20, color: colors.teal, fontSize: 20, lineHeight: 26, fontWeight: '700' }}>{index + 1}</Text>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={21} color={colors.teal} /></View>
            <Text style={[s.heading, { textAlign: 'center' }]}>{title}</Text><Text style={[s.muted, { textAlign: 'center' }]}>{detail}</Text>
          </View>)}
        </View>
      </View>
      <View style={[s.card, { flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', backgroundColor: '#EAF4F1', borderColor: '#C9E2DA' }]}>
        <View style={{ flex: 1, gap: 5 }}><Text style={s.heading}>Pharmacy team?</Text><Text style={s.muted}>List your pharmacy and make local medicine availability easier to find.</Text></View>
        <View style={{ minWidth: wide ? 190 : undefined }}><Button title="Partner with us" icon="pharmacy" onPress={() => router.push('/partnership')} /></View>
      </View>
      </View>
    </View>
    <View style={{ borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 20, paddingVertical: 22 }}>
      <View style={{ width: '100%', maxWidth: 1060, alignSelf: 'center', gap: 14 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ color: colors.dark, fontWeight: '700', fontSize: 16 }}>MediFind</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 4 }}>
            <TextLink title="Search" onPress={() => search('')} /><TextLink title="Pharmacies" onPress={() => router.push('/pharmacies')} /><TextLink title="Partner with us" onPress={() => router.push('/partnership')} />
          </View>
        </View>
        <Text style={s.caption}>Check nearby availability before visiting a pharmacy.</Text>
      </View>
    </View>
  </ScrollView>;
}
