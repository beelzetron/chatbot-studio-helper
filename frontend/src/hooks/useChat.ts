import { useState, useCallback } from 'react';
import { chatApi } from '../api/chatApi';
import type {
  ChatHistoryMessage,
  ChatRequest,
  ChatResponse,
  Message,
  MessageAttachment,
} from '../types/chat';
import { createClientId } from '../utils/id';
import { reportClientEvent } from '../utils/clientDebug';

const CONNECTION_ERROR =
  'Mi dispiace, ma ho avuto un problema di connessione. Per favore riprova.';
const MAX_HISTORY_MESSAGES = 20;

function isHistoryRole(role: Message['role']): role is ChatHistoryMessage['role'] {
  return role === 'user' || role === 'assistant';
}

function buildConversationHistory(messages: Message[]): ChatHistoryMessage[] {
  return messages
    .flatMap((message) => {
      if (!isHistoryRole(message.role) || message.isStreaming || message.isWarning) {
        return [];
      }

      const content = message.content.trim();
      if (!content) {
        return [];
      }

      return [{ role: message.role, content }];
    })
    .slice(-MAX_HISTORY_MESSAGES);
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (request: ChatRequest) => {
    setIsLoading(true);
    setError(null);
    reportClientEvent('chat_send_start', {
      has_images: (request.images?.length ?? 0) > 0,
      image_count: request.images?.length ?? 0,
      message_chars: request.message.length,
    });

    const messageAttachments: MessageAttachment[] =
      request.attachmentPreviews ?? (request.images ?? []).map((file) => ({ name: file.name }));

    const userMessage: Message = {
      id: createClientId('message'),
      role: 'user',
      content: request.message,
      timestamp: new Date(),
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
    };

    const assistantId = createClientId('message');
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    const requestWithHistory: ChatRequest = {
      ...request,
      history: request.history ?? buildConversationHistory(messages),
    };

    reportClientEvent('chat_messages_append_start', {
      has_images: (request.images?.length ?? 0) > 0,
      prior_messages: messages.length,
    });
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    reportClientEvent('chat_messages_append_queued', {
      has_images: (request.images?.length ?? 0) > 0,
    });

    let streamedContent = '';
    let finalResponse: ChatResponse = {
      response: '',
      is_helpful: true,
    };

    try {
      if ((request.images?.length ?? 0) > 0) {
        finalResponse = await chatApi.sendMessage(requestWithHistory);
        reportClientEvent('chat_image_response_received', {
          response_chars: finalResponse.response.length,
          safety_violation: finalResponse.safety_violation ?? false,
        });
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: finalResponse.response,
                  isStreaming: false,
                  isWarning: finalResponse.safety_violation,
                }
              : message,
          ),
        );
        reportClientEvent('chat_image_response_update_queued', {
          response_chars: finalResponse.response.length,
        });
        return finalResponse;
      }

      await chatApi.sendMessageStream(requestWithHistory, (event) => {
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
  }, [messages]);

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
