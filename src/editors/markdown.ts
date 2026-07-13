function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6,8})$/.test(value.trim());
}

function hexToRgb(value: string): { readonly r: number; readonly g: number; readonly b: number } | null {
  const hex = value.trim().slice(1);
  const expanded = hex.length === 3 || hex.length === 4
    ? hex.split('').slice(0, 3).map((char) => char + char).join('')
    : hex.slice(0, 6);

  if (expanded.length !== 6) {
    return null;
  }

  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return {
    r: (parsed >> 16) & 0xff,
    g: (parsed >> 8) & 0xff,
    b: parsed & 0xff,
  };
}

function getReadableTextColor(background: string): '#000000' | '#ffffff' {
  const rgb = hexToRgb(background);
  if (!rgb) {
    return '#000000';
  }

  const toLinear = (channel: number): number => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const luminance = (0.2126 * toLinear(rgb.r)) + (0.7152 * toLinear(rgb.g)) + (0.0722 * toLinear(rgb.b));
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);

  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
}

function renderColorCode(code: string): string {
  const trimmed = code.trim();
  if (!isHexColor(trimmed)) {
    return `<code>${escapeHtml(code)}</code>`;
  }

  const textColor = getReadableTextColor(trimmed);
  return `<code class="md-code__color" data-color="${escapeHtml(trimmed)}" data-contrast="${textColor === '#000000' ? 'dark' : 'light'}">${escapeHtml(trimmed)}</code>`;
}

function renderColorCodesInText(html: string): string {
  return html
    .split(/(<[^>]+>)/g)
    .map((segment) => {
      if (segment.startsWith('<')) {
        return segment;
      }

      return segment.replace(/(^|[^A-Za-z0-9_-])(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6,8})(?![A-Za-z0-9_-])/g, (_, prefix: string, color: string) => `${prefix}${renderColorCode(color)}`);
    })
    .join('');
}

type TableAlignment = 'left' | 'center' | 'right';

function splitTableCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutLeadingPipe = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const withoutOuterPipes = withoutLeadingPipe.endsWith('|') ? withoutLeadingPipe.slice(0, -1) : withoutLeadingPipe;

  return withoutOuterPipes.split('|').map((cell) => cell.trim());
}

function parseTableAlignment(cell: string): TableAlignment | undefined | null {
  const normalized = cell.replace(/\s+/g, '');

  if (/^:-{3,}:$/.test(normalized)) {
    return 'center';
  }

  if (/^:-{3,}$/.test(normalized)) {
    return 'left';
  }

  if (/^-{3,}:$/.test(normalized)) {
    return 'right';
  }

  if (/^-{3,}$/.test(normalized)) {
    return undefined;
  }

  return null;
}

function renderTableRow(tag: 'th' | 'td', cells: string[], alignments: Array<TableAlignment | undefined>): string {
  return `<tr>${cells.map((cell, index) => {
    const alignment = alignments[index];
    return `<${tag}${alignment ? ` style="text-align:${alignment}"` : ''}>${renderInlineMarkdown(cell)}</${tag}>`;
  }).join('')}</tr>`;
}

function tryRenderTable(lines: string[], startIndex: number): { readonly html: string; readonly lineCount: number } | null {
  if (startIndex + 1 >= lines.length) {
    return null;
  }

  const headerLine = lines[startIndex].trim();
  const separatorLine = lines[startIndex + 1].trim();
  if (!headerLine.includes('|') || !separatorLine.includes('-')) {
    return null;
  }

  const headerCells = splitTableCells(headerLine);
  const alignments = splitTableCells(separatorLine).map(parseTableAlignment);
  if (headerCells.length < 2 || alignments.length !== headerCells.length || alignments.some((alignment) => alignment === null)) {
    return null;
  }

  const rows: string[][] = [headerCells];
  let index = startIndex + 2;

  while (index < lines.length) {
    const rowLine = lines[index].trim();
    if (!rowLine || !rowLine.includes('|')) {
      break;
    }

    rows.push(splitTableCells(rowLine));
    index += 1;
  }

  const body = rows.slice(1);
  const html = `<table class="md-table"><thead>${renderTableRow('th', rows[0], alignments as Array<TableAlignment | undefined>)}</thead>${body.length === 0 ? '' : `<tbody>${body.map((row) => renderTableRow('td', row, alignments as Array<TableAlignment | undefined>)).join('')}</tbody>`}</table>`;

  return { html, lineCount: rows.length + 1 };
}

