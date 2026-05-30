import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChat } from '../src/hooks/useChat';
import axios from 'axios';

const mockedAxios = vi.mocked(axios, true);

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty messages', () => {
    const { result } = renderHook(() => useChat());
    
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('adds user message when sending', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        response: 'Test response',
        is_helpful: true,
      },
    });

    const { result } = renderHook(() => useChat());
    
    await result.current.sendMessage({
      message: 'Test question',
      subject: 'Matematica',
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Test question');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Test response');
  });

  it('handles API error gracefully', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useChat());
    
    await result.current.sendMessage({
      message: 'Test question',
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[1].isWarning).toBe(true);
    expect(result.current.messages[1].content).toContain('problema di connessione');
  });

  it('sets loading state during request', async () => {
    const promise = new Promise(() => {});
    mockedAxios.post.mockReturnValue(promise as any);

    const { result } = renderHook(() => useChat());
    
    const requestPromise = result.current.sendMessage({
      message: 'Test question',
    });

    expect(result.current.isLoading).toBe(true);

    await requestPromise;
    expect(result.current.isLoading).toBe(false);
  });

  it('clears messages when requested', () => {
    const { result } = renderHook(() => useChat());
    
    // Add some messages
    result.current.clearMessages();
    
    expect(result.current.messages).toEqual([]);
  });

  it('handles safety violation response', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        response: 'I cannot help with that',
        is_helpful: false,
        safety_violation: true,
        violation_reason: 'Non school topic',
      },
    });

    const { result } = renderHook(() => useChat());
    
    await result.current.sendMessage({
      message: 'How to make money with crypto',
    });

    await waitFor(() => {
      expect(result.current.messages[1].isWarning).toBe(true);
    });
  });
});
