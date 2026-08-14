'use client';

export type LiveRoomControlCapabilities = {
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  canShareScreen: boolean;
  canRecord?: boolean;
  canUseWhiteboard?: boolean;
};

export function LiveRoomControls({ isMuted, isVideoOn, isScreenSharing, capabilities, onToggleMute, onToggleVideo, onToggleScreenShare, onLeave }: { isMuted: boolean; isVideoOn: boolean; isScreenSharing: boolean; capabilities: LiveRoomControlCapabilities; onToggleMute: () => void; onToggleVideo: () => void; onToggleScreenShare: () => void; onLeave: () => void }) {
  return <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 p-3" aria-label="Live room controls">
    <button type="button" onClick={onToggleMute} disabled={!capabilities.canPublishAudio} aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">{isMuted ? 'Unmute' : 'Mute'}</button>
    <button type="button" onClick={onToggleVideo} disabled={!capabilities.canPublishVideo} aria-label={isVideoOn ? 'Turn off camera' : 'Turn on camera'} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">{isVideoOn ? 'Camera off' : 'Camera on'}</button>
    <button type="button" onClick={onToggleScreenShare} disabled={!capabilities.canShareScreen} aria-label={isScreenSharing ? 'Stop screen share' : 'Start screen share'} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">{isScreenSharing ? 'Stop sharing' : 'Share screen'}</button>
    <button type="button" onClick={onLeave} aria-label="Leave room" className="rounded-xl border border-red-500/30 bg-red-600/10 px-3 py-2 text-sm text-red-300">Leave</button>
  </div>;
}