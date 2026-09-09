import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownContentProps {
  content: string;
  safeMode?: boolean;
}

function isListMarker(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith('- ') ||
    trimmed.startsWith('* ') ||
    trimmed.startsWith('+ ') ||
    getOrderedListText(trimmed) !== null
  );
}

function getOrderedListText(trimmedLine: string): string | null {
  let index = 0;
  while (index < trimmedLine.length && trimmedLine[index] >= '0' && trimmedLine[index] <= '9') {
    index += 1;
  }

  if (index === 0 || index >= trimmedLine.length) {
    return null;
  }

  const marker = trimmedLine[index];
  const next = trimmedLine[index + 1];
  if ((marker === '.' || marker === ')') && next === ' ') {
    return trimmedLine.slice(index + 2);
  }

  return null;
}

function getUnorderedListText(trimmedLine: string): string | null {
  if (
    (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('+ ')) &&
    trimmedLine.length > 2
  ) {
    return trimmedLine.slice(2);
  }

  return null;
}

function getHeading(line: string): { level: 1 | 2 | 3 | 4 | 5 | 6; text: string } | null {
  let level = 0;
  while (level < line.length && line[level] === '#') {
    level += 1;
  }

  if (level < 1 || level > 6 || line[level] !== ' ') {
    return null;
  }

  return { level: level as 1 | 2 | 3 | 4 | 5 | 6, text: line.slice(level + 1).trim() };
}

function parseTableRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith('|')) {
    value = value.slice(1);
  }
  if (value.endsWith('|')) {
    value = value.slice(0, -1);
  }

  return value.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line);
  if (cells.length < 2) {
    return false;
  }

  return cells.every((cell) => {
    let hyphenCount = 0;
    for (const character of cell) {
      if (character === '-') {
        hyphenCount += 1;
      } else if (character !== ':' && character !== ' ') {
        return false;
      }
    }
    return hyphenCount > 0;
  });
}

function isTableStart(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length || !lines[index].includes('|')) {
    return false;
  }

  const headerCells = parseTableRow(lines[index]);
  return headerCells.length >= 2 && isTableSeparator(lines[index + 1]);
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  const pushText = (value: string) => {
    if (value) {
      nodes.push(value);
    }
  };

  while (index < text.length) {
    const codeEnd = text[index] === '`' ? text.indexOf('`', index + 1) : -1;
    if (codeEnd > index) {
      nodes.push(<code key={`code-${key}`}>{text.slice(index + 1, codeEnd)}</code>);
      key += 1;
      index = codeEnd + 1;
      continue;
    }

    const doubleDelimiter = text.startsWith('**', index)
      ? '**'
      : text.startsWith('__', index)
        ? '__'
        : null;
    if (doubleDelimiter) {
      const end = text.indexOf(doubleDelimiter, index + 2);
      if (end > index + 2) {
        nodes.push(<strong key={`strong-${key}`}>{renderInlineMarkdown(text.slice(index + 2, end))}</strong>);
        key += 1;
        index = end + 2;
        continue;
      }
    }

    const singleDelimiter = text[index] === '*' || text[index] === '_' ? text[index] : null;
    if (singleDelimiter && text[index + 1] !== singleDelimiter) {
      const end = text.indexOf(singleDelimiter, index + 1);
      if (end > index + 1) {
        nodes.push(<em key={`em-${key}`}>{renderInlineMarkdown(text.slice(index + 1, end))}</em>);
        key += 1;
        index = end + 1;
        continue;
      }
    }

    const nextSpecials = ['`', '**', '__', '*', '_']
      .map((marker) => text.indexOf(marker, index + 1))
      .filter((position) => position > -1);
    const next = nextSpecials.length > 0 ? Math.min(...nextSpecials) : text.length;
    pushText(text.slice(index, next));
    index = next;
  }

  return nodes;
}

function renderHeading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string, key: string): ReactNode {
  switch (level) {
    case 1:
      return <h1 key={key}>{renderInlineMarkdown(text)}</h1>;
    case 2:
      return <h2 key={key}>{renderInlineMarkdown(text)}</h2>;
    case 3:
      return <h3 key={key}>{renderInlineMarkdown(text)}</h3>;
    case 4:
      return <h4 key={key}>{renderInlineMarkdown(text)}</h4>;
    case 5:
      return <h5 key={key}>{renderInlineMarkdown(text)}</h5>;
    case 6:
      return <h6 key={key}>{renderInlineMarkdown(text)}</h6>;
  }
}

function renderSafeMarkdown(content: string): ReactNode[] {
  const lines = content.split('\r\n').join('\n').split('\r').join('\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push(
        <pre key={`block-${key}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      key += 1;
      continue;
    }

    const heading = getHeading(line.trimStart());
    if (heading) {
      blocks.push(renderHeading(heading.level, heading.text, `block-${key}`));
      key += 1;
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = parseTableRow(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const row = parseTableRow(lines[index]);
        if (row.length > 1) {
          rows.push(row);
        }
        index += 1;
      }

      blocks.push(
        <div key={`block-${key}`} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {headers.map((header, headerIndex) => (
                  <th key={headerIndex}>{renderInlineMarkdown(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((_, cellIndex) => (
                    <td key={cellIndex}>{renderInlineMarkdown(row[cellIndex] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      key += 1;
      continue;
    }

    const firstUnordered = getUnorderedListText(line.trimStart());
    if (firstUnordered !== null) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemText = getUnorderedListText(lines[index].trimStart());
        if (itemText === null) {
          break;
        }
        items.push(itemText);
        index += 1;
      }
      blocks.push(
        <ul key={`block-${key}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      key += 1;
      continue;
    }

    const firstOrdered = getOrderedListText(line.trimStart());
    if (firstOrdered !== null) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemText = getOrderedListText(lines[index].trimStart());
        if (itemText === null) {
          break;
        }
        items.push(itemText);
        index += 1;
      }
      blocks.push(
        <ol key={`block-${key}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      key += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trimStart().startsWith('> ')) {
        quoteLines.push(lines[index].trimStart().slice(2));
        index += 1;
      }
      blocks.push(
        <blockquote key={`block-${key}`}>
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex}>{renderInlineMarkdown(quoteLine)}</p>
          ))}
        </blockquote>,
      );
      key += 1;
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index];
      const nextTrimmed = nextLine.trim();
      if (
        !nextTrimmed ||
        nextTrimmed.startsWith('```') ||
        getHeading(nextLine.trimStart()) ||
        isTableStart(lines, index) ||
        isListMarker(nextLine) ||
        nextTrimmed.startsWith('> ')
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      index += 1;
    }

    blocks.push(<p key={`block-${key}`}>{renderInlineMarkdown(paragraphLines.join(' '))}</p>);
    key += 1;
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
