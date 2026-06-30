import * as vscode from 'vscode';
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

function renderSection(name: string, content: string): string {
  return `
    <section class="source-section">
      <h2>${escapeHtml(name)}</h2>
      <pre>${escapeHtml(content || 'No content yet')}</pre>
    </section>
  `;
}

function renderRawSpec(spec: SpecDocument): string {
  return `
    <section class="source-section">
      <h2>Markdown</h2>
      <pre>${escapeHtml(spec.rawText || 'No content yet')}</pre>
    </section>
  `;
}

function renderSpecSections(spec: SpecDocument, includeEmpty: boolean): string {
  const sections = specSectionNames
    .filter((section) => includeEmpty || spec.sections[section])
    .map((section) => renderSection(section, spec.sections[section]))
    .join('');

  return sections || renderRawSpec(spec);
}

function renderSourceSpecBody(spec: SpecDocument): string {
  const progress = spec.taskProgress.total === 0 ? 0 : Math.round((spec.taskProgress.completed / spec.taskProgress.total) * 100);

  return `
    <h1 class="title">${escapeHtml(spec.title)}</h1>
    <p class="meta">${escapeHtml(spec.uri.fsPath)}</p>
    <span class="pill">${escapeHtml(spec.status)} · ${progress}% tasks done</span>
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
  return `
    <h2>${escapeHtml(spec.title)}</h2>
    ${renderSpecSections(spec, false)}
  `;
}

function renderSourceSpec(spec: SpecDocument, cspSource: string): string {
  return /* html */ `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource};">
      <style>
        :root {
          color-scheme: var(--vscode-color-scheme);
        }
        body {
          margin: 0;
          padding: 20px;
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          font-family: var(--vscode-font-family);
        }
        .shell {
          max-width: 980px;
          margin: 0 auto;
        }
        .title {
          margin: 0 0 4px;
          font-size: 1.75rem;
        }
        .meta {
          margin: 0 0 16px;
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
        .metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin: 18px 0;
        }
        .metric, .source-section {
          background: var(--vscode-sideBar-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 10px;
          padding: 14px;
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
          margin-top: 12px;
        }
        .source-section h2 {
          margin: 0 0 10px;
          font-size: 1rem;
          color: var(--vscode-textLink-foreground);
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--vscode-editor-font-family);
          font-size: var(--vscode-editor-font-size);
          line-height: 1.55;
        }
      </style>
    </head>
    <body>
      <main class="shell">
        ${renderSourceSpecBody(spec)}
      </main>
    </body>
    </html>
  `;
}

function renderChecklist(text: string): string {
  const items = [...text.matchAll(/^[-*]\s+\[( |x|X)\]\s+(.*)$/gm)];

  if (items.length === 0) {
    return '<p class="empty">No tasks yet.</p>';
  }

  return `
    <ul class="task-list">
      ${items.map((item) => `
        <li class="${item[1].toLowerCase() === 'x' ? 'done' : ''}">
          <span class="task-box">${item[1].toLowerCase() === 'x' ? 'x' : ''}</span>
          <span>${escapeHtml(item[2])}</span>
        </li>
      `).join('')}
    </ul>
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

