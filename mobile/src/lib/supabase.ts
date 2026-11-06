import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishableKey) throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");

export const supabase = createClient(url, publishableKey, {
  auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
