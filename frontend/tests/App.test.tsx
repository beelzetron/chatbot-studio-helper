import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../src/App';
import axios from 'axios';

const mockedAxios = vi.mocked(axios, true);

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app header', () => {
    render(<App />);
    expect(screen.getByText('Study Helper')).toBeInTheDocument();
    expect(screen.getByText('AI Tutor per lo studio')).toBeInTheDocument();
  });

  it('displays welcome message when no messages', () => {
    render(<App />);
    expect(screen.getByText('Benvenuto su Study Helper!')).toBeInTheDocument();
  });

  it('shows subject list', () => {
    render(<App />);
    expect(screen.getByText('Matematica')).toBeInTheDocument();
    expect(screen.getByText('Italiano')).toBeInTheDocument();
    expect(screen.getByText('Scienze')).toBeInTheDocument();
  });

  it('has an input field for messages', () => {
    render(<App />);
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o esempi...');
    expect(input).toBeInTheDocument();
  });

  it('has send and clear buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    expect(screen.getByTitle('Pulisci chat')).toBeInTheDocument();
  });

  it('updates message input when typing', async () => {
    render(<App />);
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o esempi...');
    
    await fireEvent.change(input, { target: { value: 'Test message' } });
    
    expect(input).toHaveValue('Test message');
  });

  it('submits message when pressing send button', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        response: 'This is a test response',
        is_helpful: true,
      },
    });

    render(<App />);
    
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o esempi...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/chat', expect.any(Object));
    });
  });

  it('displays loading state while waiting for response', async () => {
    const promise = new Promise(() => {}); // Never resolves
    mockedAxios.post.mockReturnValue(promise as any);

    render(<App />);
    
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o esempi...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await fireEvent.click(sendButton);
    
    // Check for loading indicator (three bouncing dots)
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('displays error message when API fails', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network error'));

    render(<App />);
    
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o esempi...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText(/problema di connessione/i)).toBeInTheDocument();
    });
  });
});
