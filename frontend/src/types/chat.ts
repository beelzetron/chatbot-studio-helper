export interface ChatRequest {
  message: string;
  subject?: string;
  grade_level?: 'primary' | 'secondary';
  images?: File[];
}

export interface ChatResponse {
  response: string;
  is_helpful: boolean;
  safety_violation?: boolean;
  violation_reason?: string;
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
  attachments?: MessageAttachment[];
}

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

export const SCHOOL_SUBJECTS: Subject[] = [
  { name: 'Matematica', icon: 'calculator', description: 'Algebra, geometria, calcolo' },
  { name: 'Italiano', icon: 'book', description: 'Grammatica, letteratura, scrittura' },
  { name: 'Storia', icon: 'clock', description: 'Storia antica, moderna, contemporanea' },
  { name: 'Scienze', icon: 'flask', description: 'Biologia, chimica, fisica' },
  { name: 'Geografia', icon: 'globe', description: 'Geografia italiana e mondiale' },
  { name: 'Inglese', icon: 'languages', description: 'Grammatica e conversazione' },
  { name: 'Arte', icon: 'palette', description: 'Storia dellarte, tecniche artistiche' },
  { name: 'Musica', icon: 'music', description: 'Teoria musicale, storia della musica' },
  { name: 'Educazione Fisica', icon: 'activity', description: 'Sport, salute, benessere' },
  { name: 'Informatica', icon: 'cpu', description: 'Programmazione, algoritmi, logica' },
];
