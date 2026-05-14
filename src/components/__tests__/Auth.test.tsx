/**
 * Authentication Tests - Tests AuthPage component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from '../AuthPage';

const mockSignUp = vi.fn().mockResolvedValue({ success: true });
const mockSignIn = vi.fn().mockResolvedValue({ success: true });
const mockClearError = vi.fn();

// Skip old Vite-era tests - these test src/components/AuthPage which is no longer used in Next.js app
describe.skip('AuthPage Component', () => {
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
    render(<MemoryRouter><AuthPage {...props} /></MemoryRouter>);
    expect(screen.getByText(/Sign In/)).toBeTruthy();
  });

  it('updates email input', () => {
    render(<MemoryRouter><AuthPage {...props} /></MemoryRouter>);
    const input = screen.getByPlaceholderText(/you@example.com/);
    fireEvent.change(input, { target: { value: 'test@test.com' } });
    expect(input.value).toBe('test@test.com');
  });

  it('updates password input', () => {
    render(<MemoryRouter><AuthPage {...props} /></MemoryRouter>);
    const input = screen.getByPlaceholderText(/••••••••/);
    fireEvent.change(input, { target: { value: 'pass123' } });
    expect(input.value).toBe('pass123');
  });

  it('switches to signup mode', () => {
    render(<MemoryRouter><AuthPage {...props} /></MemoryRouter>);
    const btn = screen.getByText('Sign Up');
    fireEvent.click(btn);
    expect(screen.getByPlaceholderText(/Min 8 chars/)).toBeTruthy();
  });

  it('validates weak password', () => {
    render(<MemoryRouter><AuthPage {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Sign Up'));
    const pw = screen.getByPlaceholderText(/Min 8 chars/);
    fireEvent.change(pw, { target: { value: 'abc' } });
    expect(screen.getByText(/At least 8 characters/)).toBeTruthy();
  });

  it('shows valid password indicator', () => {
    render(<MemoryRouter><AuthPage {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Sign Up'));
    const pw = screen.getByPlaceholderText(/Min 8 chars/);
    fireEvent.change(pw, { target: { value: 'ValidPass123!' } });
    expect(screen.getByText(/Password meets requirements/)).toBeTruthy();
  });

  it('displays error message', () => {
    render(<MemoryRouter><AuthPage {...props} error="Test error" /></MemoryRouter>);
    expect(screen.getByText('Test error')).toBeTruthy();
  });

  it('shows loading spinner', () => {
    render(<MemoryRouter><AuthPage {...props} loading={true} /></MemoryRouter>);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });
});