import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// A static host such as Netlify does not receive the local .env file unless
// its values are added in the site's environment settings.  Let the game run
// without cloud saves in that case instead of crashing during initial render.
export const supabase = url && key ? createClient(url, key) : null;
