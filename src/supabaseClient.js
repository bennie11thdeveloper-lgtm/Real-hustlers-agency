import { createClient } from '@supabase/supabase-js'

// Vite reads environment variables using import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing! Check your .env.local file.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
