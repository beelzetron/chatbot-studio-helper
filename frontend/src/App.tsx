import { useState, useRef } from 'react';
import {
  BookOpen, Send, Trash2, Info, AlertCircle, Calculator, Book, Clock,
  FlaskConical, Globe, Languages, Palette, Music, Activity, Cpu,
  Paperclip, Camera, X, GraduationCap,
} from 'lucide-react';
import { MarkdownContent } from './components/MarkdownContent';
import { useChat } from './hooks/useChat';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  type AttachmentPreview,
  type ChatRequest,
  type GradeLevel,
  GRADE_LEVELS,
} from './types/chat';

const SUBJECTS = [
  { name: 'Matematica', icon: Calculator, color: 'bg-blue-500' },
  { name: 'Italiano', icon: Book, color: 'bg-green-500' },
  { name: 'Storia', icon: Clock, color: 'bg-amber-500' },
  { name: 'Scienze', icon: FlaskConical, color: 'bg-purple-500' },
  { name: 'Geografia', icon: Globe, color: 'bg-teal-500' },
  { name: 'Inglese', icon: Languages, color: 'bg-indigo-500' },
  { name: 'Francese', icon: Languages, color: 'bg-violet-500' },
  { name: 'Arte', icon: Palette, color: 'bg-pink-500' },
  { name: 'Musica', icon: Music, color: 'bg-rose-500' },
  { name: 'Educazione Fisica', icon: Activity, color: 'bg-orange-500' },
  { name: 'Informatica', icon: Cpu, color: 'bg-cyan-500' },
];

function App() {
  const [message, setMessage] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<GradeLevel>('primary');
  const [showInfo, setShowInfo] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { messages, isLoading, sendMessage, clearMessages, revokePreviewUrl } = useChat();

  const canSend = !isLoading && (message.trim().length > 0 || attachments.length > 0);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError(null);
    const slotsLeft = MAX_IMAGE_COUNT - attachments.length;
    if (slotsLeft <= 0) {
      setUploadError(`Massimo ${MAX_IMAGE_COUNT} immagini per messaggio`);
      return;
    }

    const newAttachments: AttachmentPreview[] = [];

    for (const file of Array.from(files).slice(0, slotsLeft)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setUploadError('Formato non supportato. Usa JPEG, PNG o WebP.');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadError('Immagine troppo grande (max 5 MB).');
        continue;
      }
      newAttachments.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (newAttachments.length === 0) return;

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item) revokePreviewUrl(item.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
    setUploadError(null);
  };

  const clearPendingAttachments = () => {
    attachments.forEach((a) => revokePreviewUrl(a.previewUrl));
    setAttachments([]);
  };

  const handleClearChat = () => {
    clearPendingAttachments();
    clearMessages();
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;

    const request: ChatRequest = {
      message: message.trim(),
      subject: selectedSubject || undefined,
      grade_level: selectedGradeLevel,
      images: attachments.map((a) => a.file),
    };

    await sendMessage(request);
    setMessage('');
    clearPendingAttachments();
    setUploadError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Study Helper</h1>
              <p className="text-sm text-gray-300">AI Tutor per lo studio</p>
            </div>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Informazioni"
          >
            <Info className="w-6 h-6" />
          </button>
        </div>
      </header>

      {showInfo && (
        <div className="bg-white/10 backdrop-blur-md border-b border-white/20 animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <h3 className="text-lg font-semibold text-white mb-2">Cosa posso fare</h3>
            <ul className="text-gray-300 space-y-1 text-sm">
              <li>✅ Spiegare concetti scolastici in modo chiaro</li>
              <li>✅ Fornire esempi pratici per illustrare i metodi</li>
              <li>✅ Guidare nel ragionamento passo-passo</li>
              <li>✅ Analizzare foto dei compiti (max 3 immagini, 5 MB ciascuna)</li>
              <li>❌ NON fornire soluzioni complete dei compiti</li>
              <li>❌ Rifiutare richieste fuori contesto scolastico</li>
            </ul>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Livello scolastico
              </h2>
              <div className="space-y-2">
                {GRADE_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setSelectedGradeLevel(level.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                      selectedGradeLevel === level.value
                        ? 'bg-white/20 text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Book className="w-5 h-5" />
                Materie
              </h2>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedSubject('')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                    !selectedSubject
                      ? 'bg-white/20 text-white'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Tutte
                </button>
                {SUBJECTS.map((subject) => {
                  const Icon = subject.icon;
                  return (
                    <button
                      key={subject.name}
                      onClick={() => setSelectedSubject(subject.name)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${
                        selectedSubject === subject.name
                          ? 'bg-white/20 text-white'
                          : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${subject.color}`} />
                      <Icon className="w-4 h-4 shrink-0 opacity-80" />
                      {subject.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="lg:col-span-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
              <div className="h-[60vh] overflow-y-auto p-4 space-y-4 bg-white">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <BookOpen className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Benvenuto su Study Helper!</p>
                    <p className="text-sm mt-2 max-w-md">
                      Chiedi spiegazioni, allega una foto del compito o scatta una foto.
                      Non fornisco soluzioni complete, ma ti aiuto a imparare.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      } animate-slide-up`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                            : msg.isWarning
                            ? 'bg-red-50 border border-red-200 text-red-800'
                            : 'bg-gray-50 border border-gray-200 text-gray-900'
                        }`}
                      >
                        {msg.isWarning && (
                          <div className="flex items-center gap-2 mb-2 text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Nota importante</span>
                          </div>
                        )}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {msg.attachments.map((attachment) => (
                              <img
                                key={attachment.previewUrl}
                                src={attachment.previewUrl}
                                alt={attachment.name}
                                className="h-24 w-24 object-cover rounded-lg border border-gray-200"
                              />
                            ))}
                          </div>
                        )}
                        {msg.role === 'assistant' ? (
                          <div className="flex items-end gap-1">
                            {msg.content ? (
                              msg.isStreaming ? (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              ) : (
                                <MarkdownContent content={msg.content} />
                              )
                            ) : null}
                            {msg.isStreaming && (
                              <span
                                className="inline-block w-2 h-4 shrink-0 bg-gray-400 animate-pulse rounded-sm mb-1"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        ) : (
                          msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <p className="text-xs mt-2 opacity-60">
                          {msg.timestamp.toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSubmit} className="border-t border-white/20 p-4 space-y-3">
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="relative">
                        <img
                          src={attachment.previewUrl}
                          alt={attachment.file.name}
                          className="h-16 w-16 object-cover rounded-lg border border-white/20"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachment.id)}
                          className="absolute -top-2 -right-2 p-0.5 bg-red-500 rounded-full text-white"
                          aria-label={`Rimuovi ${attachment.file.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadError && (
                  <p className="text-sm text-red-300" role="alert">{uploadError}</p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || attachments.length >= MAX_IMAGE_COUNT}
                    className="p-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    title="Allega immagine"
                    aria-label="Allega immagine"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isLoading || attachments.length >= MAX_IMAGE_COUNT}
                    className="p-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    title="Scatta foto"
                    aria-label="Scatta foto"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Chiedi spiegazioni o allega una foto..."
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="p-3 text-gray-400 hover:text-white transition-colors"
                    title="Pulisci chat"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={!canSend}
                    aria-label="Invia"
                    className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
