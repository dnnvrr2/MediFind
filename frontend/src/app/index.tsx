import { Redirect } from 'expo-router';
import { HomeScreen } from '../components/home-screen';
import { useProfile } from '../state/profile';
import { accountHome } from '../domain/public-access';
export default function GuestLanding() { const { profile } = useProfile(); return profile ? <Redirect href={accountHome(profile)} /> : <HomeScreen guest />; }
