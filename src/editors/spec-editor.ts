import * as vscode from 'vscode';
import { getCommentFileLabel } from './comment-export';
import { renderCommentableMarkdown } from './markdown';
import { resolveOpenFileUri } from './open-file-target';
import { specSectionNames } from '../specs/parser';
import { ChangeDocument, readChangeDocument, readSpecDocument, SpecDocument } from '../specs/service';
import { getSpecFolderName, isChangeFilePath } from '../specs/paths';

class OpenspecDocument implements vscode.CustomDocument {
  public constructor(public readonly uri: vscode.Uri) {}
  public dispose(): void {}
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderIcon(name: string): string {
  const paths: Record<string, string> = {
    proposal: 'M7 3h8l4 4v14H7z M15 3v4h4',
    design: 'M4 17l6-6 4 4 6-10 2 2-8 13-4-4-6 6z',
    tasks: 'M5 6h14M5 12h14M5 18h10',
    specs: 'M6 4h12v16H6z M9 8h6M9 12h6M9 16h4',
    markdown: 'M5 6h14M5 10h8M5 14h12M5 18h8',
    file: 'M7 3h7l4 4v14H7z M14 3v4h4',
    comment: 'M4 5h16v10H8l-4 4z',
    copy: 'M9 9h10v12H9z M5 3h10v12H5z',
    refresh: 'M18 8V4m0 0h-4m4 0-3 3M6 16v4m0 0h4m-4 0 3-3M7.5 8.5A5 5 0 0 1 16 7m.5 8.5A5 5 0 0 1 8 17',
  };

  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] ?? paths.markdown}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderSection(name: string, content: string): string {
  return `
    <section class="source-section">
      <h2 class="source-section__title">${renderIcon('markdown')}${escapeHtml(name)}</h2>
      ${content ? renderCommentableMarkdown(content) : '<p class="empty">No content yet</p>'}
    </section>
  `;
}

function renderRawSpec(spec: SpecDocument): string {
  return `
    <section class="source-section">
      ${spec.rawText ? renderCommentableMarkdown(spec.rawText) : '<p class="empty">No content yet</p>'}
    </section>
  `;
}

function renderHeaderActions(currentUri: string): string {
  return `
    <div class="actions">
      <button type="button" class="action" data-action="copy-comments">
        ${renderIcon('copy')}
        <span>Copy Comments</span>
      </button>
      <button type="button" class="action" data-action="open-file" data-uri="${escapeHtml(currentUri)}" ${currentUri ? '' : 'disabled'}>
        ${renderIcon('file')}
        <span>Open File</span>
      </button>
      <button type="button" class="action" data-action="refresh-view">
        ${renderIcon('refresh')}
        <span>Refresh</span>
      </button>
    </div>
  `;
}

function getEditorChrome(cspSource: string, nonce: string): string {
  return `
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}' ${cspSource};">
  `;
}

