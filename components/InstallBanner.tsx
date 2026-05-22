"use client";

import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';

interface InstallBannerProps {
  show: boolean;
  isIOS: boolean;
  canInstallNatively: boolean;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}

export default function InstallBanner({ show, isIOS, canInstallNatively, onInstall, onDismiss }: InstallBannerProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-lg mx-auto glass rounded-2xl p-5 shadow-2xl border border-slate-700/30 space-y-4">
        <div className="flex items-start gap-4">
          <img src="/icons/icon-192.png" alt="Conferly" className="w-12 h-12 rounded-xl shadow-lg shrink-0 object-cover" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">Install Conferly</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Add Conferly to your home screen for instant access — no app store needed. Works like a native app.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {canInstallNatively ? (
          /* Android / Desktop Chrome — native install prompt */
          <button
            onClick={onInstall}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg glow-blue"
          >
            <Download className="w-5 h-5" />
            Install App
          </button>
        ) : isIOS ? (
          /* iOS — manual instructions */
          <div className="space-y-3">
            <p className="text-xs text-slate-400 font-medium">On iPhone / iPad:</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 text-sm text-slate-300">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">1</span>
                Tap
                <Share className="w-4 h-4 text-blue-400" />
                Share
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 text-sm text-slate-300">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">2</span>
                <PlusSquare className="w-4 h-4 text-blue-400" />
                Add to Home
              </div>
            </div>
          </div>
        ) : (
          /* Fallback — generic instructions */
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/40 text-xs text-slate-400">
            <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Open your browser menu and select "Add to Home Screen" or "Install App"</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 text-[10px] text-slate-600">
          <span>No app store required</span>
          <span>•</span>
          <span>Under 1 MB</span>
          <span>•</span>
          <span>Works offline</span>
        </div>
      </div>
    </div>
  );
}
