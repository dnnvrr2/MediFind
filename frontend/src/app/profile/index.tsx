import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useProfile } from '../../state/profile';
import { Page, Card, Text, Button, Badge, colors, s } from '../../components/ui';
import { Icon } from '../../components/icon';

function Destination({ icon, title, detail, onPress }: { icon: 'orders' | 'prescription' | 'profile'; title: string; detail: string; onPress: () => void }) {
  return <Pressable accessibilityRole="link" onPress={onPress} style={{ minHeight: 70, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderColor: colors.line }}><Icon name={icon} color={colors.teal} /><View style={{ flex: 1, gap: 3 }}><Text style={{ fontWeight: '600' }}>{title}</Text><Text style={s.muted}>{detail}</Text></View><Icon name="arrow-right" size={18} color={colors.muted} /></Pressable>;
}

export default function Profile() {
  const { profile, signOut } = useProfile();
  return <Page><View style={{ gap: 8 }}><Text accessibilityRole="header" style={s.title}>Profile</Text><Text style={s.muted}>Your account and customer details.</Text></View>
    {profile ? <>
      <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }}><Icon name="profile" size={30} color={colors.teal} /></View><View style={{ flex: 1, gap: 4 }}><Text style={s.heading}>{profile.fullName}</Text><Text style={s.muted}>{profile.email}</Text></View></View><Badge text="Signed in · account saved" /><Button title="Edit profile" secondary icon="profile" onPress={() => router.push('/profile/edit')} /></Card>
      <Card><Destination icon="orders" title="My orders" detail="View current and previous demo orders" onPress={() => router.push('/orders')} /><Destination icon="prescription" title="Prescriptions" detail="View files and review status" onPress={() => router.push('/prescriptions')} /></Card>
      <Card><Text style={s.heading}>Account</Text><Text style={s.muted}>Your profile, orders, and prescription submissions are connected to your account.</Text><Button title="Sign out" secondary onPress={async () => { await signOut(); router.replace('/profile'); }} /></Card>
    </> : <>
      <Card><Icon name="profile" size={36} color={colors.teal} /><Text style={s.heading}>Sign in to your account</Text><Text style={s.muted}>Sign in to save your profile, order history, and prescription submissions.</Text><Button title="Sign in" icon="profile" onPress={() => router.push('/account/sign-in')} /><Button title="Create account" secondary onPress={() => router.push('/account/register')} /></Card>
      <Card><Destination icon="orders" title="My orders" detail="Your current app session's orders" onPress={() => router.push('/orders')} /><Destination icon="prescription" title="Prescriptions" detail="Your current app session's records" onPress={() => router.push('/prescriptions')} /></Card>
    </>}
  </Page>;
}