function getMermaidBootScript(): string {
  return `
        const escapeHtmlText = (value) => value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] || char));
        const resolveMermaidApi = () => {
          const bundled = globalThis.__esbuild_esm_mermaid_nm?.mermaid;
          const direct = globalThis.mermaid;
          return bundled?.default || bundled || direct?.default || direct || null;
        };
        const getCssVar = (styles, name, fallback) => styles.getPropertyValue(name).trim() || fallback;
        const getFontSize = (styles) => {
          const value = Number.parseFloat(getCssVar(styles, '--vscode-font-size', '13'));
          return Number.isFinite(value) ? Math.max(12, Math.min(14, value)) : 13;
        };
        const isDarkColor = (color) => {
          const match = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
          if (!match) {
            return true;
          }
          const [, r, g, b] = match;
          const luminance = (0.2126 * Number(r)) + (0.7152 * Number(g)) + (0.0722 * Number(b));
          return luminance < 140;
        };
        const isStateDiagramSource = (source) => /^\\s*stateDiagram(?:-v2)?\\b/i.test(source);
        const getMermaidConfig = () => {
          const styles = getComputedStyle(document.body);
          const background = getCssVar(styles, '--vscode-editorWidget-background', '#1f1f28');
          const editorBackground = getCssVar(styles, '--vscode-editor-background', background);
          const foreground = getCssVar(styles, '--vscode-editor-foreground', '#d4d4d4');
          const border = getCssVar(styles, '--vscode-panel-border', '#3f3f46');
          const accent = getCssVar(styles, '--vscode-textLink-foreground', '#4da3ff');
          const note = getCssVar(styles, '--vscode-sideBar-background', editorBackground);
          const error = getCssVar(styles, '--vscode-errorForeground', '#f48771');
          // Mermaid state diagrams are sensitive to font metrics; use a stable UI stack.
          const fontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
          const fontSize = getFontSize(styles);
          const cardBackground = isDarkColor(background) ? '#f4f4f5' : '#ffffff';
          const cardText = '#111111';
          const labelBackground = isDarkColor(background) ? '#eef2a3' : '#f4f1a6';

          return {
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'base',
            look: 'classic',
            fontFamily,
            fontSize,
            themeVariables: {
              background,
              primaryColor: cardBackground,
              primaryBorderColor: border,
              primaryTextColor: cardText,
              secondaryColor: cardBackground,
              secondaryBorderColor: border,
              secondaryTextColor: cardText,
              tertiaryColor: note,
              tertiaryBorderColor: border,
              tertiaryTextColor: foreground,
              lineColor: accent,
              transitionColor: accent,
              textColor: foreground,
              mainBkg: background,
              nodeBkg: cardBackground,
              nodeBorder: border,
              clusterBkg: note,
              clusterBorder: border,
              titleColor: foreground,
              edgeLabelBackground: labelBackground,
              labelBackgroundColor: labelBackground,
              labelTextColor: cardText,
              actorBkg: cardBackground,
              actorBorder: border,
              actorTextColor: cardText,
              actorLineColor: accent,
              signalColor: accent,
              signalTextColor: foreground,
              labelBoxBkgColor: labelBackground,
              labelBoxBorderColor: border,
              labelTextColor: cardText,
              loopTextColor: foreground,
              noteBkgColor: note,
              noteBorderColor: border,
              noteTextColor: foreground,
              stateBkg: cardBackground,
              stateBorder: border,
              stateLabelColor: cardText,
              transitionLabelColor: foreground,
              compositeBackground: editorBackground,
              compositeTitleBackground: note,
              altBackground: note,
              specialStateColor: accent,
              innerEndBackground: cardBackground,
              activationBorderColor: border,
              activationBkgColor: note,
              sequenceNumberColor: foreground,
              errorBkgColor: background,
              errorTextColor: error,
              pie1: accent,
              pie2: border,
              pie3: note,
              pie4: background,
            },
            flowchart: {
              useMaxWidth: true,
              htmlLabels: false,
            },
            sequence: {
              useMaxWidth: true,
              wrap: true,
            },
          };
        };
        const applyMermaidSvgTheme = (preview, source) => {
          const svg = preview.querySelector('svg');
          if (!svg) {
            return;
          }

          const styles = getComputedStyle(document.body);
          const background = getCssVar(styles, '--vscode-editorWidget-background', '#1f1f28');
          const editorBackground = getCssVar(styles, '--vscode-editor-background', background);
          const foreground = getCssVar(styles, '--vscode-editor-foreground', '#d4d4d4');
          const border = getCssVar(styles, '--vscode-panel-border', '#3f3f46');
          const accent = getCssVar(styles, '--vscode-textLink-foreground', '#4da3ff');
          const note = getCssVar(styles, '--vscode-sideBar-background', editorBackground);
          const cardBackground = isDarkColor(background) ? '#f4f4f5' : '#ffffff';
          const cardText = '#111111';
          const labelBackground = isDarkColor(background) ? '#eef2a3' : '#f4f1a6';
          const applyInline = (selector, styleMap) => {
            svg.querySelectorAll(selector).forEach((node) => {
              Object.entries(styleMap).forEach(([key, value]) => {
                node.style.setProperty(key, value, 'important');
              });
            });
          };
          const getSvgIntrinsicWidth = () => {
            const width = Number.parseFloat(svg.getAttribute('width') || '');
            if (Number.isFinite(width) && width > 0) {
              return width;
            }

            const viewBox = svg.getAttribute('viewBox')?.trim().split(/\\s+/).map(Number);
            const viewBoxWidth = viewBox?.[2];
            return Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 ? viewBoxWidth : undefined;
          };
          const expandSvgViewBox = (paddingX, paddingY) => {
            const parts = svg.getAttribute('viewBox')?.trim().split(/\\s+/).map(Number);
            if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
              return;
            }

            const [x, y, width, height] = parts;
            svg.setAttribute('viewBox', [
              x - paddingX,
              y - paddingY,
              width + (paddingX * 2),
              height + (paddingY * 2),
            ].join(' '));
          };
          const applyStateDiagramTheme = () => {
            applyInline('.transition, .edgePath path, path.transition, .flowchart-link', {
              fill: 'none',
              stroke: accent,
            });
            applyInline('marker path, [id$="-barbEnd"], [id$="-dependencyStart"], [id$="-dependencyEnd"]', {
              fill: accent,
              stroke: accent,
            });
            applyInline('.statediagram-state rect, .stateGroup rect, .node rect.basic', {
              fill: cardBackground,
              stroke: border,
            });
            applyInline('.statediagram-cluster rect, .cluster rect, .stateGroup .composit, .stateGroup .alt-composit', {
              fill: note,
              stroke: border,
            });
            applyInline('.statediagram-cluster .inner', {
              fill: editorBackground,
              stroke: border,
            });
            applyInline('.statediagram-state .divider, .stateGroup line', {
              fill: 'none',
              stroke: border,
            });
            applyInline('.node circle.state-start, .node .fork-join', {
              fill: accent,
              stroke: accent,
            });
            applyInline('.node circle.state-end', {
              fill: cardText,
              stroke: cardBackground,
            });
            applyInline('.end-state-inner', {
              fill: cardBackground,
              stroke: cardBackground,
            });
            applyInline('.edgeLabel rect, .stateLabel .box, .labelBox, .label-container', {
              fill: labelBackground,
              stroke: 'none',
            });
            applyInline('.statediagram-state text, .statediagram-state tspan, .stateGroup text, .stateGroup tspan, .nodeLabel, .nodeLabel *, .stateLabel, .stateLabel *', {
              fill: cardText,
              color: cardText,
            });
            applyInline('.statediagram-note rect, .state-note', {
              fill: note,
              stroke: border,
            });
            applyInline('.statediagram-note text, .statediagram-note .nodeLabel, .state-note text', {
              fill: foreground,
              color: foreground,
            });
          };
          const viewBox = svg.getAttribute('viewBox');
          if (!viewBox) {
            const width = Number.parseFloat(svg.getAttribute('width') || '');
            const height = Number.parseFloat(svg.getAttribute('height') || '');
            if (Number.isFinite(width) && Number.isFinite(height)) {
              svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            }
          }
          svg.removeAttribute('height');
          svg.removeAttribute('width');
          svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
          const intrinsicWidth = getSvgIntrinsicWidth();
          const stateDiagram = isStateDiagramSource(source);
          svg.style.width = '100%';
          svg.style.height = 'auto';
          applyInline('.edgePath path, path.flowchart-link, .flowchart-link, .relationshipLine, .transition', {
            fill: 'none',
            stroke: accent,
          });

          if (stateDiagram) {
            expandSvgViewBox(32, 24);
            preview.style.overflowX = 'auto';
            preview.style.overflowY = 'hidden';
            svg.style.maxWidth = intrinsicWidth ? Math.ceil(intrinsicWidth) + 'px' : 'none';
            applyStateDiagramTheme();
            return;
          }

          preview.style.overflow = 'hidden';
          svg.style.maxWidth = intrinsicWidth ? Math.min(Math.ceil(intrinsicWidth), 880) + 'px' : '100%';

          const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
          style.textContent = \`
            text, tspan, foreignObject, .messageText, .noteText {
              fill: \${foreground} !important;
              color: \${foreground} !important;
            }
            .labelBox, .label-container, .node rect, .node circle, .node ellipse, .node polygon, .node path {
              fill: \${cardBackground} !important;
              stroke: \${border} !important;
            }
            .nodeLabel, .nodeLabel *, .actor + text, text.actor, .actor text {
              fill: \${cardText} !important;
              color: \${cardText} !important;
              text-anchor: middle !important;
              dominant-baseline: middle !important;
            }
            .cluster rect, .cluster polygon {
              fill: \${note} !important;
              stroke: \${border} !important;
            }
            rect.actor, .actor-line, .activation0, .activation1, .activation2, .activation3 {
              fill: \${cardBackground} !important;
              stroke: \${border} !important;
            }
            .messageLine0, .messageLine1, .loopLine, .noteLine, .sequenceNumber {
              stroke: \${accent} !important;
              fill: \${foreground} !important;
            }
            .edgePath path, .flowchart-link, .relationshipLine, .entityBox, .entityLabel {
              stroke: \${accent} !important;
              fill: none !important;
            }
            .labelBox, .label-container {
              fill: \${labelBackground} !important;
              stroke: \${border} !important;
            }
            .note, .note rect {
              fill: \${note} !important;
              stroke: \${border} !important;
            }
            .section, .section0, .section1, .section2, .section3 {
              fill: \${editorBackground} !important;
              stroke: \${border} !important;
            }
          \`;
          svg.append(style);
          applyInline('text.actor, text.actor > tspan, .actor + text, .actor + text > tspan, .nodeLabel, .nodeLabel *', {
            fill: cardText,
            color: cardText,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
          });
          applyInline('rect.actor.actor-box, rect.actor.actor-top, rect.actor.actor-bottom, rect.actor, .node rect, .node circle, .node ellipse, .node polygon, .node path', {
            fill: cardBackground,
            stroke: border,
          });
          applyInline('.labelBox, .label-container', {
            fill: labelBackground,
            stroke: border,
          });
        };

        const renderMermaidDiagrams = async () => {
          const mermaidApi = resolveMermaidApi();
          const diagrams = [...document.querySelectorAll('.md-mermaid')];

          if (!mermaidApi) {
            diagrams.forEach((diagram) => {
              const preview = diagram.querySelector('[data-mermaid-preview]');
              const fallback = diagram.querySelector('[data-mermaid-fallback]');
              if (preview) {
                preview.innerHTML = '<div class="md-mermaid__error">Mermaid failed to load</div>';
              }
              if (fallback) {
                fallback.hidden = false;
              }
            });
            return;
          }

          mermaidApi.initialize(getMermaidConfig());

          for (const [index, diagram] of diagrams.entries()) {
            const sourceNode = diagram.querySelector('[data-mermaid-source]');
            const source = sourceNode?.textContent || '';
            const preview = diagram.querySelector('[data-mermaid-preview]');
            const fallback = diagram.querySelector('[data-mermaid-fallback]');
            if (!preview) {
              continue;
            }

            try {
              const result = await mermaidApi.render('openspec-mermaid-' + index + '-' + Date.now(), source);
              preview.innerHTML = '<div class="md-mermaid__canvas">' + result.svg + '</div>';
              applyMermaidSvgTheme(preview, source);
              if (fallback) {
                fallback.hidden = true;
              }
            } catch (error) {
              const message = error instanceof Error
                ? error.message
                : typeof error === 'string'
                  ? error
                  : 'Invalid mermaid diagram';
              preview.innerHTML = '<div class="md-mermaid__error">Invalid mermaid diagram: ' + escapeHtmlText(message) + '</div>';
              if (fallback) {
                fallback.hidden = false;
              }
            }
          }
        };
        const applyColorCodeTheme = () => {
          document.querySelectorAll('.md-code__color[data-color]').forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return;
            }

            const color = node.getAttribute('data-color') || '';
            const contrast = node.getAttribute('data-contrast') || 'dark';
            if (!/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6,8})$/.test(color)) {
              return;
            }

            node.style.backgroundColor = color;
            node.style.color = contrast === 'dark' ? '#000000' : '#ffffff';
            node.style.borderColor = contrast === 'dark' ? 'rgba(0, 0, 0, 0.24)' : 'rgba(255, 255, 255, 0.22)';
          });
        };
        applyColorCodeTheme();
  `;
}

