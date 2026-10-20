import { router } from 'expo-router';
import { Page, Back, Button, Text, s } from '../components/ui';
export default function NotFound() {
  return <Page><Back title="Page not found" /><Text style={s.muted}>This page is not available in the customer preview.</Text><Button title="Return home" onPress={() => router.replace('/')} /></Page>;
}
