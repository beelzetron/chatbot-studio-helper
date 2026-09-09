import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../src/App';
import { chatApi } from '../src/api/chatApi';

vi.mock('../src/api/chatApi', () => ({
  chatApi: {
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
    getInfo: vi.fn(),
  },
}));

const mockedChatApi = vi.mocked(chatApi);

function mockStreamResponse(response: string, isHelpful = true): void {
  mockedChatApi.sendMessageStream.mockImplementation(async (_request, onEvent) => {
    onEvent({ type: 'token', content: response });
    onEvent({ type: 'done', is_helpful: isHelpful });
  });
  mockedChatApi.sendMessage.mockResolvedValue({
    response,
    is_helpful: isHelpful,
  });
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedChatApi.getInfo.mockResolvedValue({
      name: 'Study Helper Chatbot',
      version: '1.0.0',
      description: 'Test service',
      guardrails: [],
    });
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
    expect(screen.getByText('Inglese')).toBeInTheDocument();
    expect(screen.getByText('Francese')).toBeInTheDocument();
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

  it('shows grade level selection', () => {
    render(<App />);
    expect(screen.getByText('Livello scolastico')).toBeInTheDocument();
    expect(screen.getByText('Scuole elementari')).toBeInTheDocument();
    expect(screen.getByText('Scuole medie')).toBeInTheDocument();
    expect(screen.getByText('Scuole superiori')).toBeInTheDocument();
  });

  it('sends selected grade level with chat request', async () => {
    mockStreamResponse('This is a test response');

    render(<App />);

    await fireEvent.click(screen.getByText('Scuole elementari'));

    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    await fireEvent.click(screen.getByRole('button', { name: /invia/i }));

    await waitFor(() => {
      expect(mockedChatApi.sendMessageStream).toHaveBeenCalledWith(
        expect.objectContaining({ grade_level: 'primary' }),
        expect.any(Function),
      );
    });
  });

  it('submits message when pressing send button', async () => {
    mockStreamResponse('This is a test response');

    render(<App />);
    
    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    
    const sendButton = screen.getByRole('button', { name: /invia/i });
    await fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockedChatApi.sendMessageStream).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test question' }),
        expect.any(Function),
      );
    });
  });

  it('displays loading state while waiting for response', async () => {
    mockedChatApi.sendMessageStream.mockImplementation(
      () => new Promise(() => {}),
    );

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
    mockedChatApi.sendMessageStream.mockRejectedValue(new Error('Network error'));

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
    mockStreamResponse('### Foto\n\n- Punto con **grassetto** e formula $a^2 + b^2 = c^2$.');

    render(<App />);

    const sendButton = screen.getByRole('button', { name: /invia/i });
    expect(sendButton).toBeDisabled();

    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    const file = new File(['photo'], 'homework.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(screen.getByAltText('homework.jpg')).toBeInTheDocument();

    await fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockedChatApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
          images: expect.arrayContaining([expect.any(File)]),
        }),
      );
    });
    expect(mockedChatApi.sendMessageStream).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { level: 3 })).toHaveTextContent('Foto');
    expect(screen.getByText('grassetto').tagName).toBe('STRONG');
    expect(document.querySelector('.katex')).toBeInTheDocument();
  });

  it('sends an image when crypto.randomUUID is unavailable', async () => {
    mockStreamResponse('Help with your homework photo');
    const originalCrypto = globalThis.crypto;

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: vi.fn((array: Uint8Array) => {
          array.fill(7);
          return array;
        }),
      },
    });

    try {
      render(<App />);

      const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
      const file = new File(['photo'], 'homework.jpg', { type: 'image/jpeg' });
      await fireEvent.change(fileInput, { target: { files: [file] } });
      await fireEvent.click(screen.getByRole('button', { name: /invia/i }));

      await waitFor(() => {
        expect(mockedChatApi.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            message: '',
            images: expect.arrayContaining([file]),
          }),
        );
      });
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it('uses upload limits from service info', async () => {
    mockedChatApi.getInfo.mockResolvedValue({
      name: 'Study Helper Chatbot',
      version: '1.0.0',
      description: 'Test service',
      guardrails: [],
      uploads: {
        max_images: 1,
        max_bytes_per_image: 2 * 1024 * 1024,
        allowed_types: ['image/png'],
      },
    });

    render(<App />);
    await fireEvent.click(screen.getByLabelText('Informazioni'));

    await waitFor(() => {
      expect(screen.getByText(/max 1 immagini, 2 MB ciascuna/i)).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    const jpeg = new File(['photo'], 'homework.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [jpeg] } });

    expect(screen.getByRole('alert')).toHaveTextContent('Formato non supportato');
  });

  it('falls back to default upload limits when service info fails', async () => {
    mockedChatApi.getInfo.mockRejectedValue(new Error('Info unavailable'));

    render(<App />);

    const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    const file = new File(['photo'], 'homework.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByLabelText('Rimuovi homework.jpg')).toBeInTheDocument();
    });
  });

  it('renders markdown in assistant responses', async () => {
    mockStreamResponse('### Titolo\n\nParagrafo con **grassetto** e formula $a^2 + b^2 = c^2$.');

    render(<App />);

    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    await fireEvent.click(screen.getByRole('button', { name: /invia/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Titolo');
      expect(screen.getByText('grassetto').tagName).toBe('STRONG');
      expect(document.querySelector('.katex')).toBeInTheDocument();
    });
  });

  it('renders markdown while streaming before the response completes', async () => {
    let resolveDone: (() => void) | undefined;
    mockedChatApi.sendMessageStream.mockImplementation(async (_request, onEvent) => {
      onEvent({ type: 'token', content: '### Tit' });
      await new Promise<void>((resolve) => {
        resolveDone = resolve;
      });
      onEvent({ type: 'token', content: 'olo' });
      onEvent({ type: 'done', is_helpful: true });
    });

    render(<App />);

    const input = screen.getByPlaceholderText('Chiedi spiegazioni o allega una foto...');
    await fireEvent.change(input, { target: { value: 'Test question' } });
    await fireEvent.click(screen.getByRole('button', { name: /invia/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Tit');
    });

    resolveDone?.();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Titolo');
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
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
  });
});
