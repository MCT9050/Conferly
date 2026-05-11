import { useState, useCallback, useRef, useEffect } from 'react';

export interface Slide {
  id: string;
  type: 'title' | 'content' | 'split' | 'image' | 'code' | 'blank';
  title: string;
  body: string;
  notes: string;
  bgColor: string;
  accentColor: string;
}

export interface AnnotationPoint {
  x: number;
  y: number;
  color: string;
  size: number;
  t: number;
}

export interface AnnotationStroke {
  points: AnnotationPoint[];
}

export interface LaserPosition {
  x: number;
  y: number;
  visible: boolean;
}

const DEFAULT_SLIDES: Slide[] = [
  {
    id: 'slide-1',
    type: 'title',
    title: 'Welcome to Conferly',
    body: 'Lightning-fast video conferencing\nwith built-in presentations',
    notes: 'Introduce the team and agenda',
    bgColor: 'from-blue-600 to-cyan-500',
    accentColor: 'cyan',
  },
  {
    id: 'slide-2',
    type: 'content',
    title: 'Agenda',
    body: '• Project updates\n• Q4 roadmap review\n• Open discussion\n• Action items',
    notes: 'Keep each section to 10 minutes',
    bgColor: 'from-slate-800 to-slate-900',
    accentColor: 'blue',
  },
  {
    id: 'slide-3',
    type: 'blank',
    title: '',
    body: '',
    notes: '',
    bgColor: 'from-slate-800 to-slate-900',
    accentColor: 'blue',
  },
];

const TEMPLATES: Record<Slide['type'], Partial<Slide>> = {
  title: { title: 'Slide Title', body: 'Subtitle or description', bgColor: 'from-blue-600 to-cyan-500', accentColor: 'cyan' },
  content: { title: 'Content Slide', body: '• Point one\n• Point two\n• Point three', bgColor: 'from-slate-800 to-slate-900', accentColor: 'blue' },
  split: { title: 'Two Columns', body: 'LEFT:\nContent for left side\n\nRIGHT:\nContent for right side', bgColor: 'from-slate-800 to-slate-900', accentColor: 'purple' },
  image: { title: 'Image Slide', body: 'Description below the image area', bgColor: 'from-slate-800 to-slate-900', accentColor: 'green' },
  code: { title: 'Code Example', body: 'function hello() {\n  console.log("Hello Conferly!");\n  return true;\n}', bgColor: 'from-slate-900 to-slate-950', accentColor: 'emerald' },
  blank: { title: '', body: '', bgColor: 'from-slate-800 to-slate-900', accentColor: 'blue' },
};

