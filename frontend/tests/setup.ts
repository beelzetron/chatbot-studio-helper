import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: () => ({
      post: vi.fn(),
      get: vi.fn(),
    }),
  },
}));
