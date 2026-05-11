import { Languages, Play, ArrowLeft } from 'lucide-react';

const topics = [
  { id: 'english', name: 'English', status: 'available', lessons: 12 },
  { id: 'zulu', name: 'Zulu (isiZulu)', status: 'available', lessons: 8 },
  { id: 'sotho', name: 'Sotho (sesotho)', status: 'available', lessons: 6 },
  { id: 'afrikaans', name: 'Afrikaans', status: 'available', lessons: 6 },
  { id: 'creative-writing', name: 'Creative Writing', status: 'locked', lessons: 4 },
];

export default function LanguagesLearnPage({ onClose }: { onClose?: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={onClose} className="mb-8 text-slate-400 hover:text-white flex items-center gap-2">
          ← Back to Learn
        </button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Languages className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Languages</h1>
            <p className="text-slate-400">Grades 7-12 • 20 sessions</p>
          </div>
        </div>

        <p className="text-slate-300 mb-8">
          Master English, Zulu, Sotho, and Afrikaans. Our multilingual approach helps 
          you learn in your home language with translation support.
        </p>

        <h2 className="text-xl font-semibold mb-4">Topics</h2>
        <div className="space-y-3">
          {topics.map(topic => (
            <div
              key={topic.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                topic.status === 'available' 
                  ? 'bg-slate-900/50 border-slate-800 hover:border-purple-500/50 cursor-pointer' 
                  : 'bg-slate-900/30 border-slate-800/50 opacity-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  topic.status === 'available' ? 'bg-slate-800' : 'bg-slate-800/50'
                }`}>
                  {topic.status === 'available' ? (
                    <Play className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Languages className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium">{topic.name}</h3>
                  <p className="text-sm text-slate-500">{topic.lessons} lessons</p>
                </div>
              </div>
              {topic.status === 'available' ? (
                <span className="text-purple-400">Continue →</span>
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