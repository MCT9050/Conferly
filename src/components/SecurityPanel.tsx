import { useState } from 'react';
import {
  Lock, Unlock, ShieldCheck, DoorOpen, DoorClosed,
  Eye, EyeOff, Check, X, UserPlus, UserMinus, Crown
} from 'lucide-react';
import type { MeetingSecurity, PlanLimits, PlanTier } from '../types';

interface SecurityPanelProps {
  security: MeetingSecurity;
  isHost: boolean;
  limits: PlanLimits;
  planTier: PlanTier;
  onSetPassword: (pwd: string | null) => void;
  onToggleLock: () => void;
  onToggleWaitingRoom: () => void;
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onOpenPricing: () => void;
}

function FeatureGate({ allowed, label, planRequired, onUpgrade }: {
  allowed: boolean; label: string; planRequired: string; onUpgrade: () => void;
}) {
  if (allowed) return null;
  return (
    <button
      onClick={onUpgrade}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
    >
      <Crown className="w-3.5 h-3.5 shrink-0" />
      <span>{label} requires <strong>{planRequired}</strong> plan</span>
    </button>
  );
}

export default function SecurityPanel({
  security, isHost, limits, planTier,
  onSetPassword, onToggleLock, onToggleWaitingRoom,
  onAdmit, onDeny, onOpenPricing,
}: SecurityPanelProps) {
  const [showPwdInput, setShowPwdInput] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleSetPassword = () => {
    onSetPassword(pwdInput.trim() || null);
    setShowPwdInput(false);
    setPwdInput('');
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto">
      {/* Host badge */}
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl ${
        isHost ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-slate-800/40 border border-slate-700/30'
      }`}>
        <Crown className={`w-5 h-5 ${isHost ? 'text-blue-400' : 'text-slate-500'}`} />
        <div>
          <div className={`text-sm font-medium ${isHost ? 'text-blue-400' : 'text-slate-400'}`}>
            {isHost ? 'You are the Host' : 'Participant'}
          </div>
          <div className="text-[10px] text-slate-500">
            {isHost ? 'You can manage security settings' : 'Only the host can change settings'}
          </div>
        </div>
      </div>

      {/* E2E Status */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/15">
        <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
        <div>
          <div className="text-sm font-medium text-green-400">End-to-End Encrypted</div>
          <div className="text-[10px] text-green-400/60">All media streams are encrypted in transit</div>
        </div>
      </div>

      {/* Meeting Password */}
      <div className="glass-light rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lock className="w-4 h-4 text-slate-400" />
            Meeting Password
          </div>
          {security.password ? (
            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-[10px] text-green-400 font-medium">Active</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-[10px] text-slate-500 font-medium">Off</span>
          )}
        </div>

        {!limits.meetingPassword ? (
          <FeatureGate allowed={false} label="Meeting passwords" planRequired="Pro" onUpgrade={onOpenPricing} />
        ) : isHost ? (
          <>
            {security.password && !showPwdInput && (
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-slate-800/60 text-xs font-mono text-slate-300">
                  {showPwd ? security.password : '••••••••'}
                </code>
                <button onClick={() => setShowPwd(!showPwd)} className="p-1.5 text-slate-400 hover:text-white">
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => onSetPassword(null)} className="p-1.5 text-red-400 hover:text-red-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {showPwdInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pwdInput}
                  onChange={e => setPwdInput(e.target.value)}
                  placeholder="Enter password"
                  onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-600/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40"
                />
                <button onClick={handleSetPassword} className="p-1.5 text-green-400 hover:text-green-300">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setShowPwdInput(false); setPwdInput(''); }} className="p-1.5 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : !security.password && (
              <button
                onClick={() => setShowPwdInput(true)}
                className="w-full py-2 rounded-lg bg-slate-800/40 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              >
                + Set Password
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">
            {security.password ? 'This meeting is password-protected.' : 'No password set.'}
          </p>
        )}
      </div>

      {/* Meeting Lock */}
      <div className="glass-light rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {security.isLocked ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-slate-400" />}
            Meeting Lock
          </div>
          {!limits.meetingLock ? (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] text-amber-400 font-medium">Pro+</span>
          ) : isHost ? (
            <button
              onClick={onToggleLock}
              className={`relative w-10 h-5.5 rounded-full transition-colors ${security.isLocked ? 'bg-red-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${security.isLocked ? 'left-5' : 'left-0.5'}`} />
            </button>
          ) : null}
        </div>
        {!limits.meetingLock ? (
          <FeatureGate allowed={false} label="Meeting lock" planRequired="Pro" onUpgrade={onOpenPricing} />
        ) : (
          <p className="text-xs text-slate-500">
            {security.isLocked ? 'Meeting is locked. No one else can join.' : 'Meeting is open. Anyone with the code can join.'}
          </p>
        )}
      </div>

      {/* Waiting Room */}
      <div className="glass-light rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {security.waitingRoomEnabled ? <DoorClosed className="w-4 h-4 text-purple-400" /> : <DoorOpen className="w-4 h-4 text-slate-400" />}
            Waiting Room
          </div>
          {!limits.waitingRoom ? (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] text-amber-400 font-medium">Pro+</span>
          ) : isHost ? (
            <button
              onClick={onToggleWaitingRoom}
              className={`relative w-10 h-5.5 rounded-full transition-colors ${security.waitingRoomEnabled ? 'bg-purple-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${security.waitingRoomEnabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          ) : null}
        </div>

        {!limits.waitingRoom ? (
          <FeatureGate allowed={false} label="Waiting room" planRequired="Pro" onUpgrade={onOpenPricing} />
        ) : (
          <>
            <p className="text-xs text-slate-500">
              {security.waitingRoomEnabled ? 'New joiners must be approved by the host.' : 'Joiners enter the meeting directly.'}
            </p>

            {/* Waiting list */}
            {security.waitingRoomEnabled && security.waitingRoom.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-700/30">
                <div className="text-xs text-slate-400 font-medium">{security.waitingRoom.length} waiting</div>
                {security.waitingRoom.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-xs font-bold">
                      {entry.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{entry.name}</div>
                      <div className="text-[10px] text-slate-500">
                        Waiting {Math.floor((Date.now() - entry.requestedAt.getTime()) / 60000)}m
                      </div>
                    </div>
                    {isHost && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onAdmit(entry.id)} className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30">
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDeny(entry.id)} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30">
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Plan info */}
      <button
        onClick={onOpenPricing}
        className="glass-light rounded-xl p-4 flex items-center gap-3 text-left hover:border-slate-600/40 transition-all w-full"
      >
        <Crown className="w-5 h-5 text-amber-400 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium">
            {planTier.charAt(0).toUpperCase() + planTier.slice(1)} Plan
          </div>
          <div className="text-[10px] text-slate-500">
            {planTier === 'trial' ? 'Upgrade for more security features' : 'Manage your subscription'}
          </div>
        </div>
      </button>
    </div>
  );
}
