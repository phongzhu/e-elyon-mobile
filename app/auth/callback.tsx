import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';

export default function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse the URL and store session in the Supabase client storage
        // auth.getSessionFromUrl may not be typed in this environment, so cast to any
        const { error } = await (supabase.auth as any).getSessionFromUrl({ storeSession: true });
        if (error) {
          console.error('Error parsing session from URL', error);
          Alert.alert('Authentication Error', error.message || 'Could not complete sign-in.');
          router.replace('/login' as any);
          return;
        }

        // If session obtained, navigate to account setup (or home)
        router.replace('/account-setup' as any);
      } catch (err: any) {
        console.error('Callback handling failed', err);
        Alert.alert('Authentication Error', err?.message || 'Could not complete sign-in.');
        router.replace('/login');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Completing sign-in...</Text>
    </View>
  );
}
