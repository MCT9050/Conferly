/**
 * Room Join Component for Conferly
 * 
 * Allows users to create or join LiveKit video meetings
 * Integrated with Supabase Auth + existing Conferly hooks
 * 
 * @source - src/components/RoomJoin.tsx
 */

import { useState, useCallback, useEffect } from 'react'
import { Video, VideoOff, Mic, MicOff, Monitor, Users, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { useLiveKitRoom, type UseLiveKitRoomReturn } from '../hooks/useLiveKitRoom'
import { useAuth } from '../hooks/useAuth'
import VideoGrid from '../runtime/VideoGrid'

// ============================================================
// PROPS
// ============================================================

export interface RoomJoinProps {
  initialRoomId?: string
  onJoined?: () => void
  onBack?: () => void
}

// ============================================================
// COMPONENT
// ============================================================

export default function RoomJoin({ initialRoomId, onJoined, onBack }: RoomJoinProps) {
  // Auth
  const { user, profile, isAuthenticated } = useAuth()
  
  // Form state
  const [displayName, setDisplayName] = useState('')
  const [roomId, setRoomId] = useState(initialRoomId || '')
  const [joinMode, setJoinMode] = useState<'create' | 'join'>('create')
  
  // LiveKit hook
  const livekit: UseLiveKitRoomReturn = useLiveKitRoom({
    onparticipantjoined: (p) => console.log('Joined:', p.name),
    onparticipantleft: (p) => console.log('Left:', p.name),
    ondisconnected: () => console.log('Disconnected'),
  })

  // Set display name from profile
  useEffect(() => {
    if (profile?.displayName && !displayName) {
      setDisplayName(profile.displayName)
    }
  }, [profile])

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleCreateMeeting = useCallback(async () => {
    if (!displayName.trim()) return
    
    // Generate room name
    const newRoomId = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setRoomId(newRoomId)
    
    // Connect
    await livekit.connectToRoom(newRoomId, displayName.trim())
  }, [displayName, livekit])

  const handleJoinMeeting = useCallback(async () => {
    if (!displayName.trim() || !roomId.trim()) return
    
    await livekit.connectToRoom(roomId.trim(), displayName.trim())
  }, [displayName, roomId, livekit])

  const handleLeaveMeeting = useCallback(() => {
    livekit.disconnectFromRoom()
    setRoomId('')
  }, [livekit])

  // Handle successful connection
  useEffect(() => {
    if (livekit.isConnected) {
      onJoined?.()
    }
  }, [livekit.isConnected, onJoined])

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (livekit.isConnecting) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-2">Connecting to meeting...</h2>
          <p className="text-slate-400">Please wait while we set up your video</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (livekit.error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl p-6 border border-red-500/20">
          <div className="flex items-center gap-3 text-red-400 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Connection Failed</h2>
          </div>
          
          <p className="text-slate-300 mb-6">{livekit.error}</p>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                livekit.disconnectFromRoom()
                setRoomId('')
              }}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              Try Again
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // CONNECTED - IN MEETING
  // ============================================================

  if (livekit.isConnected) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLeaveMeeting}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-white font-semibold">{roomId}</h1>
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {livekit.participants.length + 1} participant(s)
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 text-sm">
              {livekit.participants.length + 1}
            </span>
          </div>
        </div>

        {/* Video Grid */}
        <div className="flex-1 p-4">
          <VideoGrid
            participants={[
              livekit.localParticipant!,
              ...livekit.participants,
            ]}
            screenStream={null}
            handRaised={false}
          />
        </div>

        {/* Controls */}
        <div className="px-4 py-4 bg-slate-900/50 border-t border-slate-800">
          <div className="flex items-center justify-center gap-3">
            {/* Mute */}
            <button
              onClick={livekit.toggleMute}
              className={`p-4 rounded-full transition-colors ${
                livekit.isMuted
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              {livekit.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video */}
            <button
              onClick={livekit.toggleVideo}
              className={`p-4 rounded-full transition-colors ${
                !livekit.isVideoOn
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              {livekit.isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Screen Share */}
            <button
              onClick={livekit.toggleScreenShare}
              className={`p-4 rounded-full transition-colors ${
                livekit.isScreenSharing
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <Monitor className="w-5 h-5" />
            </button>

            {/* Leave */}
            <button
              onClick={handleLeaveMeeting}
              className="px-6 py-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
            >
              Leave
            </button>
          </div>
        </div>

        {/* Chat / Sidebar could be added here */}
      </div>
    )
  }

  // ============================================================
  // NOT CONNECTED - JOIN FORM
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {joinMode === 'create' ? 'Start a Meeting' : 'Join a Meeting'}
          </h1>
          <p className="text-slate-400">
            {joinMode === 'create'
              ? 'Create a new video meeting and invite others'
              : 'Enter a meeting code to join an existing meeting'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
          <button
            onClick={() => setJoinMode('create')}
            className={`flex-1 py-2 rounded-lg transition-colors ${
              joinMode === 'create'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setJoinMode('join')}
            className={`flex-1 py-2 rounded-lg transition-colors ${
              joinMode === 'join'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Join
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Display Name */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Room ID (for join mode) */}
          {joinMode === 'join' && (
            <div>
              <label className="block text-sm text-slate-400 mb-2">Meeting Code</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter meeting code"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Submit */}
          <button
            onClick={joinMode === 'create' ? handleCreateMeeting : handleJoinMeeting}
            disabled={!displayName.trim() || (joinMode === 'join' && !roomId.trim())}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joinMode === 'create' ? 'Start Meeting' : 'Join Meeting'}
          </button>
        </div>

        {/* Not authenticated notice */}
        {!isAuthenticated && (
          <p className="text-center text-slate-500 text-sm mt-4">
            Sign in to create or join meetings
          </p>
        )}
      </div>
    </div>
  )
}