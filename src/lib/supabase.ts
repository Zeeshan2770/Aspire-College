import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

/** False when the site was built without its Supabase settings (they are baked in at build time). */
export const isSupabaseConfigured = Boolean(url && anonKey);

// createClient throws on an empty URL, so use inert placeholders when unconfigured; main.tsx shows a clear message instead.
export const supabase = createClient(url || 'http://localhost:9', anonKey || 'not-configured', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
