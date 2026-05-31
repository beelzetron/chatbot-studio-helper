import { useState, useCallback, useEffect, useRef } from 'react';
import { chatApi } from '../api/chatApi';
import type { ChatRequest, ChatResponse, Message, MessageAttachment } from '../types/chat';

const CONNECTION_ERROR =
  'Mi dispiace, ma ho avuto un problema di connessione. Per favore riprova.';

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

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: request.message,
      timestamp: new Date(),
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    let streamedContent = '';
    let finalResponse: ChatResponse = {
      response: '',
      is_helpful: true,
    };

    try {
      await chatApi.sendMessageStream(request, (event) => {
        if (event.type === 'token') {
          streamedContent += event.content;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: streamedContent }
                : message,
            ),
          );
          return;
        }

        if (event.type === 'done') {
          finalResponse = {
            response: streamedContent,
            is_helpful: event.is_helpful,
            safety_violation: event.safety_violation,
            violation_reason: event.violation_reason,
          };
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: streamedContent,
                    isStreaming: false,
                    isWarning: event.safety_violation,
                  }
                : message,
            ),
          );
          return;
        }

        if (event.type === 'error') {
          throw new Error(event.detail);
        }
      });

      return finalResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(errorMessage);

      const errorResponse: ChatResponse = {
        response: CONNECTION_ERROR,
        is_helpful: false,
        safety_violation: true,
        violation_reason: errorMessage,
      };

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: CONNECTION_ERROR,
                isStreaming: false,
                isWarning: true,
              }
            : message,
        ),
      );

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
