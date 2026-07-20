import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client for the admin dashboard. Cookie-based sessions (via
// @supabase/ssr) so proxy.js can read the auth state server-side.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
