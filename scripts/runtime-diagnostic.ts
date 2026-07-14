#!/usr/bin/env node
/**
 * Runtime Diagnostic Script for Conferly Meeting Rooms
 * 
 * This script traces the exact request flow through authentication,
 * authorization, database access, and LiveKit token generation.
 * 
 * Usage:
 *   npx tsx scripts/runtime-diagnostic.ts
 * 
 * Prerequisites:
 *   - Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - Or set AUTH_TRACE=true environment variable
 */

import { createClient } from '@supabase/supabase-js';
import { AccessToken } from 'livekit-server-sdk';

// Configuration from environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.POSTGRES_CONFERLY_SUPABASE_SERVICE_ROLE_KEY;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const TEST_EMAIL = process.env.TEST_EMAIL || 'nathi.ylt@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Nashel@1';
const TEST_ROOM_SLUG = process.env.TEST_ROOM_SLUG || 'test-room-' + Date.now();
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://conferly.site';

interface DiagnosticStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  duration?: number;
  result?: unknown;
  error?: string;
}

class RuntimeDiagnostic {
  private steps: DiagnosticStep[] = [];
  private startTime: number = 0;
  private userId?: string;
  private accessToken?: string;
  private refreshToken?: string;

  constructor() {
    this.startTime = Date.now();
  }

  private log(level: 'info' | 'success' | 'error' | 'warn', message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;
    const prefix = `[${elapsed}ms]`;
    
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warn: '⚠️',
    };

