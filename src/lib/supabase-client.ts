"use client";

import { createClient } from '@supabase/supabase-js/dist/module/index.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