function renderSpecSections(spec: SpecDocument, includeEmpty: boolean): string {
  const sections = specSectionNames
    .filter((section) => includeEmpty || spec.sections[section])
    .map((section) => renderSection(section, spec.sections[section]))
    .join('');

  return sections || renderRawSpec(spec);
}

function getMermaidCss(): string {
  return `
        .md-mermaid {
          display: grid;
          gap: 6px;
          width: 100%;
        }
        .md-mermaid__preview {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editorWidget-background);
          overflow: hidden;
        }
        .md-mermaid__canvas {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
        }
        .md-mermaid__preview svg {
          display: block;
          width: min(100%, 880px);
          max-width: 100%;
          height: auto;
          margin: 0 auto;
        }
        .md-mermaid__preview svg line,
        .md-mermaid__preview svg path,
        .md-mermaid__preview svg rect,
        .md-mermaid__preview svg polygon,
        .md-mermaid__preview svg circle,
        .md-mermaid__preview svg ellipse {
          vector-effect: non-scaling-stroke;
        }
        .md-mermaid__fallback[hidden] {
          display: none;
        }
        .md-mermaid__source[hidden] {
          display: none;
        }
        .md-mermaid__error {
          color: var(--vscode-errorForeground);
          font-weight: 600;
          line-height: 1.5;
        }
        .md-line--diagram {
          padding: 0;
        }
        .md-line--diagram .md-line__content {
          min-height: 0;
        }
  `;
}

function renderSourceSpecBody(spec: SpecDocument): string {
  const progress = spec.taskProgress.total === 0 ? 0 : Math.round((spec.taskProgress.completed / spec.taskProgress.total) * 100);
  const currentUri = resolveOpenFileUri(spec) ?? '';

  return `
    <div class="hero hero--source">
      <div>
        <h1 class="title">${renderIcon('markdown')}${escapeHtml(spec.title)}</h1>
        <p class="meta">${escapeHtml(spec.uri.fsPath)}</p>
        <span class="pill">${escapeHtml(spec.status)} · ${progress}% tasks done</span>
      </div>
      ${renderHeaderActions(currentUri)}
    </div>
    <section class="metrics">
      ${specSectionNames.map((section) => `
        <div class="metric">
          <span>${section}</span>
          <strong>${spec.sections[section] ? 'Ready' : 'Empty'}</strong>
        </div>
      `).join('')}
    </section>
    ${renderSpecSections(spec, true)}
  `;
}

function renderEmbeddedSpecBody(spec: SpecDocument): string {
  return renderSpecSections(spec, false);
}

