/**
 * LiveKit Room Hook for Conferly
 * 
 * Provides real-time video conferencing using LiveKit Cloud
 * Integrated with existing Supabase authentication
 * 
 * @source - src/hooks/useLiveKitRoom.ts
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { create, Room, RoomEvent, LocalTrack, RemoteTrack, RemoteParticipant } from 'livekit-client'
import { supabase } from '../lib/supabase'
import type { Participant, TranscriptEntry, ChatMessage, Reaction } from '../types'

// ============================================================
// TYPES
// ============================================================

export interface LiveKitRoomState {
  room: Room | null
  isConnecting: boolean
  isConnected: boolean
  error: string | null
  participants: Participant[]
  localParticipant: Participant | null
}

export interface UseLiveKitRoomOptions {
  onparticipantjoined?: (participant: Participant) => void
  onparticipantleft?: (participant: Participant) => void
  ontrackpublished?: (participant: Participant, track: MediaStreamTrack) => void
  ondisconnected?: () => void
}

export interface UseLiveKitRoomReturn extends LiveKitRoomState {
  connectToRoom: (roomName: string, userName: string) => Promise<void>
  disconnectFromRoom: () => void
  toggleMute: () => void
  toggleVideo: () => void
  toggleScreenShare: () => Promise<void>
  startMedia: () => Promise<MediaStream | null>
  stopMedia: () => void
  // Chat support
  sendChatMessage: (text: string) => void
  chatMessages: ChatMessage[]
  // Reactions
  sendReaction: (reaction: Reaction) => void
  reactions: Reaction[]
  // Transcript
  transcript: TranscriptEntry[]
  isListening: boolean
  startListening: () => void
  stopListening: () => void
}

// ============================================================
// LIVEKIT CONFIGURATION
// ============================================================

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.conferly.site'

// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useLiveKitRoom(options: UseLiveKitRoomOptions = {}): UseLiveKitRoomReturn {
  // Room state
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  
  // Local state
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  
  // Track refs
  const localVideoRef = useRef<MediaStream | null>(null)
  const localAudioRef = useRef<MediaStream | null>(null)
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  
  // Reactions state
  const [reactions, setReactions] = useState<Reaction[]>([])
  
  // Transcript state
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [interimText, setInterimText] = useState('')
  const [isListening, setIsListening] = useState(false)
  
  // Refs for cleanup
  const roomRef = useRef<Room | null>(null)

  // ============================================================
  // FETCH TOKEN FROM EDGE FUNCTION
  // ============================================================

  const fetchToken = useCallback(async (roomName: string, userName: string) => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('generate-livekit-token', {
      body: {
        user_id: user.id,
        room_name: roomName,
        user_name: userName,
      },
    })

    if (error) {
      console.error('Token fetch error:', error)
      throw new Error(error.message || 'Failed to get token')
    }

    if (!data?.token) {
      throw new Error('No token returned')
    }

    return {
      token: data.token,
      roomName: data.room_name,
      participantName: data.participant_name,
      livekitUrl: data.livekit_url,
    }
  }, [])

  // ============================================================
  // CONNECT TO ROOM
  // ============================================================

  const connectToRoom = useCallback(async (roomName: string, userName: string) => {
    if (isConnecting || isConnected) {
      console.warn('Already connecting or connected')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      // 1. Get LiveKit token from Edge Function
      const { token, roomName: resolvedRoom } = await fetchToken(roomName, userName)

      // 2. Create LiveKit room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 640, height: 360, frameRate: 15 },
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      roomRef.current = newRoom

      // 3. Set up event listeners
      newRoom
        .on(RoomEvent.ParticipantJoined, (participant: RemoteParticipant) => {
          const p: Participant = {
            id: participant.identity,
            name: participant.name || participant.identity,
            isMuted: false,
            isVideoOn: false,
            handRaised: false,
            audioLevel: 0,
          }
          setParticipants((prev) => [...prev, p])
          options.onparticipantjoined?.(p)
        })
        .on(RoomEvent.ParticipantLeft, (participant: RemoteParticipant) => {
          setParticipants((prev) => prev.filter((p) => p.id !== participant.identity))
          options.onparticipantleft?.(participant as unknown as Participant)
        })
        .on(RoomEvent.TrackSubscribed, (_track: RemoteTrack, _pub, participant: RemoteParticipant) => {
          // Update participant state
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === participant.identity
                ? { ...p, isVideoOn: true }
                : p
            )
          )
        })
        .on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, _pub, participant: RemoteParticipant) => {
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === participant.identity
                ? { ...p, isVideoOn: false }
                : p
            )
          )
        })
        .on(RoomEvent.Disconnected, () => {
          setIsConnected(false)
          setRoom(null)
          options.ondisconnected?.()
        })

      // 4. Connect to LiveKit
      await newRoom.connect(LIVEKIT_URL, token, {
        name: resolvedRoom,
        participantIdentity: userName,
      })

      // 5. Publish local tracks
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        
        localVideoRef.current = mediaStream
        localAudioRef.current = mediaStream

        // Add tracks to room
        for (const track of mediaStream.getTracks()) {
          await newRoom.localParticipant.publishTrack(track as unknown as LocalTrack, {
            enabled: true,
          })
        }

        setLocalParticipant({
          id: newRoom.localParticipant.identity,
          name: userName,
          isMuted: false,
          isVideoOn: true,
          handRaised: false,
          audioLevel: 0,
        })
      } catch (mediaError) {
        console.warn('Could not publish media:', mediaError)
      }

      // 6. Update state
      setRoom(newRoom)
      setIsConnected(true)

    } catch (err) {
      console.error('Connection error:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setIsConnecting(false)
    }
  }, [isConnecting, isConnected, options])

  // ============================================================
  // DISCONNECT FROM ROOM
  // ============================================================

  const disconnectFromRoom = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect()
      roomRef.current = null
    }
    
    // Stop local tracks
    localVideoRef.current?.getTracks().forEach((t) => t.stop())
    localAudioRef.current?.getTracks().forEach((t) => t.stop())
    localVideoRef.current = null
    localAudioRef.current = null
    
    // Reset state
    setRoom(null)
    setIsConnected(false)
    setParticipants([])
    setLocalParticipant(null)
    setIsMuted(false)
    setIsVideoOn(true)
    setIsScreenSharing(false)
  }, [])

  // ============================================================
  // MEDIA CONTROLS
  // ============================================================

  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      localVideoRef.current = stream
      localAudioRef.current = stream
      return stream
    } catch (err) {
      console.error('Media error:', err)
      setError(err instanceof Error ? err.message : 'Could not access media')
      return null
    }
  }, [])

  const stopMedia = useCallback(() => {
    localVideoRef.current?.getTracks().forEach((t) => t.stop())
    localAudioRef.current?.getTracks().forEach((t) => t.stop())
    localVideoRef.current = null
    localAudioRef.current = null
  }, [])

  const toggleMute = useCallback(() => {
    if (!localAudioRef.current) return
    
    const newMuted = !isMuted
    localAudioRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !newMuted
    })
    setIsMuted(newMuted)
  }, [isMuted])

  const toggleVideo = useCallback(() => {
    if (!localVideoRef.current) return
    
    const newState = !isVideoOn
    localVideoRef.current.getVideoTracks().forEach((t) => {
      t.enabled = newState
    })
    setIsVideoOn(newState)
  }, [isVideoOn])

  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return

    if (isScreenSharing) {
      // Stop screen share
      const tracks = roomRef.current.localParticipant.getTracks()
      for (const [, trackpublication] of tracks) {
        if (trackpublication.trackName.includes('screen')) {
          trackpublication.track?.stop()
        }
      }
      setIsScreenSharing(false)
    } else {
      // Start screen share
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        })
        
        for (const track of stream.getVideoTracks()) {
          await roomRef.current.localParticipant.publishTrack(track as unknown as LocalTrack)
        }
        
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false)
        }
        
        setIsScreenSharing(true)
      } catch (err) {
        console.warn('Screen share cancelled')
      }
    }
  }, [isScreenSharing])

  // ============================================================
  // CHAT
  // ============================================================

  const sendChatMessage = useCallback((text: string) => {
    if (!roomRef.current || !text.trim()) return

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: roomRef.current.localParticipant.identity,
      senderName: roomRef.current.localParticipant.name || 'You',
      text: text.trim(),
      timestamp: Date.now(),
    }

    setChatMessages((prev) => [...prev, message])

    // Send via Data channel
    roomRef.current.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: 'chat', message })),
      'chat'
    )
  }, [])

  // Listen for chat messages
  useEffect(() => {
    if (!roomRef.current) return

    const handleData = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload))
        if (data.type === 'chat') {
          setChatMessages((prev) => [...prev, data.message])
        }
      } catch {
        // Not JSON
      }
    }

    roomRef.current.on(RoomEvent.DataReceived, handleData)
    return () => {
      roomRef.current?.off(RoomEvent.DataReceived, handleData)
    }
  }, [])

  // ============================================================
  // REACTIONS
  // ============================================================

  const sendReaction = useCallback((reaction: Omit<Reaction, 'id' | 'timestamp'>) => {
    if (!roomRef.current) return

    const fullReaction: Reaction = {
      ...reaction,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }

    setReactions((prev) => [...prev.slice(-10), fullReaction)

    roomRef.current.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: 'reaction', reaction: fullReaction })),
      'reaction'
    )
  }, [])

  // ============================================================
  // SPEECH RECOGNITION
  // ============================================================

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported')
      return
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SR()

    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: any) => {
      const results = event.results
      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i]
        if (result.isFinal) {
          const entry: TranscriptEntry = {
            id: crypto.randomUUID(),
            speaker: localParticipant?.name || 'You',
            text: result[0].transcript,
            timestamp: Date.now(),
            isFinal: true,
          }
          setTranscript((prev) => [...prev, entry])
          setInterimText('')
        } else {
          setInterimText(result[0].transcript)
        }
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error !== 'no-speech') {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    ;(recognition as any).start()
    setIsListening(true)
  }, [localParticipant])

  const stopListening = useCallback(() => {
    setIsListening(false)
    setInterimText('')
  }, [])

  // ============================================================
  // CLEANUP ON UNMOUNT
  // ============================================================

  useEffect(() => {
    return () => {
      disconnectFromRoom()
    }
  }, [])

  // ============================================================
  // RETURN
  // ============================================================

  return {
    room,
    isConnecting,
    isConnected,
    error,
    participants,
    localParticipant,
    connectToRoom,
    disconnectFromRoom,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    startMedia,
    stopMedia,
    sendChatMessage,
    chatMessages,
    sendReaction,
    reactions,
    transcript,
    isListening,
    startListening,
    stopListening,
  }
}