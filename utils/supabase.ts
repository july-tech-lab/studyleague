import { createClient } from '@supabase/supabase-js';

// Expo automatically makes EXPO_PUBLIC_* variables available via process.env
// Works in both development (.env file) and production (EAS secrets)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file or EAS secrets.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
