import { router } from 'expo-router';
import { Page, Back, Button } from '../components/ui';
export default function NotFound() {
  return <Page><Back title="Page not found" /><Button title="Return home" onPress={() => router.replace('/')} /></Page>;
}
