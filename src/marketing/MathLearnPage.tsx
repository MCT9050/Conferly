import { Calculator, Play, ArrowLeft, FileText, CheckCircle } from 'lucide-react';

const topics = [
  { id: 'algebra', name: 'Algebra', status: 'available', lessons: 8 },
  { id: 'geometry', name: 'Geometry', status: 'available', lessons: 6 },
  { id: 'trigonometry', name: 'Trigonometry', status: 'available', lessons: 5 },
  { id: 'calculus', name: 'Calculus', status: 'locked', lessons: 4 },
  { id: 'statistics', name: 'Statistics', status: 'locked', lessons: 5 },
];

export default function MathLearnPage({ onClose }: { onClose?: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={onClose} className="mb-8 text-slate-400 hover:text-white flex items-center gap-2">
          ← Back to Learn
        </button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Mathematics</h1>
            <p className="text-slate-400">Grades 7-12 • 12 sessions</p>
          </div>
        </div>

        <p className="text-slate-300 mb-8">
          Master algebra, geometry, trigonometry and more. Follow structured paths from basic equations 
          to advanced calculus concepts.
        </p>

        <h2 className="text-xl font-semibold mb-4">Topics</h2>
        <div className="space-y-3 mb-8">
          {topics.map(topic => (
            <div
              key={topic.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                topic.status === 'available' 
                  ? 'bg-slate-900/50 border-slate-800 hover:border-amber-500/50 cursor-pointer' 
                  : 'bg-slate-900/30 border-slate-800/50 opacity-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  topic.status === 'available' ? 'bg-slate-800' : 'bg-slate-800/50'
                }`}>
                  {topic.status === 'available' ? (
                    <Play className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Calculator className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium">{topic.name}</h3>
                  <p className="text-sm text-slate-500">{topic.lessons} lessons</p>
                </div>
              </div>
              {topic.status === 'available' ? (
                <span className="text-amber-400">Continue →</span>
              ) : (
                <span className="text-slate-600">🔒 Locked</span>
              )}
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold mb-4">Your Progress</h2>
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span>Algebra Basics</span>
            <span className="text-amber-400">60%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-[60%] bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" />
          </div>
          <p className="text-sm text-slate-500 mt-4">Next: Linear Equations in Two Variables</p>
        </div>
      </div>
    </div>
  );
}