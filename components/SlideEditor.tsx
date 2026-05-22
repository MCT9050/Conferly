"use client";

import {
  Plus, Trash2, Play, Layout, Type, Columns, Image, Code2,
  Square, ChevronUp, ChevronDown, StickyNote
} from 'lucide-react';
import type { Slide } from '../hooks/usePresentation';

interface SlideEditorProps {
  slides: Slide[];
  currentIndex: number;
  onGoTo: (i: number) => void;
  onAdd: (type: Slide['type'], afterIndex?: number) => void;
  onUpdate: (id: string, updates: Partial<Slide>) => void;
  onDelete: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onStartPresentation: (fromSlide?: number) => void;
}

const TYPE_ICONS: Record<Slide['type'], typeof Type> = {
  title: Type, content: Layout, split: Columns, image: Image, code: Code2, blank: Square,
};
const TYPE_LABELS: Record<Slide['type'], string> = {
  title: 'Title', content: 'Content', split: 'Split', image: 'Image', code: 'Code', blank: 'Blank',
};

const BG_OPTIONS = [
  { label: 'Blue', value: 'from-blue-600 to-cyan-500' },
  { label: 'Dark', value: 'from-slate-800 to-slate-900' },
  { label: 'Purple', value: 'from-purple-600 to-pink-500' },
  { label: 'Green', value: 'from-emerald-600 to-teal-500' },
  { label: 'Amber', value: 'from-amber-500 to-orange-500' },
  { label: 'Black', value: 'from-slate-900 to-slate-950' },
];

export default function SlideEditor({
  slides, currentIndex, onGoTo, onAdd, onUpdate, onDelete, onReorder, onStartPresentation,
}: SlideEditorProps) {
  const current = slides[currentIndex];
  if (!current) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Present button */}
      <div className="px-4 py-3 border-b border-slate-800/30">
        <button
          onClick={() => onStartPresentation(0)}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 transition-all min-h-[44px]"
        >
          <Play className="w-4 h-4" />
          Present ({slides.length} slides)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Slide thumbnails */}
        <div className="px-3 py-3 space-y-1.5 border-b border-slate-800/30">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider px-1 mb-2">Slides</div>
          {slides.map((slide, i) => {
            const Icon = TYPE_ICONS[slide.type];
            return (
              <div key={slide.id}
                onClick={() => onGoTo(i)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${i === currentIndex ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 hover:bg-slate-800/40'}`}>
                <span className="text-[10px] font-mono text-slate-600 w-4 text-right">{i + 1}</span>
                <div className={`w-12 h-7 rounded bg-gradient-to-br ${slide.bgColor} border border-white/10 flex items-center justify-center shrink-0`}>
                  <Icon className="w-3 h-3 text-white/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{slide.title || TYPE_LABELS[slide.type]}</div>
                </div>
                {slides.length > 1 && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                    {i > 0 && <button onClick={e => { e.stopPropagation(); onReorder(i, i - 1); }} className="p-0.5 text-slate-600 hover:text-white"><ChevronUp className="w-3 h-3" /></button>}
                    {i < slides.length - 1 && <button onClick={e => { e.stopPropagation(); onReorder(i, i + 1); }} className="p-0.5 text-slate-600 hover:text-white"><ChevronDown className="w-3 h-3" /></button>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add slide */}
          <div className="flex items-center gap-1 pt-1">
            {(['content', 'title', 'split', 'code'] as Slide['type'][]).map(type => {
              const Icon = TYPE_ICONS[type];
              return (
                <button key={type} onClick={() => onAdd(type, currentIndex)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800/30 text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors text-[10px]"
                  title={`Add ${TYPE_LABELS[type]}`}>
                  <Icon className="w-3 h-3" />
                </button>
              );
            })}
            <button onClick={() => onAdd('blank', currentIndex)}
              className="p-1.5 rounded-lg bg-slate-800/30 text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"
              title="Add blank">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Current slide editor */}
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Slide {currentIndex + 1}</span>
            {slides.length > 1 && (
              <button onClick={() => onDelete(current.id)} className="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            )}
          </div>

          {/* Type selector */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Layout</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['title', 'content', 'split', 'image', 'code', 'blank'] as Slide['type'][]).map(type => {
                const Icon = TYPE_ICONS[type];
                return (
                  <button key={type} onClick={() => onUpdate(current.id, { type })}
                    className={`p-2 rounded-lg text-[10px] flex flex-col items-center gap-1 transition-colors ${current.type === type ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-slate-800/30 text-slate-500 hover:text-white border border-transparent'}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Title</label>
            <input type="text" value={current.title} onChange={e => onUpdate(current.id, { title: e.target.value })}
              placeholder="Slide title" className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/30 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/30" />
          </div>

          {/* Body */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Content</label>
            <textarea value={current.body} onChange={e => onUpdate(current.id, { body: e.target.value })}
              placeholder="Slide content..." rows={5}
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/30 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/30 resize-none font-mono" />
          </div>

          {/* Speaker notes */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Speaker Notes
            </label>
            <textarea value={current.notes} onChange={e => onUpdate(current.id, { notes: e.target.value })}
              placeholder="Only you can see these during presentation..." rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/30 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/30 resize-none" />
          </div>

          {/* Background */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Background</label>
            <div className="grid grid-cols-3 gap-1.5">
              {BG_OPTIONS.map(bg => (
                <button key={bg.value} onClick={() => onUpdate(current.id, { bgColor: bg.value })}
                  className={`h-8 rounded-lg bg-gradient-to-br ${bg.value} border-2 transition-all ${current.bgColor === bg.value ? 'border-white/60 scale-105' : 'border-transparent hover:border-white/20'}`}
                  title={bg.label} />
              ))}
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="pt-3 border-t border-slate-800/30 space-y-1.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider">Presentation shortcuts</div>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
              {[
                ['→ / Space', 'Next slide'], ['← / Backspace', 'Previous'], ['D', 'Draw mode'],
                ['L', 'Laser pointer'], ['N', 'Speaker notes'], ['Esc', 'Exit'],
                ['Ctrl+Z', 'Undo draw'], ['Home / End', 'First / Last'],
              ].map(([key, action]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/50">{key}</kbd>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
