import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { ReactNode } from 'react';

interface MarkdownContentProps {
  content: string;
  safeMode?: boolean;
}

function splitOrderedListItem(line: string): string | null {
  const trimmed = line.trimStart();
  const dotIndex = trimmed.indexOf('.');
  if (dotIndex <= 0) {
    return null;
  }

  const marker = trimmed.slice(0, dotIndex);
  if (!/^[0-9]+$/.test(marker) || trimmed.charAt(dotIndex + 1) !== ' ') {
    return null;
  }

  return trimmed.slice(dotIndex + 2);
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < text.length) {
    const codeStart = text.indexOf('`', index);
    const boldStart = text.indexOf('**', index);
    const starts: Array<{ type: 'code' | 'bold'; index: number }> = [];

    if (codeStart !== -1) {
      starts.push({ type: 'code', index: codeStart });
    }
    if (boldStart !== -1) {
      starts.push({ type: 'bold', index: boldStart });
    }

    starts.sort((left, right) => left.index - right.index);
    const next = starts[0];

    if (!next) {
      nodes.push(text.slice(index));
      break;
    }

    if (next.index > index) {
      nodes.push(text.slice(index, next.index));
    }

    if (next.type === 'code') {
      const end = text.indexOf('`', next.index + 1);
      if (end === -1) {
        nodes.push(text.slice(next.index));
        break;
      }
      nodes.push(<code key={`code-${next.index}`}>{text.slice(next.index + 1, end)}</code>);
      index = end + 1;
      continue;
    }

    const end = text.indexOf('**', next.index + 2);
    if (end === -1) {
      nodes.push(text.slice(next.index));
      break;
    }
    nodes.push(<strong key={`bold-${next.index}`}>{text.slice(next.index + 2, end)}</strong>);
    index = end + 2;
  }

  return nodes;
}

function renderSafeMarkdown(content: string): ReactNode[] {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(<h1 key={index}>{renderInlineMarkdown(trimmed.slice(2))}</h1>);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(<h2 key={index}>{renderInlineMarkdown(trimmed.slice(3))}</h2>);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push(<h3 key={index}>{renderInlineMarkdown(trimmed.slice(4))}</h3>);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index].trim();
        if (!item.startsWith('- ') && !item.startsWith('* ')) {
          break;
        }
        items.push(<li key={index}>{renderInlineMarkdown(item.slice(2))}</li>);
        index += 1;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);
      continue;
    }

    const orderedItem = splitOrderedListItem(line);
    if (orderedItem !== null) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = splitOrderedListItem(lines[index]);
        if (item === null) {
          break;
        }
        items.push(<li key={index}>{renderInlineMarkdown(item)}</li>);
        index += 1;
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>);
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const nextLine = lines[index].trim();
      if (
        nextLine.startsWith('# ') ||
        nextLine.startsWith('## ') ||
        nextLine.startsWith('### ') ||
        nextLine.startsWith('- ') ||
        nextLine.startsWith('* ') ||
        splitOrderedListItem(nextLine) !== null
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }

    blocks.push(<p key={index}>{renderInlineMarkdown(paragraphLines.join(' '))}</p>);
  }

  return blocks;
}

export function MarkdownContent({ content, safeMode = false }: MarkdownContentProps) {
  return (
    <div className="markdown-content prose prose-slate prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2">
      {safeMode ? (
        renderSafeMarkdown(content)
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {content}
        </ReactMarkdown>
      )}
    </div>
  );
}
