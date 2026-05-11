/**
 * Authentication Tests - Tests AuthPage component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthPage from '../AuthPage';

const mockSignUp = vi.fn().mockResolvedValue({ success: true });
const mockSignIn = vi.fn().mockResolvedValue({ success: true });
const mockClearError = vi.fn();

describe('AuthPage Component', () => {
  const props = {
    onSignUp: mockSignUp,
    onSignIn: mockSignIn,
    onResendConfirmation: vi.fn(),
    onResetPassword: vi.fn(),
    error: null,
    clearError: mockClearError,
    loading: false,
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders sign in form by default', () => {
    render(<AuthPage {...props} />);
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });

  it('updates email input', () => {
    render(<AuthPage {...props} />);
    const input = screen.getByPlaceholderText(/you@example.com/);
    fireEvent.change(input, { target: { value: 'test@test.com' } });
    expect(input.value).toBe('test@test.com');
  });

  it('updates password input', () => {
    render(<AuthPage {...props} />);
    const input = screen.getByPlaceholderText(/••••••••/);
    fireEvent.change(input, { target: { value: 'pass123' } });
    expect(input.value).toBe('pass123');
  });

  it('switches to signup mode', () => {
    render(<AuthPage {...props} />);
    const btn = screen.getByText('Sign Up');
    fireEvent.click(btn);
    expect(screen.getByPlaceholderText(/Min 8 chars/)).toBeTruthy();
  });

  it('validates weak password', () => {
    render(<AuthPage {...props} />);
    fireEvent.click(screen.getByText('Sign Up'));
    const pw = screen.getByPlaceholderText(/Min 8 chars/);
    fireEvent.change(pw, { target: { value: 'abc' } });
    expect(screen.getByText(/At least 8 characters/)).toBeTruthy();
  });

  it('shows valid password indicator', () => {
    render(<AuthPage {...props} />);
    fireEvent.click(screen.getByText('Sign Up'));
    const pw = screen.getByPlaceholderText(/Min 8 chars/);
    fireEvent.change(pw, { target: { value: 'ValidPass123!' } });
    expect(screen.getByText(/Password meets requirements/)).toBeTruthy();
  });

  it('calls onSignIn when form submits', () => {
    render(<AuthPage {...props} />);
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: '123' } });
    fireEvent.click(screen.getByText('Sign In'));
    expect(mockSignIn).toHaveBeenCalledWith('a@b.com', '123', '');
  });

  it('displays error message', () => {
    render(<AuthPage {...props} error="Test error" />);
    expect(screen.getByText('Test error')).toBeTruthy();
  });

  it('shows loading spinner', () => {
    render(<AuthPage {...props} loading={true} />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });
});