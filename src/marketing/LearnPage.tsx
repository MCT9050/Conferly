import { Search, BookOpen, Video, Languages, Calculator, FlaskConical, Code, ArrowRight } from 'lucide-react';

const subjects = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    icon: Calculator,
    color: 'from-amber-500 to-orange-500',
    description: 'Algebra, Geometry, Calculus & more',
    topics: ['Algebra', 'Geometry', 'Trigonometry', 'Calculus', 'Statistics'],
    gradeRange: 'Grades 7-12',
    sessions: 12,
  },
  {
    id: 'science',
    name: 'Science',
    icon: FlaskConical,
    color: 'from-green-500 to-emerald-500',
    description: 'Physics, Chemistry, Biology',
    topics: ['Physics', 'Chemistry', 'Biology', 'Life Sciences', 'Physical Sciences'],
    gradeRange: 'Grades 7-12',
    sessions: 8,
  },
  {
    id: 'technology',
    name: 'Technology',
    icon: Code,
    color: 'from-blue-500 to-cyan-500',
    description: 'Coding, Digital Skills, IT',
    topics: ['Web Development', 'Python', 'Digital Literacy', 'Data Science', 'AI Basics'],
    gradeRange: 'Grades 7-12',
    sessions: 15,
  },
  {
    id: 'languages',
    name: 'Languages',
    icon: Languages,
    color: 'from-purple-500 to-pink-500',
    description: 'English, Afrikaans, Zulu, Sotho',
    topics: ['English', 'Zulu', 'Sotho', 'Afrikaans', 'Creative Writing'],
    gradeRange: 'Grades 7-12',
    sessions: 20,
  },
];

const recentSessions = [
  { title: 'Introduction to Algebra', subject: 'Mathematics', duration: '45 min', date: 'Today' },
  { title: 'Newton\'s Laws of Motion', subject: 'Science', duration: '60 min', date: 'Yesterday' },
  { title: 'HTML Basics', subject: 'Technology', duration: '30 min', date: '2 days ago' },
];

export default function LearnPage({ onClose }: { onClose?: () => void }) {
  const handleSubjectClick = (subjectId: string) => {
    window.history.pushState({}, 'Learn', '/learn/' + subjectId); window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(251,191,36,0.1),transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <button onClick={onClose} className="mb-6 text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
            ← Back to site
          </button>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Learn</h1>
              <p className="text-slate-400">Your personalized learning hub</p>
            </div>
          </div>
          <p className="text-slate-300 max-w-2xl">
            Access structured learning resources, join tutoring sessions, and continue your education journey. 
            Perfect for students in Grades 7-12 across South Africa.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <button className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/50 transition-all text-left group">
            <Search className="w-5 h-5 text-amber-400 mb-2" />
            <h3 className="font-semibold mb-1">Find Resources</h3>
            <p className="text-sm text-slate-400">Search worksheets, guides & more</p>
          </button>
          <button className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/50 transition-all text-left group">
            <Video className="w-5 h-5 text-amber-400 mb-2" />
            <h3 className="font-semibold mb-1">Join Live Session</h3>
            <p className="text-sm text-slate-400">Connect with a tutor now</p>
          </button>
          <button className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/50 transition-all text-left group">
            <BookOpen className="w-5 h-5 text-amber-400 mb-2" />
            <h3 className="font-semibold mb-1">My Learning Path</h3>
            <p className="text-sm text-slate-400">Track your progress</p>
          </button>
        </div>

        {/* Subjects Grid */}
        <h2 className="text-xl font-semibold mb-4">Browse by Subject</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {subjects.map(subject => (
            <button
              key={subject.id}
              onClick={() => handleSubjectClick(subject.id)}
              className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-600 transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${subject.color} flex items-center justify-center`}>
                  <subject.icon className="w-7 h-7 text-white" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{subject.name}</h3>
              <p className="text-sm text-slate-400 mb-3">{subject.description}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{subject.gradeRange}</span>
                <span>•</span>
                <span>{subject.sessions} sessions</span>
              </div>
            </button>
          ))}
        </div>

        {/* Recent Sessions */}
        <h2 className="text-xl font-semibold mb-4">Continue Learning</h2>
        <div className="space-y-3 mb-12">
          {recentSessions.map((session, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Video className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-medium">{session.title}</h4>
                  <p className="text-sm text-slate-400">{session.subject} • {session.duration}</p>
                </div>
              </div>
              <span className="text-sm text-slate-500">{session.date}</span>
            </div>
          ))}
        </div>

        {/* AI Tutor Promo */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-amber-400 mb-2">🎓 AI Tutor Mode</h3>
              <p className="text-slate-300 mb-4">
                Stuck on a problem? Ask AI Tutor during any meeting for instant explanations 
                in simple language — available in Zulu, Sotho, English & more.
              </p>
              <button className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-medium text-sm hover:bg-amber-400 transition-colors">
                Try AI Tutor →
              </button>
            </div>
            <div className="hidden sm:block w-24 h-24 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <span className="text-3xl">🤖</span>
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="grid grid-cols-4 gap-4 mt-12 pt-8 border-t border-slate-800">
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">55+</div>
            <div className="text-xs text-slate-500">Topics</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">200+</div>
            <div className="text-xs text-slate-500">Resources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">50+</div>
            <div className="text-xs text-slate-500">Tutors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">5</div>
            <div className="text-xs text-slate-500">Languages</div>
          </div>
        </div>
      </div>
    </div>
  );
}