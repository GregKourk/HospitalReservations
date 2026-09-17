import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const msg =
    'Missing environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.';
  // Provide helpful debugging output in console
  // eslint-disable-next-line no-console
  console.error(msg, { supabaseUrl, supabaseAnonKey });
  throw new Error(msg);
}

/**
 * Creates and exports a Supabase client instance configured with
 * environment variables.
 *
 * This client can be imported and used throughout the application for
 * authentication and database operations.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);
