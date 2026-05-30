export interface ChatRequest {
  message: string;
  subject?: string;
  grade_level?: 'primary' | 'secondary';
}

export interface ChatResponse {
  response: string;
  is_helpful: boolean;
  safety_violation?: boolean;
  violation_reason?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isWarning?: boolean;
}

export interface Subject {
  name: string;
  icon: string;
  description: string;
}

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