export function usePresentation() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [showPresenterNotes, setShowPresenterNotes] = useState(false);
  const [annotations, setAnnotations] = useState<AnnotationStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#3b82f6');
  const [drawSize, setDrawSize] = useState(3);
  const [laser, setLaser] = useState<LaserPosition>({ x: 0, y: 0, visible: false });
  const [laserEnabled, setLaserEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const currentStrokeRef = useRef<AnnotationPoint[]>([]);
  const screenShareRef = useRef<MediaStream | null>(null);

  const currentSlide = slides[currentIndex];
  const totalSlides = slides.length;

  // Navigation
  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, slides.length - 1)));
    setAnnotations([]); // Clear annotations on slide change
  }, [slides.length]);

  const nextSlide = useCallback(() => goToSlide(currentIndex + 1), [currentIndex, goToSlide]);
  const prevSlide = useCallback(() => goToSlide(currentIndex - 1), [currentIndex, goToSlide]);

  // Presentation control
  const startPresentation = useCallback((fromSlide?: number) => {
    setIsPresenting(true);
    if (fromSlide !== undefined) setCurrentIndex(fromSlide);
  }, []);

  // Screen share functions for screen capture without local preview loop
  const stopScreenShare = useCallback(async () => {
    if (screenShareRef.current) {
      screenShareRef.current.getTracks().forEach(track => track.stop());
      screenShareRef.current = null;
    }
    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: false,
      });
      // Handle user stopping via browser UI
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        screenShareRef.current = null;
      };
      screenShareRef.current = stream;
      setIsScreenSharing(true);
      return stream;
    } catch (err) {
      console.warn('[presentation] Screen share cancelled:', err);
      return null;
    }
  }, []);

  const stopPresentation = useCallback(() => {
    setIsPresenting(false);
    setLaserEnabled(false);
    setLaser({ x: 0, y: 0, visible: false });
    setAnnotations([]);
    // Also stop screen share if active
    if (screenShareRef.current) {
      screenShareRef.current.getTracks().forEach(track => track.stop());
      screenShareRef.current = null;
    }
    setIsScreenSharing(false);
  }, []);

  // Slide CRUD
  const addSlide = useCallback((type: Slide['type'] = 'content', afterIndex?: number) => {
    const template = TEMPLATES[type];
    const newSlide: Slide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      title: template.title || '',
      body: template.body || '',
      notes: '',
      bgColor: template.bgColor || 'from-slate-800 to-slate-900',
      accentColor: template.accentColor || 'blue',
    };
    const idx = afterIndex !== undefined ? afterIndex + 1 : slides.length;
    setSlides(prev => [...prev.slice(0, idx), newSlide, ...prev.slice(idx)]);
    setCurrentIndex(idx);
  }, [slides.length]);

  const updateSlide = useCallback((id: string, updates: Partial<Slide>) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteSlide = useCallback((id: string) => {
    setSlides(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) return [{ ...TEMPLATES.blank, id: 'slide-new', type: 'blank' as const, title: '', body: '', notes: '', bgColor: 'from-slate-800 to-slate-900', accentColor: 'blue' }];
      return filtered;
    });
    setCurrentIndex(prev => Math.min(prev, slides.length - 2));
  }, [slides.length]);

  const reorderSlide = useCallback((fromIndex: number, toIndex: number) => {
    setSlides(prev => {
      const result = [...prev];
      const [moved] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, moved);
      return result;
    });
    setCurrentIndex(toIndex);
  }, []);

  // Drawing / Annotation
  const startStroke = useCallback((x: number, y: number) => {
    currentStrokeRef.current = [{ x, y, color: drawColor, size: drawSize, t: Date.now() }];
  }, [drawColor, drawSize]);

  const continueStroke = useCallback((x: number, y: number) => {
    currentStrokeRef.current.push({ x, y, color: drawColor, size: drawSize, t: Date.now() });
    setAnnotations(prev => {
      const updated = [...prev];
      if (updated.length > 0 && currentStrokeRef.current.length > 1) {
        updated[updated.length - 1] = { points: [...currentStrokeRef.current] };
      } else {
        updated.push({ points: [...currentStrokeRef.current] });
      }
      return updated;
    });
  }, [drawColor, drawSize]);

  const endStroke = useCallback(() => {
    if (currentStrokeRef.current.length > 0) {
      setAnnotations(prev => [...prev.slice(0, -1), { points: [...currentStrokeRef.current] }]);
      currentStrokeRef.current = [];
    }
  }, []);

  const clearAnnotations = useCallback(() => setAnnotations([]), []);

  const undoAnnotation = useCallback(() => {
    setAnnotations(prev => prev.slice(0, -1));
  }, []);

  // Laser pointer
  const moveLaser = useCallback((x: number, y: number) => {
    if (laserEnabled) setLaser({ x, y, visible: true });
  }, [laserEnabled]);

  const hideLaser = useCallback(() => {
    setLaser(prev => ({ ...prev, visible: false }));
  }, []);

  // Keyboard shortcuts for presentation
  useEffect(() => {
    if (!isPresenting) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); nextSlide(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevSlide(); }
      else if (e.key === 'Escape') { e.preventDefault(); stopPresentation(); }
      else if (e.key === 'Home') { e.preventDefault(); goToSlide(0); }
      else if (e.key === 'End') { e.preventDefault(); goToSlide(slides.length - 1); }
      else if (e.key === 'l' || e.key === 'L') { setLaserEnabled(prev => !prev); }
      else if (e.key === 'd' || e.key === 'D') { setIsDrawing(prev => !prev); }
      else if (e.key === 'n' || e.key === 'N') { setShowPresenterNotes(prev => !prev); }
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoAnnotation(); }
      else if (e.key === 'c' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); clearAnnotations(); }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPresenting, nextSlide, prevSlide, stopPresentation, goToSlide, slides.length, undoAnnotation, clearAnnotations, setLaserEnabled, setIsDrawing, setShowPresenterNotes]);

  return {
    slides, currentSlide, currentIndex, totalSlides,
    isPresenting, showPresenterNotes,
    annotations, isDrawing, drawColor, drawSize,
    laser, laserEnabled,
    isScreenSharing, screenStream: screenShareRef.current,
    goToSlide, nextSlide, prevSlide,
    startPresentation, stopPresentation,
    startScreenShare, stopScreenShare,
    setShowPresenterNotes,
    addSlide, updateSlide, deleteSlide, reorderSlide,
    startStroke, continueStroke, endStroke,
    clearAnnotations, undoAnnotation,
    setIsDrawing, setDrawColor, setDrawSize,
    setLaserEnabled, moveLaser, hideLaser,
    templates: TEMPLATES,
  };
}
