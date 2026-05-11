/**
 * ScreenShareStatus - Alert card shown when presenting screen
 * Replaces local preview canvas to prevent recursive layout loop
 */
import { Monitor, X, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface ScreenShareStatusProps {
  isScreenSharing: boolean;
  isHost?: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  onStop?: () => void;
}

export default function ScreenShareStatus({ 
  isScreenSharing, 
  isHost = true, 
  audioEnabled = true, 
  videoEnabled = true,
  onStop,
}: ScreenShareStatusProps) {
  if (!isScreenSharing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-amber-500/30 shadow-2xl shadow-amber-500/20">
        <div className="flex flex-col items-center text-center">
          {/* Screen icon */}
          <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
            <Monitor className="w-10 h-10 text-amber-400" />
          </div>
          
          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2">
            Presenting your screen
          </h2>
          
          <p className="text-slate-400 mb-6">
            {isHost ? 'Your screen is being shared with all participants' : 'You are sharing your screen'}
          </p>
          
          {/* Status indicators */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-slate-300">
              {audioEnabled ? (
                <Mic className="w-4 h-4 text-green-400" />
              ) : (
                <MicOff className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm">{audioEnabled ? 'Mic on' : 'Mic off'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              {videoEnabled ? (
                <Video className="w-4 h-4 text-green-400" />
              ) : (
                <VideoOff className="w-4 h-4 text-red-400" />
              )}
              <span className="text-sm">{videoEnabled ? 'Camera on' : 'Camera off'}</span>
            </div>
          </div>
          
          {/* Instruction */}
          <div className="text-sm text-slate-500 mb-6">
            Press the browser&apos;s Stop sharing button or click below to end
          </div>
          
          {/* Stop button */}
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Stop sharing
          </button>
        </div>
      </div>
    </div>
  );
}
