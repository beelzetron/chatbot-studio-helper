import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChat } from '../src/hooks/useChat';
import { chatApi } from '../src/api/chatApi';
import type { ChatStreamEvent } from '../src/types/chat';

vi.mock('../src/api/chatApi', () => ({
  chatApi: {
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
  },
}));

const mockedChatApi = vi.mocked(chatApi);

function mockStream(events: ChatStreamEvent[]): void {
  mockedChatApi.sendMessageStream.mockImplementation(async (_request, onEvent) => {
    for (const event of events) {
      onEvent(event);
    }
  });
}

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
    mockStream([
      { type: 'token', content: 'Test response' },
      { type: 'done', is_helpful: true },
    ]);

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
    expect(result.current.messages[1].isStreaming).toBe(false);
  });

  it('updates assistant message while streaming tokens', async () => {
    mockedChatApi.sendMessageStream.mockImplementation(async (_request, onEvent) => {
      onEvent({ type: 'token', content: 'Hel' });
      onEvent({ type: 'token', content: 'lo' });
      onEvent({ type: 'done', is_helpful: true });
    });

    const { result } = renderHook(() => useChat());

    await result.current.sendMessage({ message: 'Test question' });

    await waitFor(() => {
      expect(result.current.messages[1].content).toBe('Hello');
    });
  });

  it('sends prior text turns as conversation history', async () => {
    mockedChatApi.sendMessageStream
      .mockImplementationOnce(async (_request, onEvent) => {
        onEvent({ type: 'token', content: 'Quiz question' });
        onEvent({ type: 'done', is_helpful: true });
      })
      .mockImplementationOnce(async (_request, onEvent) => {
        onEvent({ type: 'token', content: 'Correct' });
        onEvent({ type: 'done', is_helpful: true });
      });

    const { result } = renderHook(() => useChat());

    await result.current.sendMessage({ message: 'Fammi un quiz sul Giurassico' });

    await waitFor(() => {
      expect(result.current.messages[1].content).toBe('Quiz question');
    });

    await result.current.sendMessage({ message: '1-B, 2-B, 3-A, 4-B, 5-B' });

    await waitFor(() => {
      expect(mockedChatApi.sendMessageStream).toHaveBeenCalledTimes(2);
    });

    expect(mockedChatApi.sendMessageStream.mock.calls[1][0]).toMatchObject({
      message: '1-B, 2-B, 3-A, 4-B, 5-B',
      history: [
        { role: 'user', content: 'Fammi un quiz sul Giurassico' },
        { role: 'assistant', content: 'Quiz question' },
      ],
    });
  });

  it('handles API error gracefully', async () => {
    mockedChatApi.sendMessageStream.mockRejectedValue(new Error('Network error'));

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
    let resolveStream: (() => void) | undefined;
    mockedChatApi.sendMessageStream.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStream = resolve;
        }),
    );

    const { result } = renderHook(() => useChat());

    const requestPromise = result.current.sendMessage({
      message: 'Test question',
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    resolveStream!();
    await requestPromise;

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('clears messages when requested', () => {
    const { result } = renderHook(() => useChat());

    result.current.clearMessages();

    expect(result.current.messages).toEqual([]);
  });

  it('handles safety violation response', async () => {
    mockStream([
      { type: 'token', content: 'I cannot help with that' },
      { type: 'done', is_helpful: false, safety_violation: true, violation_reason: 'Non school topic' },
    ]);

    const { result } = renderHook(() => useChat());

    await result.current.sendMessage({
      message: 'How to make money with crypto',
    });

    await waitFor(() => {
      expect(result.current.messages[1].isWarning).toBe(true);
    });
  });

  it('includes attachment previews in user message', async () => {
    mockedChatApi.sendMessage.mockResolvedValue({
      response: 'Ecco una spiegazione',
      is_helpful: true,
    });

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useChat());

    await result.current.sendMessage({
      message: 'Aiutami',
      images: [file],
    });

    await waitFor(() => {
      expect(result.current.messages[0].attachments).toHaveLength(1);
      expect(result.current.messages[0].attachments?.[0].name).toBe('test.jpg');
      expect(result.current.messages[1].renderAsPlainText).toBe(true);
    });
    expect(mockedChatApi.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ images: [file] }),
    );
    expect(mockedChatApi.sendMessageStream).not.toHaveBeenCalled();
  });
});
