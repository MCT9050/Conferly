"use client";

import { useState, useRef } from 'react';
import {
  LogOut, User, ChevronDown, Edit3, Check, X, WifiOff
} from 'lucide-react';
import type { UserProfile } from '../hooks/useAuth';
import { useClickOutside } from '../hooks/useClickOutside';

interface ProfileMenuProps {
  profile: UserProfile;
  isOfflineMode: boolean;
  onSignOut?: () => void;
  onUpdateName: (name: string) => Promise<{ success: boolean }>;
}

import { signOut as clientSignOut } from '../lib/clientAuth';

export default function ProfileMenu({ profile, isOfflineMode, onSignOut, onUpdateName }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.displayName);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useClickOutside(menuRef, () => {
    setIsOpen(false);
    setIsEditing(false);
  });

  const handleSaveName = async () => {
    if (editName.trim() && editName.trim() !== profile.displayName) {
      await onUpdateName(editName.trim());
    }
    setIsEditing(false);
  };

  const initials = profile.displayName
    .split(' ')
    .map(w => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold shadow-md">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-white leading-tight">{profile.displayName}</div>
          <div className="text-[10px] text-slate-500 leading-tight">{profile.email}</div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-72 glass rounded-2xl shadow-2xl border border-slate-700/30 overflow-hidden z-50">
          {/* Profile header */}
          <div className="px-5 py-4 border-b border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-lg font-bold shadow-lg shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                      autoFocus
                      className="flex-1 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-600/50 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    />
                    <button onClick={handleSaveName} className="p-1 text-green-400 hover:text-green-300">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setIsEditing(false); setEditName(profile.displayName); }} className="p-1 text-slate-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate">{profile.displayName}</span>
                    <button
                      onClick={() => { setIsEditing(true); setEditName(profile.displayName); }}
                      className="p-0.5 text-slate-500 hover:text-white transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-500 truncate mt-0.5">{profile.email}</p>
              </div>
            </div>

            {isOfflineMode && (
              <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 text-xs text-amber-400">
                <WifiOff className="w-3 h-3 shrink-0" />
                Offline mode — data stored locally
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={() => { setIsEditing(true); setEditName(profile.displayName); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              Edit Profile
            </button>
            <button
              onClick={() => { (onSignOut ?? clientSignOut)(); setIsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-800/50">
            <p className="text-[10px] text-slate-500">
              Member since {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
