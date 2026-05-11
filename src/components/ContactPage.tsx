import { useState } from 'react';

export default function ContactPage({ onClose }: { onClose?: () => void }) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={onClose} className="mb-8 text-slate-400 hover:text-white flex items-center gap-2">
          ← Back to site
        </button>
        <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
        <p className="text-slate-400 text-lg mb-8">We'd love to hear from you.</p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm text-slate-400 mb-2">Name</label>
              <input id="name" name="name" required type="text" className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-500" placeholder="Your name" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm text-slate-400 mb-2">Email</label>
              <input id="email" name="email" required type="email" className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-500" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm text-slate-400 mb-2">Message</label>
              <textarea id="message" name="message" required rows={5} className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-amber-500" placeholder="How can we help?" />
            </div>
            <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold">
              Send Message
            </button>
          </form>
        ) : (
          <div className="p-6 bg-green-500/10 rounded-xl border border-green-500/20 text-center">
            <p className="text-green-400 font-semibold mb-2">Message sent!</p>
            <p className="text-slate-400 text-sm">We'll get back to you within 24 hours.</p>
          </div>
        )}
      </div>
    </div>
  );
}