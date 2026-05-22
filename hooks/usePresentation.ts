export type SlideType = 'title' | 'content' | 'split' | 'code' | 'image' | 'blank';

export type Slide = {
  id: string;
  type: SlideType;
  title?: string;
  body?: string;
  notes?: string;
  bgColor?: string;
  imageUrl?: string;
};

export type AnnotationStrokePoint = {
  x: number;
  y: number;
  color?: string;
  size?: number;
};

export type AnnotationStroke = {
  id: string;
  points: AnnotationStrokePoint[];
};

export type LaserPosition = {
  x: number;
  y: number;
  visible: boolean;
};

export type usePresentation = {
  slides: Slide[];
  currentIndex: number;
  totalSlides: number;
  currentSlide: Slide;
  isPresenting: boolean;
  showPresenterNotes: boolean;
  annotations: AnnotationStroke[];
  isDrawing: boolean;
  drawColor: string;
  laser: LaserPosition;
  laserEnabled: boolean;
  goToSlide: (index: number) => void;
  addSlide: (type: Slide['type'], afterIndex?: number) => void;
  updateSlide: (id: string, updates: Partial<Slide>) => void;
  deleteSlide: (id: string) => void;
  reorderSlide: (from: number, to: number) => void;
  startPresentation: () => void;
  stopPresentation: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  setShowPresenterNotes: (value: boolean) => void;
  setIsDrawing: (value: boolean) => void;
  setLaserEnabled: (value: boolean) => void;
  setDrawColor: (color: string) => void;
  startStroke: (x: number, y: number) => void;
  continueStroke: (x: number, y: number) => void;
  endStroke: () => void;
  clearAnnotations: () => void;
  undoAnnotation: () => void;
  moveLaser: (x: number, y: number) => void;
  hideLaser: () => void;
};
