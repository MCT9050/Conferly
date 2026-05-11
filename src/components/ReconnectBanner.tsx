/**
 * ReconnectBanner - Persistent recovery banner for rejoin
 */
import { useMeetingPersistence, MeetingSession } from '../persistence/useMeetingPersistence';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

interface ReconnectBannerProps {
  onDismiss?: () => void;
}

export default function ReconnectBanner({ onDismiss }: ReconnectBannerProps) {
  const { session, isRecovering, rejoin, clear } = useMeetingPersistence();
  const navigate = useNavigate();

  if (!isRecovering || !session) return null;

  const handleRejoin = () => {
    rejoin();
    navigate(`/room/${session.roomId}`);
  };

  const handleDismiss = () => {
    if (onDismiss) onDismiss();
    clear();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-sm border-b border-amber-600">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-amber-900 animate-spin-slow" />
          <div>
            <div className="text-sm font-semibold text-amber-900">
              Previous session detected
            </div>
            <div className="text-xs text-amber-800">
              Room: {session.roomId} • {session.isHost ? 'Host' : 'Participant'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRejoin}
            className="px-4 py-1.5 rounded-full bg-amber-900 text-white text-sm font-medium hover:bg-amber-800 transition-colors"
          >
            Rejoin
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-full border border-amber-600 text-amber-900 text-sm hover:bg-amber-100/20 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
