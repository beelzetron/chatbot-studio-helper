import { useState } from 'react';
import { BookOpen, Send, Trash2, Info, AlertCircle, Calculator, Book, Clock, FlaskConical, Globe, Languages, Palette, Music, Activity, Cpu } from 'lucide-react';
import { useChat } from './hooks/useChat';
import type { ChatRequest } from './types/chat';

const SUBJECTS = [
  { name: 'Matematica', icon: Calculator, color: 'bg-blue-500' },
  { name: 'Italiano', icon: Book, color: 'bg-green-500' },
  { name: 'Storia', icon: Clock, color: 'bg-amber-500' },
  { name: 'Scienze', icon: FlaskConical, color: 'bg-purple-500' },
  { name: 'Geografia', icon: Globe, color: 'bg-teal-500' },
  { name: 'Inglese', icon: Languages, color: 'bg-indigo-500' },
  { name: 'Arte', icon: Palette, color: 'bg-pink-500' },
  { name: 'Musica', icon: Music, color: 'bg-rose-500' },
  { name: 'Educazione Fisica', icon: Activity, color: 'bg-orange-500' },
  { name: 'Informatica', icon: Cpu, color: 'bg-cyan-500' },
];

function App() {
  const [message, setMessage] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [showInfo, setShowInfo] = useState(false);
  const { messages, isLoading, sendMessage, clearMessages } = useChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const request: ChatRequest = {
      message: message.trim(),
      subject: selectedSubject || undefined,
      grade_level: 'secondary',
    };

    await sendMessage(request);
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
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
          >
            <Info className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Info Panel */}
      {showInfo && (
        <div className="bg-white/10 backdrop-blur-md border-b border-white/20 animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <h3 className="text-lg font-semibold text-white mb-2">Cosa posso fare</h3>
            <ul className="text-gray-300 space-y-1 text-sm">
              <li>✅ Spiegare concetti scolastici in modo chiaro</li>
              <li>✅ Fornire esempi pratici per illustrare i metodi</li>
              <li>✅ Guidare nel ragionamento passo-passo</li>
              <li>❌ NON fornire soluzioni complete dei compiti</li>
              <li>❌ Rifiutare richieste fuori contesto scolastico</li>
            </ul>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar - Subjects */}
          <aside className="lg:col-span-1">
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
                      {subject.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
              {/* Messages */}
              <div className="h-[60vh] overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                    <BookOpen className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Benvenuto su Study Helper!</p>
                    <p className="text-sm mt-2 max-w-md">
                      Chiedi spiegazioni su concetti scolastici, esempi e metodi di studio.
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
                            ? 'bg-red-500/20 border border-red-500/50 text-red-200'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        {msg.isWarning && (
                          <div className="flex items-center gap-2 mb-2 text-red-400">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Nota importante</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
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
                {isLoading && (
                  <div className="flex justify-start animate-pulse-slow">
                    <div className="bg-white/10 rounded-2xl px-4 py-3">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="border-t border-white/20 p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Chiedi spiegazioni o esempi..."
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={clearMessages}
                    className="p-3 text-gray-400 hover:text-white transition-colors"
                    title="Pulisci chat"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !message.trim()}
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
