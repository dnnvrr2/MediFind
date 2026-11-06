import { router } from 'expo-router';
import { Back, Page } from '../../components/ui';

export default function ContactAdmin() {
  return <Page scrollKey="pharmacy-contact-admin"><Back title="Contact admin" onBack={() => router.replace({ pathname: '/partner/stock-settings', params: { tab: 'inventory' } })} /></Page>;
}
