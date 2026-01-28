import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Use SecureStore for native platforms, localStorage for web
const createStorageAdapter = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key) => {
        if (typeof localStorage !== 'undefined') {
          return Promise.resolve(localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key, value) => {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key) => {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
        return Promise.resolve();
      },
    };
  } else {
    return {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    };
  }
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseEnv) {
  const message =
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add a .env file with these values.";
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(message);
  } else {
    throw new Error(message);
  }
}

export const OAUTH_REDIRECT_URL = Linking.createURL('/auth/callback');

const safeUrl = supabaseUrl || "http://localhost:54321";
const safeAnonKey = supabaseAnonKey || "public-anon-key";

export const supabase = createClient(safeUrl, safeAnonKey, {
  auth: {
    storage: createStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
