import { useState } from 'react';
import { Mail, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

interface EmailConfirmationProps {
  email: string;
  onResend: (email: string) => void;
  onBack: () => void;
}

export default function EmailConfirmation({ email, onResend, onBack }: EmailConfirmationProps) {
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResend = async () => {
    setResending(true);
    setResendSuccess(false);
    await onResend(email);
    setResending(false);
    setResendSuccess(true);
    setTimeout(() => setResendSuccess(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-slate-600">We've sent a confirmation link to:</p>
          <p className="font-semibold text-blue-600 mt-1">{email}</p>
        </div>

        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-800 font-medium">Registration successful!</p>
              <p className="text-green-700 text-sm mt-1">
                Welcome to Conferly! 🎉 Your account has been created.
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-blue-800 font-medium">Next steps:</p>
              <ol className="text-blue-700 text-sm mt-2 space-y-1 list-decimal list-inside">
                <li>Check your email inbox</li>
                <li>Click the confirmation link</li>
                <li>Start using Conferly!</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Resend Section */}
        <div className="space-y-4">
          <p className="text-sm text-slate-600 text-center">
            Didn't receive the email? Check your spam folder or request a new one.
          </p>
          
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Resend Confirmation Email
              </>
            )}
          </button>

          {resendSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-700 text-sm text-center">
                ✅ Confirmation email sent successfully!
              </p>
            </div>
          )}

          <button
            onClick={onBack}
            className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            Back to Sign In
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            Need help? Contact <a href="mailto:support@conferly.site" className="text-blue-600 hover:underline">support@conferly.site</a>
          </p>
        </div>
      </div>
    </div>
  );
}
