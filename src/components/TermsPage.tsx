import { useState } from 'react';
import { ArrowLeft, Printer, ExternalLink } from 'lucide-react';
import Logo from './Logo';

interface TermsPageProps {
  onClose?: () => void;
}

// Current date for the agreement
const CURRENT_DATE = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

export default function TermsPage({ onClose }: TermsPageProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <div>
              <h1 className="text-lg font-semibold text-white">Terms and Conditions</h1>
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
        <div className="bg-blue-900/30 border border-blue-800 rounded-xl p-4 mb-8">
          <p className="text-sm text-blue-200">
            <strong>Last Updated:</strong> {CURRENT_DATE}
          </p>
          <p className="text-xs text-blue-300/70 mt-1">
            Please read these Terms and Conditions carefully before using Conferly.
          </p>
        </div>

        {/* Company Information */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            1. Company Information
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-2">
              <strong>Conferly</strong> is a product of <strong>Mathonsi Tech Creations (PTY) LTD</strong>, 
              a registered company in South Africa.
            </p>
            <p className="text-slate-300 mb-2">
              <strong>Company Details:</strong>
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li><strong>Company Name:</strong> Mathonsi Tech Creations (PTY) LTD</li>
              <li><strong>Registration Number:</strong> [To be added]</li>
              <li><strong>Registered Address:</strong> [To be added]</li>
              <li><strong>Email:</strong> support@conferly.site</li>
              <li><strong>Website:</strong> www.conferly.site</li>
            </ul>
            <p className="text-slate-300 mt-4">
              Conferly is a subsidiary of Mathonsi Tech Creations (PTY) LTD, operating under the 
              parent company's governance and legal framework.
            </p>
          </div>
        </section>

        {/* User Service Agreement */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            2. User Service Agreement
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium text-white mb-3">2.1 Acceptance of Terms</h3>
            <p className="text-slate-300 mb-4">
              By creating an account, signing up, or accessing Conferly in any way, you acknowledge 
              that you have read, understood, and agree to be bound by these Terms and Conditions 
              and our <a href="#/privacy" className="text-blue-400 hover:underline">Privacy Policy</a>. 
              If you do not agree to these terms, you may not use our service.
            </p>

            <h3 className="text-lg font-medium text-white mb-3">2.2 Account Registration</h3>
            <p className="text-slate-300 mb-4">
              To use Conferly, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Be at least 18 years old or the age of legal majority in your jurisdiction</li>
            </ul>

            <h3 className="text-lg font-medium text-white mb-3">2.3 User Responsibilities</h3>
            <p className="text-slate-300 mb-4">
              As a user of Conferly, you agree to:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li>Use the service only for lawful purposes</li>
              <li>Not harass, abuse, or harm other users</li>
              <li>Not share inappropriate, offensive, or illegal content</li>
              <li>Not attempt to gain unauthorized access to the service</li>
              <li>Not interfere with the proper functioning of the service</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>

            <h3 className="text-lg font-medium text-white mb-3">2.4 User Content</h3>
            <p className="text-slate-300 mb-4">
              You retain ownership of any content you submit to Conferly ("User Content"). By 
              submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license 
              to use, display, and reproduce your content solely for providing the service to you.
            </p>

            <h3 className="text-lg font-medium text-white mb-3">2.5 Account Termination</h3>
            <p className="text-slate-300 mb-4">
              We reserve the right to suspend or terminate your account at any time for any reason, 
              including but not limited to violation of these terms, inactivity, or non-payment 
              of fees. You may also delete your account at any time through your account settings.
            </p>
          </div>
        </section>

        {/* Service Description */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            3. Service Description
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              Conferly is a video conferencing and collaboration platform that enables users to:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li>Host and join video meetings</li>
              <li>Share screens and collaborate on documents</li>
              <li>Record meetings (subject to plan limits)</li>
              <li>Use real-time transcription and translation</li>
              <li>Access meeting analytics</li>
              <li>Use additional features based on subscription tier</li>
            </ul>
            <p className="text-slate-300">
              We strive to provide a reliable service but do not guarantee uninterrupted or error-free 
              operation. The service is provided "as is" without warranties of any kind.
            </p>
          </div>
        </section>

        {/* Subscription and Payments */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            4. Subscription and Payments
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium text-white mb-3">4.1 Subscription Plans</h3>
            <p className="text-slate-300 mb-4">
              Conferly offers various subscription plans with different features and limits. 
              See our <a href="#/pricing" className="text-blue-400 hover:underline">Pricing Page</a> for current plan details.
            </p>

            <h3 className="text-lg font-medium text-white mb-3">4.2 Payment Terms</h3>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 mb-4">
              <li>Payments are processed in South African Rand (ZAR) unless otherwise specified</li>
              <li>Subscriptions renew automatically unless cancelled</li>
              <li>All fees are non-refundable unless required by law</li>
              <li>Prices are subject to change with 30 days notice</li>
            </ul>

            <h3 className="text-lg font-medium text-white mb-3">4.3 Free Tier</h3>
            <p className="text-slate-300">
              Free tier users get limited meeting minutes and features. We reserve the right to 
              modify free tier limits at any time. Free tier meetings may include watermarks or 
              other limitations at our discretion.
            </p>
          </div>
        </section>

        {/* Privacy and Data */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            5. Privacy and Data Protection
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              Your privacy is important to us. Our <a href="#/privacy" className="text-blue-400 hover:underline">Privacy Policy</a> 
              describes how we collect, use, and protect your information.
            </p>
            <p className="text-slate-300 mb-4">
              By using Conferly, you consent to the collection and processing of your personal data 
              as described in our Privacy Policy. This includes:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li>Account and profile information</li>
              <li>Meeting recordings and transcripts (when enabled)</li>
              <li>Usage data and analytics</li>
              <li>Device and connection information</li>
            </ul>
          </div>
        </section>

        {/* Intellectual Property */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            6. Intellectual Property
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              All rights, title, and interest in Conferly, including all content, features, 
              and functionality, are owned by Mathonsi Tech Creations (PTY) LTD and its 
              licensors. You may not copy, modify, distribute, sell, or lease any part of 
              our service without our prior written consent.
            </p>
            <p className="text-slate-300">
              "Conferly" and the Conferly logo are trademarks of Mathonsi Tech Creations (PTY) LTD. 
              All other trademarks are the property of their respective owners.
            </p>
          </div>
        </section>

        {/* Limitation of Liability */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            7. Limitation of Liability
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              To the maximum extent permitted by law, Mathonsi Tech Creations (PTY) LTD and its 
              affiliates shall not be liable for any indirect, incidental, special, consequential, 
              or punitive damages, including without limitation loss of profits, data, or 
              business opportunities.
            </p>
            <p className="text-slate-300">
              Our total liability for any claims arising from these terms or your use of 
              Conferly shall not exceed the amount you paid us in the 12 months prior to the 
              claim.
            </p>
          </div>
        </section>

        {/* Disclaimer of Warranties */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            8. Disclaimer of Warranties
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
              WHETHER EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED 
              TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND 
              NON-INFRINGEMENT.
            </p>
            <p className="text-slate-300">
              We do not warrant that the service will be uninterrupted, error-free, or 
              completely secure. You use the service at your own risk.
            </p>
          </div>
        </section>

        {/* Indemnification */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            9. Indemnification
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300">
              You agree to indemnify, defend, and hold harmless Mathonsi Tech Creations (PTY) LTD 
              and its officers, directors, employees, and agents from any claims, damages, losses, 
              or expenses (including reasonable attorneys' fees) arising out of your use of the 
              service, your violation of these terms, or your User Content.
            </p>
          </div>
        </section>

        {/* Governing Law */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            10. Governing Law and Dispute Resolution
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              These terms shall be governed by and construed in accordance with the laws 
              of South Africa, without regard to its conflict of law provisions.
            </p>
            <p className="text-slate-300 mb-4">
              Any disputes arising from these terms shall first be resolved through good 
              faith negotiation. If resolution cannot be reached within 30 days, disputes 
              shall be submitted to the exclusive jurisdiction of the courts of South Africa.
            </p>
            <p className="text-slate-300">
              For consumers in South Africa, nothing in these terms limits any statutory 
              rights that cannot be excluded by agreement.
            </p>
          </div>
        </section>

        {/* Changes to Terms */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            11. Changes to These Terms
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-4">
              We reserve the right to modify these terms at any time. We will provide notice 
              of material changes by posting the updated terms on our website and updating 
              the "Last Updated" date above.
            </p>
            <p className="text-slate-300 mb-4">
              Your continued use of Conferly after such changes constitutes acceptance of the new 
              terms. If you do not agree to the new terms, you must stop using the service.
            </p>
            <p className="text-slate-300">
              We encourage you to review these terms periodically for any changes.
            </p>
          </div>
        </section>

        {/* Contact Information */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            12. Contact Information
          </h2>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-300 mb-2">
              If you have any questions about these Terms and Conditions, please contact us:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
              <li><strong>Email:</strong> support@conferly.site</li>
              <li><strong>Website:</strong> www.conferly.site</li>
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
            Print Terms
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