function renderSourceSpec(spec: SpecDocument, cspSource: string, nonce: string, mermaidScriptUri: string): string {
  const currentUri = resolveOpenFileUri(spec) ?? '';
  const commentOwnerLabel = getSpecFolderName(spec.uri.fsPath) ?? spec.title;
  const commentFileLabel = getCommentFileLabel(spec.uri.fsPath);

  return /* html */ `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${getEditorChrome(cspSource, nonce)}
      <style nonce="${nonce}">
        :root {
          color-scheme: var(--vscode-color-scheme);
        }
        body {
          margin: 0;
          padding: 12px;
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          font-family: var(--vscode-font-family);
        }
        .shell {
          max-width: 1200px;
          margin: 0 auto;
        }
        .hero {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .shell,
        .source-section,
        .panel {
          font-size: var(--vscode-editor-font-size);
        }
        .title {
          margin: 0 0 4px;
          font-size: 1.35rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .meta {
          margin: 0 0 10px;
          color: var(--vscode-descriptionForeground);
        }
        .pill {
          display: inline-block;
          padding: 4px 10px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 999px;
          color: var(--vscode-badge-foreground);
          background: var(--vscode-badge-background);
        }
        .action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          padding: 8px 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .action:hover,
        .action:focus-visible {
          border-color: var(--vscode-focusBorder);
        }
        .action:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 12px 0;
        }
        .metric, .source-section {
          background: var(--vscode-sideBar-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .metric span {
          display: block;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 6px;
        }
        .metric strong {
          font-size: 1.1rem;
        }
        .source-section {
          margin-top: 8px;
        }
        .source-section__title {
          margin: 0 0 8px;
          font-size: 0.95rem;
          color: var(--vscode-textLink-foreground);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .icon {
          width: 16px;
          height: 16px;
          flex: 0 0 auto;
          color: var(--vscode-descriptionForeground);
        }
        .md-heading {
          margin: 0;
          line-height: 1.2;
        }
        .md-heading--1 {
          font-size: 1.4rem;
        }
        .md-heading--2 {
          font-size: 1.15rem;
        }
        .md-heading--3,
        .md-heading--4,
        .md-heading--5,
        .md-heading--6 {
          font-size: 1rem;
        }
        .md-heading--scenario {
          color: var(--vscode-textLink-foreground);
        }
        .md-list {
          margin: 0.6em 0 0;
          padding: 0;
          list-style: none;
        }
        .md-list__item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin: 0;
          transition: transform 120ms ease, color 120ms ease;
        }
        .md-list__item:hover {
          transform: translateX(2px);
        }
        .md-list__marker {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 1.1em;
          height: 1.1em;
          margin-top: 0.15em;
          border-radius: 999px;
          color: var(--vscode-textLink-foreground);
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 14%, transparent);
          transition: transform 120ms ease, background 120ms ease, color 120ms ease;
        }
        .md-list__item:hover .md-list__marker {
          transform: scale(1.05);
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 22%, transparent);
        }
        .md-list__marker svg {
          width: 0.9em;
          height: 0.9em;
        }
        .md-list__marker--ordered {
          font-size: 0.8em;
          font-weight: 600;
        }
        .md-list__marker--task {
          color: var(--vscode-charts-green);
          background: color-mix(in srgb, var(--vscode-charts-green) 14%, transparent);
        }
        .md-list__marker--checked {
          color: var(--vscode-charts-green);
          background: color-mix(in srgb, var(--vscode-charts-green) 22%, transparent);
        }
        .md-list__body {
          min-width: 0;
          flex: 1 1 auto;
        }
        .md-quote {
          margin: 0;
          padding: 0.1em 0 0.1em 1em;
          border-left: 3px solid var(--vscode-panel-border);
          color: var(--vscode-descriptionForeground);
        }
        .md-code {
          margin: 0;
          padding: 12px 14px;
          border-radius: 10px;
          overflow-x: auto;
          background: var(--vscode-editorWidget-background);
          border: 1px solid var(--vscode-panel-border);
        }
        .md-code--line {
          padding: 8px 12px;
        }
        .md-code-fence {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          color: var(--vscode-descriptionForeground);
          font-family: var(--vscode-editor-font-family);
        }
        .md-code code {
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
        }
        p {
          margin: 0;
          line-height: 1.6;
        }
        a {
          color: var(--vscode-textLink-foreground);
        }
        strong {
          font-weight: 600;
        }
        em {
          font-style: italic;
        }
        code:not(.md-code code) {
          padding: 0.08em 0.35em;
          border-radius: 6px;
          background: var(--vscode-editorWidget-background);
          border: 1px solid var(--vscode-panel-border);
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
          line-height: 1.55;
        }
        .md-table-wrap {
          width: 100%;
          overflow-x: auto;
          margin-top: 0.2em;
        }
        .md-table {
          width: 100%;
          min-width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 10px;
          overflow: hidden;
          background: var(--vscode-editorWidget-background);
          font-size: 0.95em;
        }
        .md-table th,
        .md-table td {
          padding: 0.65em 0.8em;
          border-right: 1px solid var(--vscode-panel-border);
          border-bottom: 1px solid var(--vscode-panel-border);
          text-align: left;
          vertical-align: top;
        }
        .md-table th:last-child,
        .md-table td:last-child {
          border-right: 0;
        }
        .md-table tr:last-child td,
        .md-table tr:last-child th {
          border-bottom: 0;
        }
        .md-table th {
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 10%, var(--vscode-editorWidget-background));
          font-weight: 600;
        }
        .md-table tbody tr:nth-child(even) td {
          background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-sideBar-background));
        }
        .md-line {
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
          padding: 1px 0;
        }
        .md-line--table .md-line__content {
          align-items: stretch;
        }
        .md-line:hover .md-line__comment-trigger,
        .md-line--active .md-line__comment-trigger {
          opacity: 1;
          transform: scale(1);
        }
        .md-line__gutter {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0;
          min-height: 28px;
          padding-top: 3px;
        }
        .md-line__comment-trigger {
          opacity: 0;
          transform: scale(0.92);
          width: 22px;
          height: 22px;
          padding: 0;
          border-radius: 999px;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editorWidget-background);
          color: var(--vscode-descriptionForeground);
          cursor: pointer;
          transition: opacity 120ms ease, transform 120ms ease, border-color 120ms ease;
        }
        .md-line__comment-trigger:hover,
        .md-line__comment-trigger:focus-visible {
          border-color: var(--vscode-focusBorder);
          color: var(--vscode-textLink-foreground);
        }
        .md-line__comment-trigger svg {
          width: 14px;
          height: 14px;
        }
        .md-line__main {
          min-width: 0;
        }
        .md-line__content {
          min-height: 28px;
          display: flex;
          align-items: center;
        }
        .md-line__content > * {
          width: 100%;
        }
        .md-line + .md-line {
          margin-top: 2px;
        }
        .md-line__spacer {
          min-height: 1.2em;
        }
        .md-line__composer,
        .md-line__comments {
          margin-top: 8px;
        }
        .md-comment-composer {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editorWidget-background);
        }
        .md-comment-composer input {
          min-width: 0;
          flex: 1 1 auto;
          border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
          border-radius: 6px;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          padding: 7px 10px;
          font: inherit;
        }
        .md-comment-composer button,
        .md-comment-composer .ghost {
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 7px 10px;
          cursor: pointer;
        }
        .md-comment-composer button {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        .md-comment-composer .ghost {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        .md-comment-list {
          display: grid;
          gap: 6px;
        }
        .md-comment {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--vscode-panel-border);
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 8%, var(--vscode-editorWidget-background));
        }
        .md-comment__icon {
          width: 16px;
          height: 16px;
          color: var(--vscode-textLink-foreground);
          flex: 0 0 auto;
          margin-top: 2px;
        }
        .md-comment__text {
          line-height: 1.5;
          word-break: break-word;
        }
        ${getMermaidCss()}
      </style>
    </head>
    <body>
      <main class="shell">
        ${renderSourceSpecBody(spec)}
      </main>
      <script nonce="${nonce}" src="${mermaidScriptUri}"></script>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        ${getMermaidBootScript()}
        const openFileButton = document.querySelector('[data-action="open-file"]');
        const copyCommentsButton = document.querySelector('[data-action="copy-comments"]');
        const refreshButton = document.querySelector('[data-action="refresh-view"]');
        const currentUri = ${JSON.stringify(currentUri)};
        const ownerLabel = ${JSON.stringify(commentOwnerLabel)};
        const fileLabel = ${JSON.stringify(commentFileLabel)};
        const comments = [];
        let activeComposerKey = '';
        const commentIcon = ${JSON.stringify(renderIcon('comment'))};
        const escapeAttribute = (value) => value
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const getLineKey = (fileUri, line) => fileUri + '#' + line;
        const getLineMeta = (lineElement) => ({
          fileUri: currentUri,
          fileLabel,
          ownerLabel,
          line: Number(lineElement.getAttribute('data-line') || '0'),
        });
        const renderCommentState = () => {
          document.querySelectorAll('.md-line').forEach((lineElement) => {
            const meta = getLineMeta(lineElement);
            const key = getLineKey(meta.fileUri, meta.line);
            lineElement.classList.toggle('md-line--active', activeComposerKey === key);
            const composer = lineElement.querySelector('[data-comment-composer]');
            const commentList = lineElement.querySelector('[data-comment-list]');
            const lineComments = comments.filter((comment) => comment.fileUri === meta.fileUri && comment.line === meta.line);
            if (commentList) {
              commentList.innerHTML = lineComments.length === 0
                ? ''
                : '<div class="md-comment-list">' + lineComments.map((comment) => '<div class="md-comment">' + commentIcon + '<div class="md-comment__text"></div></div>').join('') + '</div>';
              if (commentList.firstElementChild) {
                [...commentList.querySelectorAll('.md-comment__text')].forEach((node, index) => {
                  node.textContent = lineComments[index]?.text || '';
                });
              }
            }
            if (composer) {
              if (activeComposerKey !== key) {
                composer.innerHTML = '';
              } else {
                composer.innerHTML = '<form class="md-comment-composer"><input type="text" maxlength="500" placeholder="Add comment" /><button type="submit">Add</button><button type="button" class="ghost">Cancel</button></form>';
                const form = composer.querySelector('form');
                const input = composer.querySelector('input');
                const cancelButton = composer.querySelector('.ghost');
                if (input) {
                  input.focus();
                }
                if (cancelButton) {
                  cancelButton.addEventListener('click', () => {
                    activeComposerKey = '';
                    renderCommentState();
                  });
                }
                if (form && input) {
                  form.addEventListener('submit', (event) => {
                    event.preventDefault();
                    const text = input.value.trim();
                    if (!text) {
                      return;
                    }
                    comments.push({ ...meta, text });
                    activeComposerKey = '';
                    renderCommentState();
                  });
                }
              }
            }
          });
        };
        document.querySelectorAll('[data-comment-trigger]').forEach((button) => {
          button.addEventListener('click', () => {
            const lineElement = button.closest('.md-line');
            if (!lineElement) {
              return;
            }
            const meta = getLineMeta(lineElement);
            const key = getLineKey(meta.fileUri, meta.line);
            activeComposerKey = activeComposerKey === key ? '' : key;
            renderCommentState();
          });
        });
        if (openFileButton) {
          openFileButton.disabled = !currentUri;
          openFileButton.addEventListener('click', () => {
            if (currentUri) {
              vscode.postMessage({ type: 'openCurrentFile', uri: currentUri });
            }
          });
        }
        if (copyCommentsButton) {
          copyCommentsButton.addEventListener('click', async () => {
            const text = comments.map((comment) => comment.ownerLabel + ' > ' + comment.fileLabel + ' [L' + comment.line + '] -> ' + JSON.stringify(comment.text)).join('\n');
            if (!text) {
              return;
            }
            try {
              await navigator.clipboard.writeText(text);
              vscode.postMessage({ type: 'copiedComments' });
            } catch {
              vscode.postMessage({ type: 'copyCommentsText', text });
            }
          });
        }
        if (refreshButton) {
          refreshButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'refreshView' });
          });
        }
        renderCommentState();
        void renderMermaidDiagrams();
      </script>
    </body>
    </html>
  `;
}

