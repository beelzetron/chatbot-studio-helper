export type GradeLevel = 'primary' | 'middle' | 'secondary';

export interface ChatRequest {
  message: string;
  subject?: string;
  grade_level?: GradeLevel;
  history?: ChatHistoryMessage[];
  images?: File[];
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  is_helpful: boolean;
  safety_violation?: boolean;
  violation_reason?: string;
}

export interface UploadLimits {
  max_images: number;
  max_bytes_per_image: number;
  max_pixels_per_image?: number;
  allowed_types: string[];
}

export interface ServiceInfo {
  name: string;
  version: string;
  description: string;
  guardrails: string[];
  uploads?: UploadLimits;
}

export interface MessageAttachment {
  previewUrl: string;
  name: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isWarning?: boolean;
  isStreaming?: boolean;
  attachments?: MessageAttachment[];
}

export type ChatStreamEvent =
  | { type: 'token'; content: string }
  | {
      type: 'done';
      is_helpful: boolean;
      safety_violation?: boolean;
      violation_reason?: string;
    }
  | { type: 'error'; detail: string };

export interface AttachmentPreview {
  id: string;
  file: File;
  previewUrl: string;
}

export interface Subject {
  name: string;
  icon: string;
  description: string;
}

export const MAX_IMAGE_COUNT = 3;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  max_images: MAX_IMAGE_COUNT,
  max_bytes_per_image: MAX_IMAGE_BYTES,
  allowed_types: ALLOWED_IMAGE_TYPES,
};

export const GRADE_LEVELS: { value: GradeLevel; label: string }[] = [
  { value: 'primary', label: 'Scuole elementari' },
  { value: 'middle', label: 'Scuole medie' },
  { value: 'secondary', label: 'Scuole superiori' },
];

export const SCHOOL_SUBJECTS: Subject[] = [
  { name: 'Matematica', icon: 'calculator', description: 'Algebra, geometria, calcolo' },
  { name: 'Italiano', icon: 'book', description: 'Grammatica, letteratura, scrittura' },
  { name: 'Storia', icon: 'clock', description: 'Storia antica, moderna, contemporanea' },
  { name: 'Scienze', icon: 'flask', description: 'Biologia, chimica, fisica' },
  { name: 'Geografia', icon: 'globe', description: 'Geografia italiana e mondiale' },
  { name: 'Inglese', icon: 'languages', description: 'Grammatica e conversazione' },
  { name: 'Francese', icon: 'languages', description: 'Grammatica e conversazione' },
  { name: 'Arte', icon: 'palette', description: 'Storia dellarte, tecniche artistiche' },
  { name: 'Musica', icon: 'music', description: 'Teoria musicale, storia della musica' },
  { name: 'Educazione Fisica', icon: 'activity', description: 'Sport, salute, benessere' },
  { name: 'Informatica', icon: 'cpu', description: 'Programmazione, algoritmi, logica' },
];
