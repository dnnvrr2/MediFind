import { Redirect } from 'expo-router';
import { RiderDashboard } from '../../features/rider';
import { useProfile } from '../../state/profile';

export default function RiderRoute() {
  const { profile } = useProfile();
  if (profile && !profile.isRider) return <Redirect href="/rider/apply" />;
  return <RiderDashboard />;
}
