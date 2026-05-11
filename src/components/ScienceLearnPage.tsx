import { FlaskConical, Play, ArrowLeft } from 'lucide-react';

const topics = [
  { id: 'physics', name: 'Physics', status: 'available', lessons: 8 },
  { id: 'chemistry', name: 'Chemistry', status: 'available', lessons: 6 },
  { id: 'biology', name: 'Biology', status: 'available', lessons: 7 },
  { id: 'life-sciences', name: 'Life Sciences', status: 'locked', lessons: 5 },
  { id: 'physical-sciences', name: 'Physical Sciences', status: 'locked', lessons: 6 },
];

export default function ScienceLearnPage({ onClose }: { onClose?: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={onClose} className="mb-8 text-slate-400 hover:text-white flex items-center gap-2">
          ← Back to Learn
        </button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <FlaskConical className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Science</h1>
            <p className="text-slate-400">Grades 7-12 • 8 sessions</p>
          </div>
        </div>

        <p className="text-slate-300 mb-8">
          Explore physics, chemistry and biology through interactive sessions. 
          Understand the natural world through hands-on learning.
        </p>

        <h2 className="text-xl font-semibold mb-4">Topics</h2>
        <div className="space-y-3">
          {topics.map(topic => (
            <div
              key={topic.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                topic.status === 'available' 
                  ? 'bg-slate-900/50 border-slate-800 hover:border-green-500/50 cursor-pointer' 
                  : 'bg-slate-900/30 border-slate-800/50 opacity-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  topic.status === 'available' ? 'bg-slate-800' : 'bg-slate-800/50'
                }`}>
                  {topic.status === 'available' ? (
                    <Play className="w-4 h-4 text-green-400" />
                  ) : (
                    <FlaskConical className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium">{topic.name}</h3>
                  <p className="text-sm text-slate-500">{topic.lessons} lessons</p>
                </div>
              </div>
              {topic.status === 'available' ? (
                <span className="text-green-400">Continue →</span>
              ) : (
                <span className="text-slate-600">🔒 Locked</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}