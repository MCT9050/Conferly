import { ArrowLeft, Printer } from 'lucide-react';
import Logo from './Logo';

interface PrivacyPageProps {
  onClose?: () => void;
}

// Current date for the agreement
const CURRENT_DATE = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

export default function PrivacyPage({ onClose }: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <div>
              <h1 className="text-lg font-semibold text-white">Privacy Policy</h1>
              <p className="text-xs text-slate-400">Conferly • Mathonsi Tech Creations (PTY) LTD</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Last Updated Banner */}
        <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 mb-8">
          <p className="text-sm text-green-200">
            <strong>Last Updated:</strong> {CURRENT_DATE}
          </p>
          <p className="text-xs text-green-300/70 mt-1">
            This policy describes how we collect, use, and protect your information.
          </p>
        </div>

        {/* Introduction */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            1. Introduction
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              Mathonsi Tech Creations (PTY) LTD ("we", "us", or "our") operates Conferly, a video conferencing 
              platform. This Privacy Policy explains how we collect, use, disclose, and safeguard 
              your information when you use our service.
            </p>
            <p className="text-slate-300">
              By using Conferly, you consent to the collection and use of information in 
              accordance with this policy.
            </p>
          </div>
        </section>

        {/* Information We Collect */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            2. Information We Collect
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium text-white mb-3">2.1 Personal Information</h3>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li>Name and display name</li>
              <li>Email address</li>
              <li>Profile information</li>
              <li>Account credentials</li>
              <li>Payment information (processed securely by third parties)</li>
            </ul>

            <h3 className="text-lg font-medium text-white mb-3">2.2 Usage Data</h3>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li>Meeting participation data</li>
              <li>Features used and duration</li>
              <li>Device and connection information</li>
              <li>IP address and browser type</li>
              <li>Operating system information</li>
            </ul>

            <h3 className="text-lg font-medium text-white mb-3">2.3 Meeting Data</h3>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li>Audio and video recordings (when enabled)</li>
              <li>Transcriptions and captions</li>
              <li>Chat messages</li>
              <li>Screen share content</li>
            </ul>
          </div>
        </section>

        {/* How We Use Information */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            3. How We Use Your Information
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              We use your information to:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li>Provide and maintain our services</li>
              <li>Process your account registration</li>
              <li>Authenticate your access</li>
              <li>Improve and develop new features</li>
              <li>Send important account and service notifications</li>
              <li>Provide customer support</li>
              <li>Process payments and subscriptions</li>
              <li>Comply with legal obligations</li>
            </ul>
          </div>
        </section>

        {/* Information Sharing */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            4. Information Sharing
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li><strong>Service providers:</strong> Companies that help us operate (hosting, payments, analytics)</li>
              <li><strong>Meeting hosts:</strong> Other participants in meetings you join</li>
              <li><strong>Legal authorities:</strong> When required by law or to protect rights</li>
            </ul>
            <p className="text-slate-300">
              We do <strong>not</strong> sell your personal information to third parties.
            </p>
          </div>
        </section>

        {/* Data Security */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            5. Data Security
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              We implement appropriate technical and organizational measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication</li>
              <li>Regular security assessments</li>
              <li>Access controls and monitoring</li>
              <li>Secure data storage</li>
            </ul>
          </div>
        </section>

        {/* Data Retention */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            6. Data Retention
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              We retain your information for as long as your account is active or as needed to provide services:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li>Account data: While account is active + 2 years after deletion</li>
              <li>Meeting recordings: As per your plan limits</li>
              <li>Usage logs: 12 months</li>
              <li>Financial records: As required by law (typically 5 years)</li>
            </ul>
          </div>
        </section>

        {/* Your Rights */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            7. Your Rights
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              Depending on your location, you may have rights including:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li><strong>Access:</strong> Request a copy of your data</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Request transfer of your data</li>
              <li><strong>Opt-out:</strong> Object to certain processing</li>
            </ul>
            <p className="text-slate-300">
              To exercise these rights, contact us at support@conferly.site.
            </p>
          </div>
        </section>

        {/* Cookies */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            8. Cookies and Tracking
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              We use cookies and similar tracking technologies:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li>Essential cookies for authentication and security</li>
              <li>Analytics cookies to understand usage</li>
              <li>Preference cookies to remember settings</li>
            </ul>
            <p className="text-slate-300 mt-4">
              You can control cookies through your browser settings.
            </p>
          </div>
        </section>

        {/* Third Party Services */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            9. Third-Party Services
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              Our service integrates with third-party services:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li>Cloudflare: CDN and security</li>
              <li>Supabase: Database and authentication</li>
              <li>LiveKit: Video conferencing infrastructure</li>
              <li>Payment processors: Stripe/Peach Payments</li>
              <li>Analytics providers</li>
            </ul>
            <p className="text-slate-300 mt-4">
              Each third party has their own privacy policy governing their data practices.
            </p>
          </div>
        </section>

        {/* Children's Privacy */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            10. Children's Privacy
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300">
              Our service is not intended for children under 18. We do not knowingly collect 
              information from children. If you become aware that a child has provided us with 
              information, please contact us.
            </p>
          </div>
        </section>

        {/* Changes to Privacy Policy */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            11. Changes to This Policy
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              We may update this policy periodically. We will notify you of material changes 
              by posting the new policy on this page and updating the "Last Updated" date.
            </p>
            <p className="text-slate-300">
              Your continued use after such changes constitutes acceptance.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            12. Contact Us
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-2">
              If you have questions about this policy, contact us:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li><strong>Email:</strong> support@conferly.site</li>
              <li><strong>Website:</strong> www.conferly.site</li>
              <li><strong>Company:</strong> Mathonsi Tech Creations (PTY) LTD</li>
            </ul>
          </div>
        </section>

        {/* Print Button */}
        <div className="flex justify-center gap-4 pt-8 border-t border-slate-800">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Privacy Policy
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Mathonsi Tech Creations (PTY) LTD. All rights reserved.</p>
          <p className="mt-2">
            <a href="#/privacy" className="text-blue-400 hover:underline">Privacy Policy</a>
            {' • '}
            <a href="#/terms" className="text-blue-400 hover:underline">Terms of Service</a>
          </p>
        </div>
      </footer>
    </div>
  );
}