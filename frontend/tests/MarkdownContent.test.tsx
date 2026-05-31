import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownContent } from '../src/components/MarkdownContent';

describe('MarkdownContent', () => {
  it('renders inline math expressions', () => {
    render(<MarkdownContent content="La formula $x^2 + y^2 = r^2$ descrive un cerchio." />);
    expect(document.querySelector('.katex')).toBeInTheDocument();
    expect(screen.getByText(/descrive un cerchio/)).toBeInTheDocument();
  });

  it('renders block math expressions', () => {
    render(<MarkdownContent content={'$$\nx = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\n$$'} />);
    const katex = document.querySelector('.katex');
    expect(katex).toBeInTheDocument();
    expect(katex?.parentElement?.classList.contains('katex-display')).toBe(true);
  });
});
