'use client';

import dynamic from 'next/dynamic';
import type { Editor } from 'tldraw';

const Tldraw = dynamic(() => import('tldraw').then((mod) => mod.Tldraw),
  { ssr: false }
);

interface ClassroomWhiteboardProps {
  onMount?: (editor: Editor) => void;
}

export function ClassroomWhiteboard({ onMount }: ClassroomWhiteboardProps) {
  return (
    <div className="whiteboard-stage">
      <Tldraw 
        hideUi={true} 
        onMount={onMount}
      />
    </div>
  );
}