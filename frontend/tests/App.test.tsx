import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../src/App';
import { chatApi } from '../src/api/chatApi';

vi.mock('../src/api/chatApi', () => ({
  chatApi: {
    sendMessage: vi.fn(),
  },
}));

const mockedChatApi = vi.mocked(chatApi);

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
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    expect(input).toBeInTheDocument();
  });

  it('has send and clear buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /invia/i })).toBeInTheDocument();
    expect(screen.getByTitle('Pulisci chat')).toBeInTheDocument();
  });

  it('updates message input when typing', async () => {
    render(<App />);
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    
    await fireEvent.change(input, { target: { value: 'Test message' } });
    
    expect(input).toHaveValue('Test message');
  });

  it('submits message when pressing send button', async () => {
    mockedChatApi.sendMessage.mockResolvedValue({
      response: 'This is a test response',
      is_helpful: true,
    });

    render(<App />);
    
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    
    const sendButton = screen.getByRole('button', { name: /invia/i });
    await fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockedChatApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test question' })
      );
    });
  });

  it('displays loading state while waiting for response', async () => {
    const promise = new Promise(() => {});
    mockedChatApi.sendMessage.mockReturnValue(promise as ReturnType<typeof chatApi.sendMessage>);

    render(<App />);
    
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    
    const sendButton = screen.getByRole('button', { name: /invia/i });
    await fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(input).toBeDisabled();
    });
  });

  it('displays error message when API fails', async () => {
    mockedChatApi.sendMessage.mockRejectedValue(new Error('Network error'));

    render(<App />);
    
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    
    const sendButton = screen.getByRole('button', { name: /invia/i });
    await fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText(/problema di connessione/i)).toBeInTheDocument();
    });
  });

  it('shows attach and camera buttons', () => {
    render(<App />);
    expect(screen.getByLabelText('Allega immagine')).toBeInTheDocument();
    expect(screen.getByLabelText('Scatta foto')).toBeInTheDocument();
  });

  it('enables send with image attachment only', async () => {
    mockedChatApi.sendMessage.mockResolvedValue({
      response: 'Help with your homework photo',
      is_helpful: true,
    });

    render(<App />);

    const sendButton = screen.getByRole('button', { name: /invia/i });
    expect(sendButton).toBeDisabled();

    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    const file = new File(['photo'], 'homework.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    });

    await fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockedChatApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
          images: expect.arrayContaining([expect.any(File)]),
        })
      );
    });
  });

  it('removes attachment preview and disables send again', async () => {
    render(<App />);

    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    const file = new File(['photo'], 'homework.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    const removeButton = await screen.findByLabelText('Rimuovi homework.jpg');
    await fireEvent.click(removeButton);

    expect(screen.getByRole('button', { name: /invia/i })).toBeDisabled();
  });
});