function renderInlineMarkdown(text: string): string {
  const codeSpans: string[] = [];
  const token = '%%CODE%%';
  const withCode = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codeSpans.push(renderColorCode(code));
    return token;
  });

  let html = escapeHtml(withCode);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => `<a href="${escapeHtml(href.trim())}">${label}</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = renderColorCodesInText(html);

  let index = 0;

  return html.replace(new RegExp(token, 'g'), () => codeSpans[index++] ?? '');
}

function renderListMarker(kind: 'bullet' | 'ordered' | 'task', checked = false, index = 0): string {
  if (kind === 'task') {
    return `
      <span class="md-list__marker md-list__marker--task ${checked ? 'md-list__marker--checked' : ''}" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="${checked ? 'M6 12l4 4 8-8' : 'M7 7h10v10H7z'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;
  }

  if (kind === 'ordered') {
    return `<span class="md-list__marker md-list__marker--ordered" aria-hidden="true">${index}</span>`;
  }

  return `
    <span class="md-list__marker md-list__marker--bullet" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
      </svg>
    </span>
  `;
}

export function renderMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: Array<{ readonly html: string; readonly kind: 'bullet' | 'ordered' | 'task'; readonly checked?: boolean }> = [];
  let listType: 'ul' | 'ol' | null = null;
  let quoteLines: string[] = [];
  let codeLines: string[] = [];
  let codeLang = '';
  let inCode = false;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(' ').trim())}</p>`);
    paragraph = [];
  };

  const flushList = (): void => {
    if (listItems.length === 0 || !listType) {
      return;
    }

    const tag = listType === 'ol' ? 'ol' : 'ul';
    const className = listItems[0]?.kind === 'task' ? 'md-list md-task-list' : 'md-list';
    blocks.push(`<${tag} class="${className}">${listItems.map((item, index) => {
      const markerKind = item.kind === 'task' ? 'task' : listType === 'ol' ? 'ordered' : 'bullet';
      const marker = renderListMarker(markerKind, Boolean(item.checked), index + 1);

      return `<li class="md-list__item md-list__item--${item.kind}">${marker}<span class="md-list__body">${item.html}</span></li>`;
    }).join('')}</${tag}>`);
    listItems = [];
    listType = null;
  };

  const flushQuote = (): void => {
    if (quoteLines.length === 0) {
      return;
    }

    blocks.push(`<blockquote class="md-quote">${renderMarkdown(quoteLines.join('\n'))}</blockquote>`);
    quoteLines = [];
  };

  const flushCode = (): void => {
    blocks.push(`<pre class="md-code"><code${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
    codeLang = '';
    inCode = false;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();
    const fenceLine = rawLine.trim();

    if (inCode) {
      if (/^```/.test(fenceLine)) {
        flushCode();
      } else {
        codeLines.push(rawLine);
      }

      continue;
    }

    const fenceMatch = fenceLine.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      inCode = true;
      codeLang = fenceMatch[1] ?? '';
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      const headingText = renderInlineMarkdown(headingMatch[2].trim());
      const headingClass = level === 4 && /^scenario\s*:/i.test(headingMatch[2]) ? ' md-heading--scenario' : '';
      blocks.push(`<h${level} class="md-heading md-heading--${level}${headingClass}">${headingText}</h${level}>`);
      continue;
    }

    const table = tryRenderTable(lines, index);
    if (table) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push(table.html);
      index += table.lineCount - 1;
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const listMatch = line.match(/^([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      flushQuote();
      const nextListType: 'ul' | 'ol' = /^\d+\./.test(listMatch[1]) ? 'ol' : 'ul';
      if (listType && listType !== nextListType) {
        flushList();
      }
      listType = nextListType;
      const taskMatch = listMatch[2].match(/^\[( |x|X)\]\s+(.*)$/);

      if (taskMatch) {
        listItems.push({
          html: renderInlineMarkdown(taskMatch[2]),
          kind: 'task',
          checked: taskMatch[1].toLowerCase() === 'x',
        });
      } else {
        listItems.push({
          html: renderInlineMarkdown(listMatch[2]),
          kind: listType === 'ol' ? 'ordered' : 'bullet',
        });
      }
      continue;
    }

    flushQuote();
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushQuote();
  if (inCode) {
    flushCode();
  }

  return blocks.join('') || '<p class="empty">No content yet</p>';
}

function renderCommentLine(lineNumber: number, body: string, extraClass = ''): string {
  return `
    <div class="md-line${extraClass ? ` ${extraClass}` : ''}" data-line="${lineNumber}">
      <div class="md-line__gutter">
        <button type="button" class="md-line__comment-trigger" data-comment-trigger aria-label="Add comment to line ${lineNumber}">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M4 5h16v10H8l-4 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="md-line__main">
        <div class="md-line__content">${body}</div>
        <div class="md-line__composer" data-comment-composer></div>
        <div class="md-line__comments" data-comment-list></div>
      </div>
    </div>
  `;
}

function renderMermaidBlock(lineNumber: number, source: string): string {
  const escapedSource = escapeHtml(source);

  return renderCommentLine(
    lineNumber,
    `
      <div class="md-mermaid">
        <div class="md-mermaid__preview" data-mermaid-preview>Rendering diagram...</div>
        <pre class="md-mermaid__source" data-mermaid-source hidden>${escapedSource}</pre>
        <pre class="md-code md-mermaid__fallback" data-mermaid-fallback hidden><code>${escapedSource}</code></pre>
      </div>
    `,
    'md-line--diagram',
  );
}

function renderTableBlock(lineNumber: number, html: string): string {
  return renderCommentLine(lineNumber, `<div class="md-table-wrap">${html}</div>`, 'md-line--table');
}

export function renderCommentableMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const rendered: string[] = [];
  let inCode = false;
  let codeLang = '';

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const lineNumber = index + 1;
    const line = rawLine.trimEnd();
    const fenceLine = rawLine.trim();

    if (inCode) {
      if (/^```/.test(fenceLine)) {
        rendered.push(renderCommentLine(lineNumber, '<div class="md-code-fence">```</div>', 'md-line--code'));
        inCode = false;
        codeLang = '';
      } else {
        rendered.push(renderCommentLine(
          lineNumber,
          `<pre class="md-code md-code--line"><code${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ''}>${escapeHtml(rawLine)}</code></pre>`,
          'md-line--code',
        ));
      }

      continue;
    }

    const fenceMatch = fenceLine.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      if ((fenceMatch[1] ?? '').toLowerCase() === 'mermaid') {
        const mermaidLines: string[] = [];
        index += 1;

        while (index < lines.length && !/^```/.test(lines[index].trim())) {
          mermaidLines.push(lines[index]);
          index += 1;
        }

        rendered.push(renderMermaidBlock(lineNumber, mermaidLines.join('\n')));
        continue;
      }

      inCode = true;
      codeLang = fenceMatch[1] ?? '';
      rendered.push(renderCommentLine(lineNumber, `<div class="md-code-fence">\`\`\`<span>${escapeHtml(codeLang)}</span></div>`, 'md-line--code'));
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = renderInlineMarkdown(headingMatch[2].trim());
      const headingClass = level === 4 && /^scenario\s*:/i.test(headingMatch[2]) ? ' md-heading--scenario' : '';
      rendered.push(renderCommentLine(lineNumber, `<h${level} class="md-heading md-heading--${level}${headingClass}">${headingText}</h${level}>`));
      continue;
    }

    const table = tryRenderTable(lines, index);
    if (table) {
      rendered.push(renderTableBlock(lineNumber, table.html));
      index += table.lineCount - 1;
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      rendered.push(renderCommentLine(lineNumber, `<blockquote class="md-quote"><p>${renderInlineMarkdown(quoteMatch[1])}</p></blockquote>`));
      continue;
    }

    const listMatch = line.match(/^(\d+\.|[-*])\s+(.*)$/);
    if (listMatch) {
      const marker = listMatch[1];
      const taskMatch = listMatch[2].match(/^\[( |x|X)\]\s+(.*)$/);
      const kind = taskMatch
        ? 'task'
        : /^\d+\./.test(marker)
          ? 'ordered'
          : 'bullet';
      const body = taskMatch ? taskMatch[2] : listMatch[2];
      const markerHtml = renderListMarker(
        kind,
        Boolean(taskMatch && taskMatch[1].toLowerCase() === 'x'),
        kind === 'ordered' ? Number.parseInt(marker, 10) : 0,
      );
      rendered.push(renderCommentLine(
        lineNumber,
        `<div class="md-list__item md-list__item--${kind}">${markerHtml}<span class="md-list__body">${renderInlineMarkdown(body)}</span></div>`,
      ));
      continue;
    }

    rendered.push(renderCommentLine(lineNumber, `<p>${renderInlineMarkdown(line)}</p>`));
  }

  return rendered.join('') || '<p class="empty">No content yet</p>';
}