function renderScenarioPill(spec: SpecDocument): string {
  const label = `${spec.scenarioCount} scenario${spec.scenarioCount === 1 ? '' : 's'}`;

  return `<span class="scenario-pill">${escapeHtml(label)}</span>`;
}

function renderSpecsPanel(change: ChangeDocument): string {
  const selectedSpecUri = change.selectedSpecUri?.toString() ?? change.specs[0]?.uri.toString() ?? '';

  if (change.specs.length === 0) {
    return '<p class="empty">No delta specs yet.</p>';
  }

  return `
    <div class="spec-split">
      <aside class="spec-nav" role="tablist" aria-label="Spec files">
        ${change.specs.map((spec) => {
          const selected = spec.uri.toString() === selectedSpecUri;

          return `
            <button
              class="spec-nav__item ${selected ? 'active' : ''}"
              data-spec-target="${escapeHtml(spec.uri.toString())}"
              role="tab"
              aria-selected="${selected ? 'true' : 'false'}"
            >
              <div class="spec-nav__top">
                <strong>${escapeHtml(getSpecFolderName(spec.uri.fsPath) ?? spec.title)}</strong>
                ${renderScenarioPill(spec)}
              </div>
              <span>${escapeHtml(spec.uri.fsPath.replace(`${change.folderUri.fsPath}/`, ''))}</span>
            </button>
          `;
        }).join('')}
      </aside>
      <div class="spec-detail">
        ${change.specs.map((spec) => {
          const selected = spec.uri.toString() === selectedSpecUri;

          return `
            <section
              class="spec-detail__panel ${selected ? 'active' : ''}"
              data-spec-panel="${escapeHtml(spec.uri.toString())}"
              role="tabpanel"
            >
              ${renderEmbeddedSpecBody(spec)}
            </section>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderChangeEditor(change: ChangeDocument, cspSource: string, nonce: string, mermaidScriptUri: string): string {
  const tabs = [
    { id: 'proposal', label: 'Proposal' },
    { id: 'design', label: 'Design' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'specs', label: 'Specs' },
  ] as const;
  const progress = change.taskProgress.total === 0
    ? '0/0'
    : `${change.taskProgress.completed}/${change.taskProgress.total}`;
  const currentUri = resolveOpenFileUri(change) ?? '';
  const fileTargets = {
    proposal: {
      uri: change.proposal?.uri.toString() ?? '',
      fileLabel: change.proposal?.uri ? getCommentFileLabel(change.proposal.uri.fsPath) : 'proposal.md',
      ownerLabel: change.name,
    },
    design: {
      uri: change.design?.uri.toString() ?? '',
      fileLabel: change.design?.uri ? getCommentFileLabel(change.design.uri.fsPath) : 'design.md',
      ownerLabel: change.name,
    },
    tasks: {
      uri: change.tasks?.uri.toString() ?? '',
      fileLabel: change.tasks?.uri ? getCommentFileLabel(change.tasks.uri.fsPath) : 'tasks.md',
      ownerLabel: change.name,
    },
    specs: {
      uri: change.selectedSpecUri?.toString() ?? change.specs[0]?.uri.toString() ?? '',
      fileLabel: change.selectedSpecUri ? getCommentFileLabel(change.selectedSpecUri.fsPath) : change.specs[0] ? getCommentFileLabel(change.specs[0].uri.fsPath) : 'spec.md',
      ownerLabel: change.name,
    },
  };

  return /* html */ `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${getEditorChrome(cspSource, nonce)}
      <style nonce="${nonce}">
        :root {
          color-scheme: var(--vscode-color-scheme);
        }
        body {
          margin: 0;
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          font-family: var(--vscode-font-family);
        }
        .shell {
          max-width: 1100px;
          margin: 0 auto;
          padding: 12px;
        }
        .hero {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .hero h1 {
          margin: 0 0 4px;
          font-size: 1.3rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hero p {
          margin: 0 0 8px;
          color: var(--vscode-descriptionForeground);
        }
        .meta-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-sideBar-background);
        }
        .action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          padding: 8px 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .action:hover,
        .action:focus-visible {
          border-color: var(--vscode-focusBorder);
        }
        .action:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .tab {
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-sideBar-background);
          color: var(--vscode-editor-foreground);
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .tab.active {
          border-color: var(--vscode-focusBorder);
          color: var(--vscode-textLink-foreground);
        }
        .panel {
          display: none;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-sideBar-background);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: var(--vscode-editor-font-size);
        }
        .panel.active {
          display: block;
        }
        .panel h2 {
          margin: 0 0 8px;
          font-size: 1rem;
        }
        .source-section__title {
          margin: 0 0 8px;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--vscode-textLink-foreground);
        }
        .icon {
          width: 16px;
          height: 16px;
          flex: 0 0 auto;
          color: var(--vscode-descriptionForeground);
        }
        .md-heading {
          margin: 0;
          line-height: 1.2;
        }
        .md-heading--1 {
          font-size: 1.4rem;
        }
        .md-heading--2 {
          font-size: 1.15rem;
        }
        .md-heading--3,
        .md-heading--4,
        .md-heading--5,
        .md-heading--6 {
          font-size: 1rem;
        }
        .md-heading--scenario {
          color: var(--vscode-textLink-foreground);
        }
        .md-list {
          margin: 0.6em 0 0;
          padding: 0;
          list-style: none;
        }
        .md-list__item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin: 0;
          transition: transform 120ms ease, color 120ms ease;
        }
        .md-list__item:hover {
          transform: translateX(2px);
        }
        .md-list__marker {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 1.1em;
          height: 1.1em;
          margin-top: 0.15em;
          border-radius: 999px;
          color: var(--vscode-textLink-foreground);
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 14%, transparent);
          transition: transform 120ms ease, background 120ms ease, color 120ms ease;
        }
        .md-list__item:hover .md-list__marker {
          transform: scale(1.05);
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 22%, transparent);
        }
        .md-list__marker svg {
          width: 0.9em;
          height: 0.9em;
        }
        .md-list__marker--ordered {
          font-size: 0.8em;
          font-weight: 600;
        }
        .md-list__marker--task {
          color: var(--vscode-charts-green);
          background: color-mix(in srgb, var(--vscode-charts-green) 14%, transparent);
        }
        .md-list__marker--checked {
          color: var(--vscode-charts-green);
          background: color-mix(in srgb, var(--vscode-charts-green) 22%, transparent);
        }
        .md-list__body {
          min-width: 0;
          flex: 1 1 auto;
        }
        .md-quote {
          margin: 0;
          padding: 0.1em 0 0.1em 1em;
          border-left: 3px solid var(--vscode-panel-border);
          color: var(--vscode-descriptionForeground);
        }
        .md-code {
          margin: 0;
          padding: 12px 14px;
          border-radius: 10px;
          overflow-x: auto;
          background: var(--vscode-editorWidget-background);
          border: 1px solid var(--vscode-panel-border);
        }
        .md-code--line {
          padding: 8px 12px;
        }
        .md-code-fence {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          color: var(--vscode-descriptionForeground);
          font-family: var(--vscode-editor-font-family);
        }
        .md-code code {
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
        }
        p {
          margin: 0;
          line-height: 1.6;
        }
        a {
          color: var(--vscode-textLink-foreground);
        }
        strong {
          font-weight: 600;
        }
        em {
          font-style: italic;
        }
        code:not(.md-code code) {
          padding: 0.08em 0.35em;
          border-radius: 6px;
          background: var(--vscode-editorWidget-background);
          border: 1px solid var(--vscode-panel-border);
        }
        .md-code__color {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.08em 0.35em;
          border-radius: 6px;
          border: 1px solid transparent;
          font-weight: 600;
        }
        .md-table-wrap {
          width: 100%;
          overflow-x: auto;
          margin-top: 0.2em;
        }
        .md-table {
          width: 100%;
          min-width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 10px;
          overflow: hidden;
          background: var(--vscode-editorWidget-background);
          font-size: 0.95em;
        }
        .md-table th,
        .md-table td {
          padding: 0.65em 0.8em;
          border-right: 1px solid var(--vscode-panel-border);
          border-bottom: 1px solid var(--vscode-panel-border);
          text-align: left;
          vertical-align: top;
        }
        .md-table th:last-child,
        .md-table td:last-child {
          border-right: 0;
        }
        .md-table tr:last-child td,
        .md-table tr:last-child th {
          border-bottom: 0;
        }
        .md-table th {
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 10%, var(--vscode-editorWidget-background));
          font-weight: 600;
        }
        .md-table tbody tr:nth-child(even) td {
          background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-sideBar-background));
        }
        .panel pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
          line-height: 1.55;
        }
        .empty {
          margin: 0;
          color: var(--vscode-descriptionForeground);
        }
        .spec-split {
          display: grid;
          grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
          gap: 14px;
        }
        .spec-nav {
          display: grid;
          gap: 8px;
          align-content: start;
        }
        .spec-nav__item {
          text-align: left;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editor-background);
          color: inherit;
          border-radius: 10px;
          padding: 10px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .spec-nav__top {
          display: flex;
          gap: 8px;
          align-items: start;
          justify-content: space-between;
        }
        .spec-nav__item.active {
          border-color: var(--vscode-focusBorder);
          background: var(--vscode-list-activeSelectionBackground);
          color: var(--vscode-list-activeSelectionForeground);
          box-shadow:
            inset 4px 0 0 var(--vscode-focusBorder),
            0 0 0 1px var(--vscode-focusBorder);
        }
        .spec-nav__item.active::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), transparent 28%);
          pointer-events: none;
        }
        .spec-nav__item span {
          display: block;
          margin-top: 4px;
          color: var(--vscode-descriptionForeground);
          word-break: break-all;
        }
        .spec-nav__item.active span {
          color: inherit;
          opacity: 0.85;
        }
        .spec-nav__item.active .scenario-pill {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border-color: var(--vscode-button-border);
        }
        .scenario-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 0.72rem;
          white-space: nowrap;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
        }
        .spec-detail {
          min-width: 0;
        }
        .spec-detail__panel {
          display: none;
        }
        .spec-detail__panel.active {
          display: block;
        }
        .md-line {
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
          padding: 1px 0;
        }
        .md-line:hover .md-line__comment-trigger,
        .md-line--active .md-line__comment-trigger {
          opacity: 1;
          transform: scale(1);
        }
        .md-line__gutter {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0;
          min-height: 28px;
          padding-top: 3px;
        }
        .md-line__comment-trigger {
          opacity: 0;
          transform: scale(0.92);
          width: 22px;
          height: 22px;
          padding: 0;
          border-radius: 999px;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editorWidget-background);
          color: var(--vscode-descriptionForeground);
          cursor: pointer;
          transition: opacity 120ms ease, transform 120ms ease, border-color 120ms ease;
        }
        .md-line__comment-trigger:hover,
        .md-line__comment-trigger:focus-visible {
          border-color: var(--vscode-focusBorder);
          color: var(--vscode-textLink-foreground);
        }
        .md-line__comment-trigger svg {
          width: 14px;
          height: 14px;
        }
        .md-line__main {
          min-width: 0;
        }
        .md-line__content {
          min-height: 28px;
          display: flex;
          align-items: center;
        }
        .md-line__content > * {
          width: 100%;
        }
        .md-line + .md-line {
          margin-top: 2px;
        }
        .md-line__spacer {
          min-height: 1.2em;
        }
        .md-line__composer,
        .md-line__comments {
          margin-top: 8px;
        }
        .md-comment-composer {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editorWidget-background);
        }
        .md-comment-composer input {
          min-width: 0;
          flex: 1 1 auto;
          border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
          border-radius: 6px;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          padding: 7px 10px;
          font: inherit;
        }
        .md-comment-composer button,
        .md-comment-composer .ghost {
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 7px 10px;
          cursor: pointer;
        }
        .md-comment-composer button {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        .md-comment-composer .ghost {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        .md-comment-list {
          display: grid;
          gap: 6px;
        }
        .md-comment {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--vscode-panel-border);
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 8%, var(--vscode-editorWidget-background));
        }
        .md-comment__icon {
          width: 16px;
          height: 16px;
          color: var(--vscode-textLink-foreground);
          flex: 0 0 auto;
          margin-top: 2px;
        }
        .md-comment__text {
          line-height: 1.5;
          word-break: break-word;
        }
        ${getMermaidCss()}
        @media (max-width: 820px) {
          .spec-split {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="hero">
          <div>
            <h1>${renderIcon('markdown')}${escapeHtml(change.name)}</h1>
            <p>${escapeHtml(change.folderUri.fsPath)}</p>
            <div class="meta-row">
              <span class="pill">${escapeHtml(change.status)}</span>
              <span class="pill">${escapeHtml(progress)} tasks</span>
              <span class="pill">${change.specs.length} specs</span>
            </div>
          </div>
          ${renderHeaderActions(currentUri)}
        </section>
        <nav class="tabs">
          ${tabs.map((tab) => `
            <button class="tab ${change.selectedTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">${renderIcon(tab.id)}${tab.label}</button>
          `).join('')}
        </nav>
        <section class="panel ${change.selectedTab === 'proposal' ? 'active' : ''}" data-panel="proposal">
          <h2 class="source-section__title">${renderIcon('proposal')}${escapeHtml(change.proposal?.title ?? 'Proposal')}</h2>
          ${change.proposal?.content ? renderCommentableMarkdown(change.proposal.content) : '<p class="empty">No proposal.md</p>'}
        </section>
        <section class="panel ${change.selectedTab === 'design' ? 'active' : ''}" data-panel="design">
          <h2 class="source-section__title">${renderIcon('design')}${escapeHtml(change.design?.title ?? 'Design')}</h2>
          ${change.design?.content ? renderCommentableMarkdown(change.design.content) : '<p class="empty">No design.md</p>'}
        </section>
        <section class="panel ${change.selectedTab === 'tasks' ? 'active' : ''}" data-panel="tasks">
          <h2 class="source-section__title">${renderIcon('tasks')}Tasks</h2>
          ${change.tasks?.content ? renderCommentableMarkdown(change.tasks.content) : '<p class="empty">No tasks.md</p>'}
        </section>
        <section class="panel ${change.selectedTab === 'specs' ? 'active' : ''}" data-panel="specs">
          <h2 class="source-section__title">${renderIcon('specs')}Specs</h2>
          ${renderSpecsPanel(change)}
        </section>
      </main>
      <script nonce="${nonce}" src="${mermaidScriptUri}"></script>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        ${getMermaidBootScript()}
        const tabs = [...document.querySelectorAll('.tab')];
        const panels = [...document.querySelectorAll('.panel')];
        const specItems = [...document.querySelectorAll('[data-spec-target]')];
        const specPanels = [...document.querySelectorAll('[data-spec-panel]')];
        const openFileButton = document.querySelector('[data-action="open-file"]');
        const copyCommentsButton = document.querySelector('[data-action="copy-comments"]');
        const refreshButton = document.querySelector('[data-action="refresh-view"]');
        let currentUri = ${JSON.stringify(currentUri)};
        let currentFileLabel = ${JSON.stringify(fileTargets[change.selectedTab].fileLabel)};
        let currentOwnerLabel = ${JSON.stringify(fileTargets[change.selectedTab].ownerLabel)};
        const fileTargets = ${JSON.stringify(fileTargets)};
        const comments = [];
        let activeComposerKey = '';
        const commentIcon = ${JSON.stringify(renderIcon('comment'))};
        const getLineKey = (fileUri, line) => fileUri + '#' + line;
        const getLineMeta = (lineElement) => ({
          fileUri: lineElement.getAttribute('data-file-uri') || currentUri,
          fileLabel: lineElement.getAttribute('data-file-label') || currentFileLabel,
          ownerLabel: lineElement.getAttribute('data-owner-label') || currentOwnerLabel,
          line: Number(lineElement.getAttribute('data-line') || '0'),
        });
        const updateOpenFileState = (uri) => {
          currentUri = uri?.uri || '';
          currentFileLabel = uri?.fileLabel || '';
          currentOwnerLabel = uri?.ownerLabel || '';
          if (!openFileButton) {
            return;
          }
          openFileButton.disabled = !currentUri;
          openFileButton.setAttribute('data-uri', currentUri);
        };
        const renderCommentState = () => {
          document.querySelectorAll('.md-line').forEach((lineElement) => {
            const meta = getLineMeta(lineElement);
            const key = getLineKey(meta.fileUri, meta.line);
            lineElement.classList.toggle('md-line--active', activeComposerKey === key);
            const composer = lineElement.querySelector('[data-comment-composer]');
            const commentList = lineElement.querySelector('[data-comment-list]');
            const lineComments = comments.filter((comment) => comment.fileUri === meta.fileUri && comment.line === meta.line);
            if (commentList) {
              commentList.innerHTML = lineComments.length === 0
                ? ''
                : '<div class="md-comment-list">' + lineComments.map(() => '<div class="md-comment">' + commentIcon + '<div class="md-comment__text"></div></div>').join('') + '</div>';
              if (commentList.firstElementChild) {
                [...commentList.querySelectorAll('.md-comment__text')].forEach((node, index) => {
                  node.textContent = lineComments[index]?.text || '';
                });
              }
            }
            if (composer) {
              if (activeComposerKey !== key) {
                composer.innerHTML = '';
              } else {
                composer.innerHTML = '<form class="md-comment-composer"><input type="text" maxlength="500" placeholder="Add comment" /><button type="submit">Add</button><button type="button" class="ghost">Cancel</button></form>';
                const form = composer.querySelector('form');
                const input = composer.querySelector('input');
                const cancelButton = composer.querySelector('.ghost');
                if (input) {
                  input.focus();
                }
                if (cancelButton) {
                  cancelButton.addEventListener('click', () => {
                    activeComposerKey = '';
                    renderCommentState();
                  });
                }
                if (form && input) {
                  form.addEventListener('submit', (event) => {
                    event.preventDefault();
                    const text = input.value.trim();
                    if (!text) {
                      return;
                    }
                    comments.push({ ...meta, text });
                    activeComposerKey = '';
                    renderCommentState();
                  });
                }
              }
            }
          });
        };
        const refreshLineMetadata = () => {
          document.querySelectorAll('[data-panel="proposal"] .md-line').forEach((line) => {
            line.setAttribute('data-file-uri', fileTargets.proposal.uri);
            line.setAttribute('data-file-label', fileTargets.proposal.fileLabel);
            line.setAttribute('data-owner-label', fileTargets.proposal.ownerLabel);
          });
          document.querySelectorAll('[data-panel="design"] .md-line').forEach((line) => {
            line.setAttribute('data-file-uri', fileTargets.design.uri);
            line.setAttribute('data-file-label', fileTargets.design.fileLabel);
            line.setAttribute('data-owner-label', fileTargets.design.ownerLabel);
          });
          document.querySelectorAll('[data-panel="tasks"] .md-line').forEach((line) => {
            line.setAttribute('data-file-uri', fileTargets.tasks.uri);
            line.setAttribute('data-file-label', fileTargets.tasks.fileLabel);
            line.setAttribute('data-owner-label', fileTargets.tasks.ownerLabel);
          });
          specPanels.forEach((panel) => {
            const uri = panel.getAttribute('data-spec-panel') || '';
            const item = specItems.find((entry) => entry.getAttribute('data-spec-target') === uri);
            const fileLabel = item?.getAttribute('data-file-label') || fileTargets.specs.fileLabel;
            panel.querySelectorAll('.md-line').forEach((line) => {
              line.setAttribute('data-file-uri', uri);
              line.setAttribute('data-file-label', fileLabel);
              line.setAttribute('data-owner-label', fileTargets.specs.ownerLabel);
            });
          });
        };
        document.querySelectorAll('[data-comment-trigger]').forEach((button) => {
          button.addEventListener('click', () => {
            const lineElement = button.closest('.md-line');
            if (!lineElement) {
              return;
            }
            const meta = getLineMeta(lineElement);
            const key = getLineKey(meta.fileUri, meta.line);
            activeComposerKey = activeComposerKey === key ? '' : key;
            renderCommentState();
          });
        });
        updateOpenFileState(fileTargets[${JSON.stringify(change.selectedTab)}]);
        refreshLineMetadata();
        if (openFileButton) {
          openFileButton.addEventListener('click', () => {
            if (currentUri) {
              vscode.postMessage({ type: 'openCurrentFile', uri: currentUri });
            }
          });
        }
        if (copyCommentsButton) {
          copyCommentsButton.addEventListener('click', async () => {
            const text = comments.map((comment) => comment.ownerLabel + ' > ' + comment.fileLabel + ' [L' + comment.line + '] -> ' + JSON.stringify(comment.text)).join('\\n');
            if (!text) {
              return;
            }
            try {
              await navigator.clipboard.writeText(text);
              vscode.postMessage({ type: 'copiedComments' });
            } catch {
              vscode.postMessage({ type: 'copyCommentsText', text });
            }
          });
        }
        if (refreshButton) {
          refreshButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'refreshView' });
          });
        }
        tabs.forEach((tab) => {
          tab.addEventListener('click', () => {
            const next = tab.getAttribute('data-tab');
            tabs.forEach((item) => item.classList.toggle('active', item === tab));
            panels.forEach((panel) => panel.classList.toggle('active', panel.getAttribute('data-panel') === next));
            updateOpenFileState(next ? fileTargets[next] : null);
            activeComposerKey = '';
            renderCommentState();
          });
        });
        specItems.forEach((item) => {
          item.addEventListener('click', () => {
            const next = item.getAttribute('data-spec-target');
            specItems.forEach((entry) => {
              const active = entry === item;
              entry.classList.toggle('active', active);
              entry.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            specPanels.forEach((panel) => {
              panel.classList.toggle('active', panel.getAttribute('data-spec-panel') === next);
            });
            fileTargets.specs = {
              uri: next ?? '',
              fileLabel: item.getAttribute('data-file-label') || fileTargets.specs.fileLabel,
              ownerLabel: fileTargets.specs.ownerLabel,
            };
            updateOpenFileState(fileTargets.specs);
            activeComposerKey = '';
            renderCommentState();
          });
        });
        renderCommentState();
        void renderMermaidDiagrams();
      </script>
    </body>
    </html>
  `;
}

export class OpenspecSpecEditorProvider implements vscode.CustomReadonlyEditorProvider<OpenspecDocument> {
  public static readonly viewType = 'openspec.specEditor';

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public async openCustomDocument(uri: vscode.Uri): Promise<OpenspecDocument> {
    return new OpenspecDocument(uri);
  }

  public async resolveCustomEditor(document: OpenspecDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    const mermaidScriptUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'),
    ).toString();

    const render = async (): Promise<void> => {
      if (isChangeFilePath(document.uri.fsPath)) {
        const change = await readChangeDocument(document.uri);
        const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
        webviewPanel.webview.html = change
          ? renderChangeEditor(change, webviewPanel.webview.cspSource, nonce, mermaidScriptUri)
          : '<html><body><p>Not an Openspec change document.</p></body></html>';
        return;
      }

      const spec = await readSpecDocument(document.uri);
      webviewPanel.webview.html = spec
        ? renderSourceSpec(spec, webviewPanel.webview.cspSource, `${Date.now()}${Math.random().toString(16).slice(2)}`, mermaidScriptUri)
        : '<html><body><p>Not an Openspec document.</p></body></html>';
    };

    webviewPanel.webview.onDidReceiveMessage((message: { type?: string; uri?: string; text?: string }) => {
      if (message.type === 'openCurrentFile' && message.uri) {
        void vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(message.uri));
        return;
      }

      if (message.type === 'copyCommentsText' && typeof message.text === 'string') {
        void vscode.env.clipboard.writeText(message.text);
        void vscode.window.setStatusBarMessage('Openspec comments copied', 2000);
        return;
      }

      if (message.type === 'copiedComments') {
        void vscode.window.setStatusBarMessage('Openspec comments copied', 2000);
        return;
      }

      if (message.type === 'refreshView') {
        void render();
      }
    });

    await render();
  }
}
