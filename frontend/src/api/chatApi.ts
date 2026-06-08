import axios from 'axios';
import type { ChatRequest, ChatResponse, ChatStreamEvent, ServiceInfo } from '../types/chat';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

function buildChatFormData(request: ChatRequest): FormData {
  const formData = new FormData();
  formData.append('message', request.message);

  if (request.subject) {
    formData.append('subject', request.subject);
  }
  if (request.grade_level) {
    formData.append('grade_level', request.grade_level);
  }
  if (request.history && request.history.length > 0) {
    formData.append('history', JSON.stringify(request.history));
  }

  for (const image of request.images ?? []) {
    formData.append('images', image);
  }

  return formData;
}

function parseSseChunk(chunk: string, onEvent: (event: ChatStreamEvent) => void): void {
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data: ')) {
      continue;
    }
    const payload = JSON.parse(line.slice(6)) as ChatStreamEvent;
    onEvent(payload);
  }
}

export const chatApi = {
  async sendMessageStream(
    request: ChatRequest,
    onEvent: (event: ChatStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      body: buildChatFormData(request),
      signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Streaming non supportato dal browser');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (part.trim()) {
          parseSseChunk(part, onEvent);
        }
      }
    }

    if (buffer.trim()) {
      parseSseChunk(buffer, onEvent);
    }
  },

  /** @deprecated Use sendMessageStream for live token updates. */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const formData = buildChatFormData(request);
    const response = await apiClient.post<ChatResponse>('/chat', formData);
    return response.data;
  },

  async getHealth(): Promise<{ status: string; service: string }> {
    const response = await apiClient.get('/health');
    return response.data;
  },

  async getInfo(): Promise<ServiceInfo> {
    const response = await apiClient.get('/info');
    return response.data;
  },
};

export default chatApi;
