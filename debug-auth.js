// Debug script to test Supabase authentication
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://neymqmyzmsberwlowlpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leW1xbXl6bXNiZXJ3bG93bHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDY3OTcsImV4cCI6MjA5MzE4Mjc5N30.2tYikfedPC245ycevkGjQLbWdYn_rHrOj8fd2ISL8C4';

console.log('Testing Supabase connection...');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'conferly_supabase_auth',
  },
});

// Test 1: Check current session
async function checkSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('Current session:', data);
    console.log('Session error:', error);
    return data;
  } catch (err) {
    console.error('Session check error:', err);
    return null;
  }
}

// Test 2: Try to sign up
async function testSignUp(email, password, displayName) {
  try {
    console.log(`\nTesting signup for: ${email}`);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    });
    console.log('Signup result:', data);
    console.log('Signup error:', error);
    return { data, error };
  } catch (err) {
    console.error('Signup error:', err);
    return { data: null, error: err };
  }
}

// Test 3: Try to sign in
async function testSignIn(email, password) {
  try {
    console.log(`\nTesting signin for: ${email}`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    console.log('Signin result:', data);
    console.log('Signin error:', error);
    return { data, error };
  } catch (err) {
    console.error('Signin error:', err);
    return { data: null, error: err };
  }
}

// Test 4: Check if user exists in profiles table
async function checkProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    console.log('Profile data:', data);
    console.log('Profile error:', error);
    return { data, error };
  } catch (err) {
    console.error('Profile check error:', err);
    return { data: null, error: err };
  }
}

// Run tests
async function runTests() {
  console.log('=== Supabase Auth Debug ===');

  // Check current session first
  const session = await checkSession();

  if (session?.session) {
    console.log('✅ User already logged in');
    const profile = await checkProfile(session.session.user.id);
    return;
  }

  // Test with sample credentials
  const testEmail = 'testuser@conferly.site';
  const testPassword = 'Test123456!';
  const testDisplayName = 'Test User';

  // Try signup
  const signupResult = await testSignUp(testEmail, testPassword, testDisplayName);

  if (signupResult.data?.user && !signupResult.error) {
    console.log('✅ Signup successful');

    // Try signin
    const signinResult = await testSignIn(testEmail, testPassword);

    if (signinResult.data?.user && !signinResult.error) {
      console.log('✅ Signin successful');

      // Check profile
      const profile = await checkProfile(signinResult.data.user.id);

      if (profile.data) {
        console.log('✅ Profile found in database');
      } else {
        console.log('❌ Profile not found - trigger may not be working');
      }
    } else {
      console.log('❌ Signin failed:', signinResult.error);
    }
  } else {
    console.log('❌ Signup failed:', signupResult.error);

    // If signup fails because user exists, try signin
    if (signupResult.error?.message?.includes('already registered')) {
      console.log('User already exists, trying signin...');
      const signinResult = await testSignIn(testEmail, testPassword);
      if (signinResult.data?.user) {
        console.log('✅ Existing user signin successful');
      }
    }
  }
}

runTests().catch(console.error);
