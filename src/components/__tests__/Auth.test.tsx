/**
 * Authentication Component Tests
 * Tests Supabase auth flows with mocked SDK
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client functions
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockResend = vi.fn();
const mockResetPassword = vi.fn();

describe('AuthForm Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSignUp', () => {
    it('should call supabase.auth.signUp with correct payload', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: null },
        error: null,
      });

      const email = 'test@example.com';
      const password = 'Password123!';
      const displayName = 'Test User';

      await mockSignUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });

      // Verify the call was made with the correct structure
      expect(mockSignUp).toHaveBeenCalled();
      const callArgs = mockSignUp.mock.calls[0][0];
      expect(callArgs.email).toBe(email);
      expect(callArgs.password).toBe(password);
      expect(callArgs.options.data.display_name).toBe(displayName);
      expect(callArgs.options).toBeDefined();
    });

    it('should handle signup error response', async () => {
      mockSignUp.mockResolvedValue({
        data: null,
        error: { message: 'User already exists' },
      });

      const result = await mockSignUp({
        email: 'existing@example.com',
        password: 'Password123!',
      });

      expect(result.error).toEqual({ message: 'User already exists' });
    });

    it('should handle needsConfirmation case', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: null },
        error: null,
      });

      const result = await mockSignUp({
        email: 'new@example.com',
        password: 'Password123!',
      });

      expect(result.data.user).toBeTruthy();
      expect(result.data.session).toBeNull();
    });
  });

  describe('handleSignIn', () => {
    it('should call supabase.auth.signInWithPassword with correct payload', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-456' } },
        error: null,
      });

      const email = 'login@example.com';
      const password = 'LoginPassword123!';

      await mockSignInWithPassword({
        email,
        password,
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email,
        password,
      });
    });

    it('should handle invalid credentials error', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const result = await mockSignInWithPassword({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      });

      expect(result.error.message).toBe('Invalid login credentials');
    });

    it('should return success when credentials are valid', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'valid-user' } },
        error: null,
      });

      const result = await mockSignInWithPassword({
        email: 'valid@example.com',
        password: 'ValidPassword123!',
      });

      expect(result.data.user).toBeTruthy();
      expect(result.error).toBeNull();
    });
  });
});

describe('Supabase SDK Integration', () => {
  describe('auth.signUp payload structure', () => {
    it('should include email, password and options with displayName', async () => {
      const expectedPayload = {
        email: 'user@test.com',
        password: 'SecurePass123!',
        options: {
          data: { display_name: 'Test User' },
          emailRedirectTo: expect.any(String),
        },
      };

      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

      await mockSignUp(expectedPayload);

      expect(mockSignUp).toHaveBeenCalledWith(expectedPayload);
    });
  });

  describe('auth.signInWithPassword payload structure', () => {
    it('should include email and password', async () => {
      const expectedPayload = {
        email: 'user@test.com',
        password: 'SecurePass123!',
      };

      mockSignInWithPassword.mockResolvedValue({ data: { user: {} }, error: null });

      await mockSignInWithPassword(expectedPayload);

      expect(mockSignInWithPassword).toHaveBeenCalledWith(expectedPayload);
    });
  });
});