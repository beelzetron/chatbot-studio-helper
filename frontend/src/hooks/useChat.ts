import { useState, useCallback, useEffect, useRef } from 'react';
import { chatApi } from '../api/chatApi';
import type { ChatRequest, ChatResponse, Message, MessageAttachment } from '../types/chat';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const trackPreviewUrl = useCallback((url: string) => {
    previewUrlsRef.current.add(url);
  }, []);

  const revokePreviewUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  }, []);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const sendMessage = useCallback(async (request: ChatRequest) => {
    setIsLoading(true);
    setError(null);

    const messageAttachments: MessageAttachment[] = (request.images ?? []).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      trackPreviewUrl(previewUrl);
      return { previewUrl, name: file.name };
    });

    try {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: request.message,
        timestamp: new Date(),
        attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
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
  }, [trackPreviewUrl]);

  const clearMessages = useCallback(() => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    trackPreviewUrl,
    revokePreviewUrl,
  };
}