function renderChangeEditor(change: ChangeDocument, cspSource: string, nonce: string): string {
  const tabs = [
    { id: 'proposal', label: 'Proposal' },
    { id: 'design', label: 'Design' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'specs', label: 'Specs' },
  ] as const;
  const progress = change.taskProgress.total === 0
    ? '0/0'
    : `${change.taskProgress.completed}/${change.taskProgress.total}`;

  return /* html */ `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
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
          padding: 20px;
        }
        .hero {
          margin-bottom: 18px;
        }
        .hero h1 {
          margin: 0 0 4px;
          font-size: 1.8rem;
        }
        .hero p {
          margin: 0 0 10px;
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
        .tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .tab {
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-sideBar-background);
          color: var(--vscode-editor-foreground);
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
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
          padding: 16px;
        }
        .panel.active {
          display: block;
        }
        .panel h2 {
          margin: 0 0 12px;
          font-size: 1rem;
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
        .design-grid {
          display: grid;
          gap: 12px;
        }
        .design-block {
          border: 1px solid var(--vscode-panel-border);
          border-radius: 10px;
          padding: 12px;
          background: var(--vscode-editor-background);
        }
        .task-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }
        .task-list li {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 10px 12px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 10px;
          background: var(--vscode-editor-background);
        }
        .task-list li.done {
          color: var(--vscode-descriptionForeground);
        }
        .task-box {
          width: 18px;
          height: 18px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          flex: 0 0 18px;
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
          <h1>${escapeHtml(change.name)}</h1>
          <p>${escapeHtml(change.folderUri.fsPath)}</p>
          <div class="meta-row">
            <span class="pill">${escapeHtml(change.status)}</span>
            <span class="pill">${escapeHtml(progress)} tasks</span>
            <span class="pill">${change.specs.length} specs</span>
          </div>
        </section>
        <nav class="tabs">
          ${tabs.map((tab) => `
            <button class="tab ${change.selectedTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">${tab.label}</button>
          `).join('')}
        </nav>
        <section class="panel ${change.selectedTab === 'proposal' ? 'active' : ''}" data-panel="proposal">
          <h2>${escapeHtml(change.proposal?.title ?? 'Proposal')}</h2>
          <pre>${escapeHtml(change.proposal?.content || 'No proposal.md')}</pre>
        </section>
        <section class="panel ${change.selectedTab === 'design' ? 'active' : ''}" data-panel="design">
          <h2>${escapeHtml(change.design?.title ?? 'Design')}</h2>
          <div class="design-grid">
            <div class="design-block">
              <pre>${escapeHtml(change.design?.content || 'No design.md')}</pre>
            </div>
          </div>
        </section>
        <section class="panel ${change.selectedTab === 'tasks' ? 'active' : ''}" data-panel="tasks">
          <h2>Tasks</h2>
          ${renderChecklist(change.tasks?.content || '')}
        </section>
        <section class="panel ${change.selectedTab === 'specs' ? 'active' : ''}" data-panel="specs">
          <h2>Specs</h2>
          ${renderSpecsPanel(change)}
        </section>
      </main>
      <script nonce="${nonce}">
        const tabs = [...document.querySelectorAll('.tab')];
        const panels = [...document.querySelectorAll('.panel')];
        const specItems = [...document.querySelectorAll('[data-spec-target]')];
        const specPanels = [...document.querySelectorAll('[data-spec-panel]')];
        tabs.forEach((tab) => {
          tab.addEventListener('click', () => {
            const next = tab.getAttribute('data-tab');
            tabs.forEach((item) => item.classList.toggle('active', item === tab));
            panels.forEach((panel) => panel.classList.toggle('active', panel.getAttribute('data-panel') === next));
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
          });
        });
      </script>
    </body>
    </html>
  `;
}

export class OpenspecSpecEditorProvider implements vscode.CustomReadonlyEditorProvider<OpenspecDocument> {
  public static readonly viewType = 'openspec.specEditor';

  public async openCustomDocument(uri: vscode.Uri): Promise<OpenspecDocument> {
    return new OpenspecDocument(uri);
  }

  public async resolveCustomEditor(document: OpenspecDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: isChangeFilePath(document.uri.fsPath),
      localResourceRoots: [],
    };

    if (isChangeFilePath(document.uri.fsPath)) {
      const change = await readChangeDocument(document.uri);
      const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
      webviewPanel.webview.html = change
        ? renderChangeEditor(change, webviewPanel.webview.cspSource, nonce)
        : '<html><body><p>Not an Openspec change document.</p></body></html>';
      return;
    }

    const spec = await readSpecDocument(document.uri);
    webviewPanel.webview.html = spec
      ? renderSourceSpec(spec, webviewPanel.webview.cspSource)
      : '<html><body><p>Not an Openspec document.</p></body></html>';
  }
}
