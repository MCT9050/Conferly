"use client";

import { useEffect, useRef } from "react";
import type { RemoteVideoTrack } from "livekit-client";

type PresentationVideoProps = {
  track: RemoteVideoTrack | null;
  label: string;
  className?: string;
};

export default function PresentationVideo({
  track,
  label,
  className = "",
}: PresentationVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || !track) {
      return;
    }

    track.attach(videoElement);

    return () => {
      track.detach(videoElement);
      videoElement.removeAttribute("src");
      videoElement.load();
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      aria-label={label}
      className={`h-full w-full object-contain bg-black ${className}`.trim()}
    />
  );
}