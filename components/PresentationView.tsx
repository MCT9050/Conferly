"use client";

import { useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, X, Pencil, MousePointer2,
  Undo2, Trash2, StickyNote
} from 'lucide-react';
import type { Slide, AnnotationStroke, LaserPosition } from '../hooks/usePresentation';

interface PresentationViewProps {
  slide: Slide;
  currentIndex: number;
  totalSlides: number;
  isPresenting: boolean;
  showPresenterNotes: boolean;
  annotations: AnnotationStroke[];
  isDrawing: boolean;
  drawColor: string;
  laser: LaserPosition;
  laserEnabled: boolean;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
  onGoTo: (i: number) => void;
  onToggleNotes: () => void;
  onToggleDraw: () => void;
  onToggleLaser: () => void;
  onSetDrawColor: (c: string) => void;
  onStartStroke: (x: number, y: number) => void;
  onContinueStroke: (x: number, y: number) => void;
  onEndStroke: () => void;
  onClearAnnotations: () => void;
  onUndoAnnotation: () => void;
  onMoveLaser: (x: number, y: number) => void;
  onHideLaser: () => void;
}

const DRAW_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ffffff'];

function renderSlideContent(slide: Slide) {
  if (slide.type === 'title') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-12">
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 leading-tight">{slide.title}</h1>
        {slide.body && <p className="text-xl sm:text-2xl text-white/60 whitespace-pre-line max-w-2xl">{slide.body}</p>}
      </div>
    );
  }

  if (slide.type === 'content') {
    return (
      <div className="flex flex-col justify-center h-full px-12 sm:px-20 py-16">
        {slide.title && <h2 className="text-3xl sm:text-5xl font-bold mb-8 tracking-tight">{slide.title}</h2>}
        <div className="text-lg sm:text-2xl text-white/80 whitespace-pre-line leading-relaxed space-y-2">
          {(slide.body?.split('\n') ?? []).map((line, i) => {
            const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
            return (
              <div key={i} className={`${isBullet ? 'flex items-start gap-3' : ''}`}>
                {isBullet && <span className="w-2.5 h-2.5 rounded-full bg-current mt-2.5 shrink-0 opacity-60" />}
                <span>{isBullet ? line.slice(1).trim() : line}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.type === 'split') {
    const parts = slide.body ? slide.body.split(/LEFT:|RIGHT:/i).filter(Boolean) : [];
    const left = parts[0]?.trim() || '';
    const right = parts[1]?.trim() || '';
    return (
      <div className="flex flex-col h-full px-12 sm:px-16 py-16">
        {slide.title && <h2 className="text-3xl sm:text-4xl font-bold mb-10 tracking-tight">{slide.title}</h2>}
        <div className="flex-1 grid grid-cols-2 gap-8">
          <div className="text-lg text-white/80 whitespace-pre-line leading-relaxed">{left}</div>
          <div className="text-lg text-white/80 whitespace-pre-line leading-relaxed border-l border-white/10 pl-8">{right}</div>
        </div>
      </div>
    );
  }

  if (slide.type === 'code') {
    return (
      <div className="flex flex-col justify-center h-full px-12 sm:px-20 py-16">
        {slide.title && <h2 className="text-3xl sm:text-4xl font-bold mb-8 tracking-tight">{slide.title}</h2>}
        <pre className="bg-black/40 rounded-2xl p-6 sm:p-8 text-sm sm:text-base font-mono text-green-400 overflow-auto border border-white/5">
          <code>{slide.body}</code>
        </pre>
      </div>
    );
  }

  if (slide.type === 'image') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-12 py-16">
        <div className="w-full max-w-3xl aspect-video rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
          <span className="text-slate-600 text-sm">Image placeholder</span>
        </div>
        {slide.title && <h3 className="text-2xl font-bold mb-2">{slide.title}</h3>}
        {slide.body && <p className="text-lg text-white/60">{slide.body}</p>}
      </div>
    );
  }

  // blank
  return <div className="flex items-center justify-center h-full text-slate-600 text-lg">Empty slide</div>;
}

export default function PresentationView({
  slide, currentIndex, totalSlides, isPresenting, showPresenterNotes,
  annotations, isDrawing, drawColor, laser, laserEnabled,
  onNext, onPrev, onStop, onGoTo, onToggleNotes, onToggleDraw, onToggleLaser,
  onSetDrawColor, onStartStroke, onContinueStroke, onEndStroke,
  onClearAnnotations, onUndoAnnotation, onMoveLaser, onHideLaser,
}: PresentationViewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);

  const getRelativePos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const clientX = 'touches' in e ? e.touches[0]?.clientX || 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY || 0 : e.clientY;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }, []);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isDrawing) {
      drawingRef.current = true;
      const pos = getRelativePos(e);
      onStartStroke(pos.x, pos.y);
    }
  }, [isDrawing, getRelativePos, onStartStroke]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getRelativePos(e);
    if (laserEnabled) onMoveLaser(pos.x, pos.y);
    if (drawingRef.current && isDrawing) onContinueStroke(pos.x, pos.y);
  }, [isDrawing, laserEnabled, getRelativePos, onMoveLaser, onContinueStroke]);

  const handlePointerUp = useCallback(() => {
    if (drawingRef.current) { drawingRef.current = false; onEndStroke(); }
  }, [onEndStroke]);

  if (!isPresenting) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Slide area */}
      <div
        ref={canvasRef}
        className={`flex-1 relative overflow-hidden select-none ${isDrawing ? 'cursor-crosshair' : laserEnabled ? 'cursor-none' : 'cursor-default'}`}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => { handlePointerUp(); onHideLaser(); }}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        {/* Slide background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${slide.bgColor}`} />

        {/* Slide content */}
        <div className="absolute inset-0 z-10 text-white">
          {renderSlideContent(slide)}
        </div>

        {/* Annotation SVG overlay */}
        {annotations.length > 0 && (
          <svg className="absolute inset-0 z-20 pointer-events-none w-full h-full">
            {annotations.map((stroke, si) => (
              <polyline
                key={si}
                points={stroke.points.map(p => `${p.x * 100}%,${p.y * 100}%`).join(' ')}
                fill="none"
                stroke={stroke.points[0]?.color || '#3b82f6'}
                strokeWidth={stroke.points[0]?.size || 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}

        {/* Laser pointer */}
        {laser.visible && laserEnabled && (
          <div
            className="absolute z-30 w-4 h-4 rounded-full pointer-events-none"
            style={{
              left: `${laser.x * 100}%`, top: `${laser.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.3) 60%, transparent 100%)',
              boxShadow: '0 0 12px 4px rgba(239,68,68,0.5)',
            }}
          />
        )}

        {/* Slide number */}
        <div className="absolute bottom-4 right-4 z-30 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-xs text-white/60 font-mono">
          {currentIndex + 1} / {totalSlides}
        </div>

        {/* Click zones for navigation (when not drawing) */}
        {!isDrawing && (
          <>
            <div className="absolute left-0 top-0 w-1/5 h-full z-20 cursor-w-resize opacity-0 hover:opacity-100 transition-opacity" onClick={onPrev}>
              <div className="flex items-center justify-center h-full"><ChevronLeft className="w-10 h-10 text-white/30" /></div>
            </div>
            <div className="absolute right-0 top-0 w-1/5 h-full z-20 cursor-e-resize opacity-0 hover:opacity-100 transition-opacity" onClick={onNext}>
              <div className="flex items-center justify-center h-full"><ChevronRight className="w-10 h-10 text-white/30" /></div>
            </div>
          </>
        )}
      </div>

      {/* Presenter notes bar */}
      {showPresenterNotes && slide.notes && (
        <div className="bg-slate-900/95 border-t border-white/10 px-6 py-4 max-h-32 overflow-y-auto">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><StickyNote className="w-3 h-3" />Speaker Notes</div>
          <p className="text-sm text-slate-300 leading-relaxed">{slide.notes}</p>
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="bg-black/90 backdrop-blur-sm border-t border-white/5 px-4 py-2.5 flex items-center justify-between gap-3" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
        {/* Left: navigation */}
        <div className="flex items-center gap-2">
          <button onClick={onPrev} disabled={currentIndex === 0} className="p-2 min-w-[40px] min-h-[40px] rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          {/* Slide dots */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button key={i} onClick={() => onGoTo(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === currentIndex ? 'bg-blue-400 scale-125' : 'bg-white/20 hover:bg-white/40'}`} />
            ))}
          </div>
          <button onClick={onNext} disabled={currentIndex === totalSlides - 1} className="p-2 min-w-[40px] min-h-[40px] rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors flex items-center justify-center">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Center: tools */}
        <div className="flex items-center gap-1.5">
          <button onClick={onToggleDraw} className={`p-2 min-w-[40px] min-h-[40px] rounded-lg transition-colors flex items-center justify-center ${isDrawing ? 'bg-blue-500/20 text-blue-400' : 'text-white/40 hover:text-white hover:bg-white/10'}`} title="Draw (D)">
            <Pencil className="w-4 h-4" />
          </button>
          {isDrawing && (
            <div className="flex items-center gap-1 px-2">
              {DRAW_COLORS.map(c => (
                <button key={c} onClick={() => onSetDrawColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${drawColor === c ? 'border-white scale-125' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
          <button onClick={onToggleLaser} className={`p-2 min-w-[40px] min-h-[40px] rounded-lg transition-colors flex items-center justify-center ${laserEnabled ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:text-white hover:bg-white/10'}`} title="Laser (L)">
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button onClick={onUndoAnnotation} className="p-2 min-w-[40px] min-h-[40px] rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center" title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={onClearAnnotations} className="p-2 min-w-[40px] min-h-[40px] rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center" title="Clear all">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button onClick={onToggleNotes} className={`p-2 min-w-[40px] min-h-[40px] rounded-lg transition-colors flex items-center justify-center ${showPresenterNotes ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white hover:bg-white/10'}`} title="Notes (N)">
            <StickyNote className="w-4 h-4" />
          </button>
        </div>

        {/* Right: exit */}
        <button onClick={onStop} className="p-2 min-w-[40px] min-h-[40px] rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center" title="Exit (Esc)">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
