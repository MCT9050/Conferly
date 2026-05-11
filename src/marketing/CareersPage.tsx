export default function CareersPage({ onClose }: { onClose?: () => void }) {
  const roles = [
    { title: 'Senior Frontend Engineer', location: 'Remote (Africa)', type: 'Full-time' },
    { title: 'Backend Engineer', location: 'Remote (Africa)', type: 'Full-time' },
    { title: 'AI/ML Engineer', location: 'Remote', type: 'Full-time' },
    { title: 'DevOps Engineer', location: 'Remote', type: 'Full-time' },
    { title: 'Product Designer', location: 'Remote (Africa)', type: 'Full-time' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={onClose} className="mb-8 text-slate-400 hover:text-white flex items-center gap-2">
          ← Back to site
        </button>
        
        <h1 className="text-4xl font-bold mb-4">Careers</h1>
        <p className="text-xl text-slate-400 mb-8">Join us in building the future of inclusive communication.</p>
        
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-8">
          <p className="text-amber-400 font-semibold">We're hiring!</p>
          <p className="text-slate-300 text-sm">Remote-first, Africa-focused, impact-driven.</p>
        </div>

        <h2 className="text-xl font-semibold mb-4">Open Positions</h2>
        <div className="space-y-3">
          {roles.map(role => (
            <div key={role.title} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-amber-500/50 transition-colors">
              <div>
                <p className="font-medium">{role.title}</p>
                <p className="text-sm text-slate-400">{role.location} · {role.type}</p>
              </div>
              <span className="text-amber-400">→</span>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-slate-900/50 rounded-xl border border-slate-800">
          <h3 className="font-semibold mb-2">Why Join Conferly?</h3>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Remote-first culture</li>
            <li>• Competitive compensation</li>
            <li>• Equity opportunities</li>
            <li>• Annual team retreats</li>
            <li>• Learning budget</li>
          </ul>
        </div>
      </div>
    </div>
  );
}