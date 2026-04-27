import { createClient } from "@supabase/supabase-js";

// Anon (publishable) key is safe to embed in the client bundle — RLS gates
// what it can do. Get it from Supabase Dashboard → Project Settings → API Keys.
export const SUPABASE_URL = "https://oigbbgtzzqiceetasayy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_YTd6bXMqUddNj4aFf1YRwA_T320qu3c";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Front-load the project's TLS handshake + warm any paused free-tier project
// before the user actually searches. Fire-and-forget; failures are silent.
export function wakeUp() {
  void supabase.from("words").select("word", { head: true, count: "exact" }).limit(1);
}
