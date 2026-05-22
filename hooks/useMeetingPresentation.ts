"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import type { AnnotationStroke, LaserPosition, Slide, SlideType } from './usePresentation';

function createSlide(type: SlideType): Slide {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type,
    title: type === 'title' ? 'Welcome to Conferly' : type === 'content' ? 'Live Collaboration' : '',
    body: type === 'title' ? 'A modern meeting platform optimized for Next.js.' : 'Use the speaker notes, laser pointer, and slide annotations to keep your meeting on track.',
    bgColor: 'from-slate-900 to-slate-950',
    notes: 'Presenter notes appear only for you during presentation.',
  };
}

export function useMeetingPresentationState() {
  const [slides, setSlides] = useState<Slide[]>([
    createSlide('title'),
    createSlide('content'),
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [showPresenterNotes, setShowPresenterNotes] = useState(true);
  const [annotations, setAnnotations] = useState<AnnotationStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#3b82f6');
  const [laser, setLaser] = useState<LaserPosition>({ x: 0.5, y: 0.5, visible: false });
  const strokeRef = useRef<AnnotationStroke | null>(null);

  const currentSlide = useMemo(() => slides[currentIndex] ?? slides[0], [slides, currentIndex]);
  const totalSlides = slides.length;

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, slides.length - 1)));
  }, [slides.length]);

  const addSlide = useCallback((type: SlideType, afterIndex?: number) => {
    setSlides(current => {
      const next = [...current];
      const index = typeof afterIndex === 'number' ? Math.min(afterIndex + 1, next.length) : next.length;
      next.splice(index, 0, createSlide(type));
      return next;
    });
    setCurrentIndex(index => Math.min(index + 1, slides.length));
  }, [slides.length]);

  const updateSlide = useCallback((id: string, updates: Partial<Slide>) => {
    setSlides(current => current.map(slide => slide.id === id ? { ...slide, ...updates } : slide));
  }, []);

  const deleteSlide = useCallback((id: string) => {
    setSlides(current => {
      const next = current.filter(slide => slide.id !== id);
      return next.length === 0 ? [createSlide('title')] : next;
    });
    setCurrentIndex(current => Math.max(0, Math.min(current - 1, slides.length - 2)));
  }, [slides.length]);

  const reorderSlide = useCallback((from: number, to: number) => {
    setSlides(current => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const startPresentation = useCallback((fromSlide?: number) => {
    setCurrentIndex(typeof fromSlide === 'number' ? Math.min(fromSlide, slides.length - 1) : 0);
    setIsPresenting(true);
    setLaser({ x: 0.5, y: 0.5, visible: false });
  }, [slides.length]);

  const stopPresentation = useCallback(() => {
    setIsPresenting(false);
    setLaser(current => ({ ...current, visible: false }));
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex(current => Math.min(current + 1, slides.length - 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex(current => Math.max(current - 1, 0));
  }, []);

  const startStroke = useCallback((x: number, y: number) => {
    const stroke: AnnotationStroke = {
      id: Math.random().toString(36).slice(2, 10),
      points: [{ x, y, color: drawColor, size: 3 }],
    };
    strokeRef.current = stroke;
    setAnnotations(current => [...current, stroke]);
  }, [drawColor]);

  const continueStroke = useCallback((x: number, y: number) => {
    if (!strokeRef.current) return;
    strokeRef.current.points.push({ x, y, color: drawColor, size: 3 });
    setAnnotations(current => current.map(stroke => stroke.id === strokeRef.current?.id ? strokeRef.current! : stroke));
  }, [drawColor]);

  const endStroke = useCallback(() => {
    strokeRef.current = null;
  }, []);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
  }, []);

  const undoAnnotation = useCallback(() => {
    setAnnotations(current => current.slice(0, -1));
  }, []);

  const moveLaser = useCallback((x: number, y: number) => {
    setLaser(current => ({ ...current, x, y, visible: true }));
  }, []);

  const hideLaser = useCallback(() => {
    setLaser(current => ({ ...current, visible: false }));
  }, []);

  return {
    slides,
    currentIndex,
    totalSlides,
    currentSlide,
    isPresenting,
    showPresenterNotes,
    annotations,
    isDrawing,
    drawColor,
    laser,
    goToSlide,
    addSlide,
    updateSlide,
    deleteSlide,
    reorderSlide,
    startPresentation,
    stopPresentation,
    nextSlide,
    prevSlide,
    setShowPresenterNotes,
    setIsDrawing,
    setLaserEnabled: setLaser,
    setDrawColor,
    startStroke,
    continueStroke,
    endStroke,
    clearAnnotations,
    undoAnnotation,
    moveLaser,
    hideLaser,
  };
}
