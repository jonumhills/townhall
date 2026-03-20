import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

let _client = null;

export function getSupabase() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_KEY must be set in .env");
  }

  _client = createClient(url, key);
  console.log("Supabase client initialized");
  return _client;
}
