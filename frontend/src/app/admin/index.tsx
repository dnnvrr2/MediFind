import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError } from '../../api/client';
import { useProfile } from '../../state/profile';
import { AdminWorkspace } from '../../features/admin-workspace';
import { Button, Card, Page, Text, colors, s } from '../../components/ui';

export default function AdminRoute() {
  const { profile, signOut } = useProfile();
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied' | 'error'>('checking');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setAccess('checking');
    api.me().then(user => { if (live) setAccess(user.is_staff === true ? 'allowed' : 'denied'); }).catch(error => {
      if (!live) return;
      setAccess('error');
      setMessage(error instanceof ApiError ? error.message : 'Could not verify staff access. Please try again.');
    });
    return () => { live = false; };
  }, [profile?.email, attempt]);
  if (access === 'checking') return <Page><ActivityIndicator accessibilityLabel="Verifying staff access" color={colors.teal} /><Text style={s.muted}>Verifying staff access...</Text></Page>;
  if (access !== 'allowed') return <Page><Card><Text style={s.heading}>{access === 'denied' ? 'Staff access required' : 'Could not verify access'}</Text><Text accessibilityRole="alert" style={s.muted}>{access === 'denied' ? 'Signed in as a customer. Use customer home or switch to a staff account.' : message}</Text>{access === 'denied' && <Button title="Go to customer home" icon="home" onPress={() => router.replace('/home')} />}{access === 'error' && <Button title="Retry" onPress={() => setAttempt(value => value + 1)} />}<Button title="Sign in with another account" onPress={async () => { await signOut(); router.replace({ pathname: '/account/sign-in', params: { returnTo: '/admin' } }); }} /><Button title="Return to guest home" secondary onPress={() => router.replace('/')} /></Card></Page>;
  return <AdminWorkspace />;
}
