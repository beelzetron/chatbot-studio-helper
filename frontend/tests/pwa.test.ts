import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('PWA metadata', () => {
  it('links install metadata from index.html', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');

    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(html).toContain('<meta name="theme-color" content="#3b82f6" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Study Helper" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
  });

  it('defines a standalone app manifest with install icons', () => {
    const manifest = JSON.parse(
      readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'),
    ) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      lang: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };

    expect(manifest).toMatchObject({
      name: 'Study Helper - AI Tutor',
      short_name: 'Study Helper',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: 'it',
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }),
        expect.objectContaining({ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }),
        expect.objectContaining({
          src: '/maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }),
      ]),
    );
  });
});
