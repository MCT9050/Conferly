import { Code, Play, ArrowLeft } from 'lucide-react';

const topics = [
  { id: 'web-dev', name: 'Web Development', status: 'available', lessons: 10 },
  { id: 'python', name: 'Python Programming', status: 'available', lessons: 8 },
  { id: 'digital-literacy', name: 'Digital Literacy', status: 'available', lessons: 5 },
  { id: 'data-science', name: 'Data Science', status: 'locked', lessons: 6 },
  { id: 'ai-basics', name: 'AI Basics', status: 'locked', lessons: 4 },
];

export default function TechLearnPage({ onClose }: { onClose?: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={onClose} className="mb-8 text-slate-400 hover:text-white flex items-center gap-2">
          ← Back to Learn
        </button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Code className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Technology</h1>
            <p className="text-slate-400">Grades 7-12 • 15 sessions</p>
          </div>
        </div>

        <p className="text-slate-300 mb-8">
          Learn to code with Python, build websites, and understand the digital world. 
          Perfect for aspiring developers and tech enthusiasts.
        </p>

        <h2 className="text-xl font-semibold mb-4">Topics</h2>
        <div className="space-y-3">
          {topics.map(topic => (
            <div
              key={topic.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                topic.status === 'available' 
                  ? 'bg-slate-900/50 border-slate-800 hover:border-blue-500/50 cursor-pointer' 
                  : 'bg-slate-900/30 border-slate-800/50 opacity-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  topic.status === 'available' ? 'bg-slate-800' : 'bg-slate-800/50'
                }`}>
                  {topic.status === 'available' ? (
                    <Play className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Code className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium">{topic.name}</h3>
                  <p className="text-sm text-slate-500">{topic.lessons} lessons</p>
                </div>
              </div>
              {topic.status === 'available' ? (
                <span className="text-blue-400">Continue →</span>
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