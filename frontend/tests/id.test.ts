import { describe, expect, it, vi } from 'vitest';
import { createClientId } from '../src/utils/id';

describe('createClientId', () => {
  it('falls back when crypto.randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: vi.fn((array: Uint8Array) => {
          array.fill(10);
          return array;
        }),
      },
    });

    try {
      expect(createClientId('message')).toMatch(/^message-[a-z0-9]+-[a-z0-9]+-(0a){12}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto,
      });
    }
  });
});
