import { useState, useCallback } from 'react';
import { chatApi } from '../api/chatApi';
import type { ChatRequest, ChatResponse, Message } from '../types/chat';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (request: ChatRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: request.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);

      const response = await chatApi.sendMessage(request);
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        isWarning: response.safety_violation,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(errorMessage);
      
      const errorResponse: ChatResponse = {
        response: 'Mi dispiace, ma ho avuto un problema di connessione. Per favore riprova.',
        is_helpful: false,
        safety_violation: true,
        violation_reason: errorMessage,
      };

      const errorAssistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorResponse.response,
        timestamp: new Date(),
        isWarning: true,
      };

      setMessages(prev => [...prev, errorAssistantMessage]);
      return errorResponse;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
