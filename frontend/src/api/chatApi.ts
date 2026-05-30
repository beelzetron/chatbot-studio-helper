import axios from 'axios';
import type { ChatRequest, ChatResponse } from '../types/chat';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const chatApi = {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await apiClient.post<ChatResponse>('/chat', request);
    return response.data;
  },

  async getHealth(): Promise<{ status: string; service: string }> {
    const response = await apiClient.get('/health');
    return response.data;
  },

  async getInfo(): Promise<{
    name: string;
    version: string;
    description: string;
    guardrails: string[];
  }> {
    const response = await apiClient.get('/info');
    return response.data;
  },
};

export default chatApi;
