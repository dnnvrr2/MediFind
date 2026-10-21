import { Redirect } from 'expo-router';
export default function RiderLoginRedirect() { return <Redirect href={{ pathname: '/account/sign-in', params: { returnTo: '/rider' } }} />; }
