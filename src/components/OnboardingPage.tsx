import { useState } from 'react';
import {
  User, Building2, ArrowRight, Users, Briefcase,
  ChevronRight, Loader2
} from 'lucide-react';
import Logo from './Logo';
import type { OnboardingData } from '../hooks/useAuth';

interface OnboardingPageProps {
  displayName: string;
  onComplete: (data: OnboardingData) => Promise<{ success: boolean }>;
}

const INDUSTRIES = [
  'Technology', 'Education', 'Healthcare', 'Finance & Banking',
  'Government', 'Consulting', 'Retail & E-commerce', 'Manufacturing',
  'Media & Entertainment', 'Non-profit', 'Legal', 'Other',
];

const SIZES = [
  { label: '1–10', value: 10 },
  { label: '11–50', value: 50 },
  { label: '51–200', value: 200 },
  { label: '201–500', value: 500 },
  { label: '500+', value: 1000 },
];

export default function OnboardingPage({ displayName, onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [userType, setUserType] = useState<'individual' | 'organization' | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgSize, setOrgSize] = useState<number | null>(null);
  const [orgIndustry, setOrgIndustry] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = () => {
    if (!userType) return;
    if (userType === 'individual') {
      handleSubmit();
    } else {
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!userType) return;
    setSubmitting(true);
    await onComplete({
      userType,
      organizationName: orgName.trim() || undefined,
      organizationSize: orgSize || undefined,
      organizationIndustry: orgIndustry || undefined,
    });
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center"><Logo size="xl" /></div>
          <div>
            <h1 className="text-2xl font-bold mt-4">Welcome, {displayName.split(' ')[0]}!</h1>
            <p className="text-sm text-slate-400 mt-1">Let's personalize your experience.</p>
          </div>
          {/* Progress */}
          <div className="flex items-center justify-center gap-2">
            <div className={`w-8 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-blue-500' : 'bg-slate-700'}`} />
            <div className={`w-8 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-blue-500' : 'bg-slate-700'}`} />
          </div>
        </div>

        {/* Step 1: Choose type */}
        {step === 1 && (
          <div className="glass rounded-2xl p-8 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold">How will you use Conferly?</h2>
              <p className="text-xs text-slate-500">This helps us tailor your dashboard and features.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Individual */}
              <button
                onClick={() => setUserType('individual')}
                className={`relative rounded-2xl p-6 text-center space-y-3 transition-all duration-200 border-2 ${
                  userType === 'individual'
                    ? 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10'
                    : 'border-white/5 bg-white/[0.01] hover:border-white/15 hover:bg-white/[0.03]'
                }`}
              >
                {userType === 'individual' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto shadow-lg">
                  <User className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-[15px]">Individual</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">Personal use, freelancers, solo professionals</p>
              </button>

              {/* Organization */}
              <button
                onClick={() => setUserType('organization')}
                className={`relative rounded-2xl p-6 text-center space-y-3 transition-all duration-200 border-2 ${
                  userType === 'organization'
                    ? 'border-purple-500 bg-purple-500/5 shadow-lg shadow-purple-500/10'
                    : 'border-white/5 bg-white/[0.01] hover:border-white/15 hover:bg-white/[0.03]'
                }`}
              >
                {userType === 'organization' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto shadow-lg">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-[15px]">Organization</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">Teams, companies, schools, government</p>
              </button>
            </div>

            <button
              onClick={handleContinue}
              disabled={!userType || submitting}
              className="w-full py-3.5 min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{userType === 'organization' ? 'Continue' : 'Get Started'}<ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}

        {/* Step 2: Organization details */}
        {step === 2 && (
          <div className="glass rounded-2xl p-8 space-y-6">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-lg font-bold">Tell us about your organization</h2>
              <p className="text-xs text-slate-500">We'll customize your workspace accordingly.</p>
            </div>

            <div className="space-y-4">
              {/* Organization name */}
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
                  <Building2 className="w-3.5 h-3.5" /> Organization Name
                </label>
                <input
                  type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Corp, Springfield School"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              {/* Team size */}
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-400 mb-2 font-medium">
                  <Users className="w-3.5 h-3.5" /> Team Size
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {SIZES.map(s => (
                    <button key={s.value} onClick={() => setOrgSize(s.value)}
                      className={`py-2.5 rounded-xl text-xs font-medium transition-all ${
                        orgSize === s.value
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-800/50 text-slate-400 border border-transparent hover:border-white/10'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Industry */}
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-400 mb-2 font-medium">
                  <Briefcase className="w-3.5 h-3.5" /> Industry
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {INDUSTRIES.map(ind => (
                    <button key={ind} onClick={() => setOrgIndustry(ind)}
                      className={`py-2 px-2 rounded-lg text-[11px] font-medium transition-all ${
                        orgIndustry === ind
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-800/50 text-slate-500 border border-transparent hover:text-slate-300 hover:border-white/10'
                      }`}>
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="px-6 py-3.5 min-h-[48px] rounded-xl border border-white/10 text-slate-300 font-medium hover:bg-white/5 transition-all">
                Back
              </button>
              <button onClick={handleSubmit} disabled={!orgName.trim() || submitting}
                className="flex-1 py-3.5 min-h-[48px] rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Launch Conferly<ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-600">You can change this anytime in Settings.</p>
      </div>
    </div>
  );
}
