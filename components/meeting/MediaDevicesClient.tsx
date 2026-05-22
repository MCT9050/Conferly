"use client";

import { useEffect } from 'react';
import { useMeetingMedia } from './state/mediaStore';

export default function MediaDevicesClient() {
  const media = useMeetingMedia();

  useEffect(() => {
    if (!media.stream) {
      void media.startMedia();
    }
  }, [media]);

  return null;
}