    console.log(`${prefix} ${icons[level]} ${message}`);
    if (data && level === 'error') {
      console.log(`   ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
    } else if (data) {
      console.log(`   ${JSON.stringify(data)}`);
    }
  }

  private async runStep(name: string, fn: () => Promise<unknown>): Promise<void> {
    const step: DiagnosticStep = { name, status: 'running' };
    this.steps.push(step);
    this.log('info', `Starting: ${name}`);
    
    const stepStart = Date.now();
    try {
      step.result = await fn();
      step.status = 'success';
      step.duration = Date.now() - stepStart;
      this.log('success', `Completed: ${name} (${step.duration}ms)`);
    } catch (error) {
      step.status = 'error';
      step.duration = Date.now() - stepStart;
      step.error = error instanceof Error ? error.message : String(error);
      this.log('error', `Failed: ${name}`, { error: step.error });
      throw error;
    }
  }

  private async signIn(): Promise<void> {
    await this.runStep('Sign in to Supabase', async () => {
      // Use the raw auth endpoint to get tokens
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Auth failed: ${error.error_description || error.error || response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.userId = data.user?.id;
      
      return {
        userId: this.userId,
        hasAccessToken: !!this.accessToken,
        hasRefreshToken: !!this.refreshToken,
      };
    });
  }

  private async checkDatabaseSchema(): Promise<void> {
    await this.runStep('Check database schema', async () => {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });

      // Check if meetings table exists
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, slug, owner, is_public')
        .limit(5);

      if (meetingsError) {
        return {
          error: meetingsError.message,
          code: meetingsError.code,
          details: meetingsError.details,
        };
      }

      return {
        meetingsFound: meetingsData?.length || 0,
        meetings: meetingsData,
      };
    });
  }

  private async verifyAccess(): Promise<void> {
    await this.runStep('Verify access to test room', async () => {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });

      // Step 1: Check if meeting exists by slug
      this.log('info', `Looking up meeting by slug: ${TEST_ROOM_SLUG}`);
      const { data: meetingBySlug, error: slugError } = await supabase
        .from('meetings')
        .select('id, slug, owner, is_public')
        .eq('slug', TEST_ROOM_SLUG)
        .maybeSingle();

      if (slugError) {
        return { error: slugError.message, step: 'lookup-by-slug' };
      }

      if (meetingBySlug) {
        this.log('success', `Found meeting by slug: ${meetingBySlug.id}`);
        return {
          foundBy: 'slug',
          meeting: meetingBySlug,
        };
      }

      // Step 2: Try by ID
      this.log('info', `Looking up meeting by ID: ${TEST_ROOM_SLUG}`);
      const { data: meetingById, error: idError } = await supabase
        .from('meetings')
        .select('id, slug, owner, is_public')
        .eq('id', TEST_ROOM_SLUG)
        .maybeSingle();

      if (idError) {
        return { error: idError.message, step: 'lookup-by-id' };
      }

      if (meetingById) {
        this.log('success', `Found meeting by ID: ${meetingById.id}`);
        return {
          foundBy: 'id',
          meeting: meetingById,
        };
      }

      // Step 3: Check if user is owner of any meeting
      this.log('info', `Checking if user ${this.userId} is owner of any meetings`);
      const { data: ownedMeetings, error: ownerError } = await supabase
        .from('meetings')
        .select('id, slug, owner, is_public')
        .eq('owner', this.userId);

      if (ownerError) {
        return { error: ownerError.message, step: 'lookup-owned' };
      }

      return {
        foundBy: 'none',
        userIsOwnerOf: ownedMeetings?.map(m => m.slug),
      };
    });
  }

  private async checkLiveKitConfig(): Promise<void> {
    await this.runStep('Check LiveKit configuration', async () => {
      if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        return {
          configured: false,
          hasApiKey: !!LIVEKIT_API_KEY,
          hasApiSecret: !!LIVEKIT_API_SECRET,
          message: 'LiveKit credentials not configured',
        };
      }

      // Try to generate a test token
      try {
        const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
          identity: 'diagnostic-test',
          name: 'Diagnostic Test',
        });
        token.addGrant({
          roomJoin: true,
          room: 'diagnostic-test-room',
          canSubscribe: true,
          canPublish: false,
        });
        
        const jwt = await token.toJwt();
        return {
          configured: true,
          tokenLength: jwt.length,
          url: LIVEKIT_URL,
        };
      } catch (error) {
        return {
          configured: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }

  private async testLkTokenEndpoint(): Promise<void> {
    await this.runStep('Test /api/lk-token endpoint', async () => {
      const response = await fetch(`${PRODUCTION_URL}/api/lk-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `sb-access-token=${this.accessToken}; sb-refresh-token=${this.refreshToken}`,
        },
        body: JSON.stringify({
          roomId: TEST_ROOM_SLUG,
          role: 'participant',
          domain: 'meet',
        }),
      });

      const body = await response.json();
      
      return {
        status: response.status,
        ok: response.ok,
        body: body.error ? { error: body.error } : { hasToken: !!body.token },
      };
    });
  }

  private async testAuthenticatedRoomAccess(): Promise<void> {
    await this.runStep('Test authenticated room page access', async () => {
      const response = await fetch(`${PRODUCTION_URL}/meet/rooms/${TEST_ROOM_SLUG}`, {
        headers: {
          'Cookie': `sb-access-token=${this.accessToken}; sb-refresh-token=${this.refreshToken}`,
        },
        redirect: 'manual',
      });

      return {
        status: response.status,
        statusText: response.statusText,
        location: response.headers.get('location'),
      };
    });
  }

  async run(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('CONFERLY RUNTIME DIAGNOSTIC');
    console.log('='.repeat(80) + '\n');

    // Check configuration
    console.log('Configuration:');
    console.log(`  Production URL: ${PRODUCTION_URL}`);
    console.log(`  Supabase URL: ${SUPABASE_URL ? '(set)' : '(MISSING)'}`);
    console.log(`  Supabase Anon Key: ${SUPABASE_ANON_KEY ? '(set)' : '(MISSING)'}`);
    console.log(`  Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY ? '(set)' : '(MISSING)'}`);
    console.log(`  LiveKit URL: ${LIVEKIT_URL || '(not set)'}`);
    console.log(`  LiveKit API Key: ${LIVEKIT_API_KEY ? '(set)' : '(MISSING)'}`);
    console.log(`  LiveKit API Secret: ${LIVEKIT_API_SECRET ? '(set)' : '(MISSING)'}`);
    console.log('');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      this.log('error', 'Missing required environment variables');
      process.exit(1);
    }

    try {
      // Run diagnostic steps
      await this.signIn();
      await this.checkDatabaseSchema();
      await this.verifyAccess();
      await this.checkLiveKitConfig();
      
      if (this.accessToken) {
        await this.testAuthenticatedRoomAccess();
        await this.testLkTokenEndpoint();
      } else {
        this.log('warn', 'Skipping authenticated tests - no access token');
      }

      // Print summary
      console.log('\n' + '='.repeat(80));
      console.log('DIAGNOSTIC SUMMARY');
      console.log('='.repeat(80));
      
      for (const step of this.steps) {
        const icon = step.status === 'success' ? '✅' : step.status === 'error' ? '❌' : step.status === 'skipped' ? '⏭️' : '⏳';
        const duration = step.duration ? `(${step.duration}ms)` : '';
        console.log(`${icon} ${step.name} ${duration}`);
        if (step.error) {
          console.log(`   Error: ${step.error}`);
        }
      }
      
      const totalTime = Date.now() - this.startTime;
      console.log(`\nTotal time: ${totalTime}ms`);
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      this.log('error', 'Diagnostic failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  }
}

// Run the diagnostic
const diagnostic = new RuntimeDiagnostic();
diagnostic.run();
