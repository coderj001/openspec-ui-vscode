function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text: string): string {
  const codeSpans: string[] = [];
  const token = '%%CODE%%';
  const withCode = text.replace(/`([^`]+)`/g, (_, code: string) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  let html = escapeHtml(withCode);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => `<a href="${escapeHtml(href.trim())}">${label}</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  let index = 0;

  return html.replace(new RegExp(token, 'g'), () => codeSpans[index++] ?? '');
}

export function renderMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
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
    blocks.push(`<${tag} class="md-list">${listItems.join('')}</${tag}>`);
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

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (inCode) {
      if (/^```/.test(line)) {
        flushCode();
      } else {
        codeLines.push(rawLine);
      }

      continue;
    }

    const fenceMatch = line.match(/^```(\w+)?\s*$/);
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
      listItems.push(`<li>${renderInlineMarkdown(listMatch[2])}</li>`);
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
