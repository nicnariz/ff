import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout(): JSX.Element {
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></>;
}
