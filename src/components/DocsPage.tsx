import { useEffect } from 'react';

export default function DocsPage({ onClose }: { onClose?: () => void }) {
  useEffect(() => {
    document.title = 'Documentation — Conferly';
  }, []);

  const content = [
    { title: 'Getting Started', items: ['Create an account', 'Start your first meeting', 'Invite participants'] },
    { title: 'Features', items: ['Video & audio conferencing', 'Real-time translation', 'AI meeting summaries'] },
    { title: 'Security', items: ['End-to-end encryption', 'Password-protected meetings', 'Waiting room'] },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={onClose} className="mb-8 text-slate-400 hover:text-white flex items-center gap-2">
          ← Back to site
        </button>
        <h1 className="text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-slate-400 text-lg mb-12">Everything you need to know about Conferly.</p>
        
        <div className="grid md:grid-cols-3 gap-8">
          {content.map(section => (
            <div key={section.title} className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
              <h3 className="text-lg font-semibold mb-4 text-amber-400">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map(item => (
                  <li key={item} className="text-slate-300 text-sm">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <h3 className="font-semibold mb-2">Need help?</h3>
          <p className="text-slate-400 text-sm">Contact support@conferly.site for assistance.</p>
        </div>
      </div>
    </div>
  );
}