import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error(`Invalid Supabase URL format: ${error.message}`);
}

// Create the Supabase client with additional options and retry configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Info': 'supabase-js/2.39.7'
    }
  },
  db: {
    schema: 'public'
  },
  // Add retry configuration
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
});

// Test the connection with retries
const testConnection = async (retries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await supabase.from('running_up_alerts').select('id').limit(1);
      if (error) {
        throw error;
      }
      console.log('Supabase connection test successful');
      return;
    } catch (error) {
      console.warn(`Supabase connection attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt === retries) {
        console.error('Failed to connect to Supabase after all retries:', error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
};

// Initialize connection test
testConnection().catch(error => {
  console.error('Supabase initialization error:', error);
});