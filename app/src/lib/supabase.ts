import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** `null` enquanto o projeto Supabase não estiver configurado no .env */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export function exigirSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no app/.env'
    );
  }
  return supabase;
}
