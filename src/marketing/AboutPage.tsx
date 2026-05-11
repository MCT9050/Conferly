export default function AboutPage({ onClose }: { onClose?: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={onClose} className="mb-8 text-slate-400 hover:text-white flex items-center gap-2">
          ← Back to site
        </button>
        
        <h1 className="text-4xl font-bold mb-6">About Conferly</h1>
        <p className="text-2xl text-amber-400 mb-8">"Ubuntu — I am because we are"</p>
        
        <div className="space-y-6 text-slate-300">
          <p>Conferly is a video conferencing platform built with the African philosophy of Ubuntu at its core. We believe communication should bridge barriers, not create them.</p>
          
          <h2 className="text-xl font-semibold text-white pt-4">Our Mission</h2>
          <p>To make professional video conferencing accessible to every community — regardless of language, location, or technical capability.</p>
          
          <h2 className="text-xl font-semibold text-white pt-4">Why Africa First</h2>
          <p>With over 2,000 languages spoken across Africa, weprioritize real-time translation and accessibility. Our platform supports Zulu, Sotho, Xhosa, and 50+ languages — with more being added regularly.</p>
          
          <h2 className="text-xl font-semibold text-white pt-4">Features</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>HD video conferencing with adaptive quality</li>
            <li>Real-time translation in 50+ languages</li>
            <li>AI-powered meeting summaries</li>
            <li>Password-protected meetings & waiting rooms</li>
            <li>Breakout rooms for team collaboration</li>
            <li>Recording & transcription</li>
          </ul>
        </div>
      </div>
    </div>
  );
}