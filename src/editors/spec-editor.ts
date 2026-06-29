import * as vscode from 'vscode';
import { specSectionNames } from '../specs/parser';
import { ChangeDocument, readChangeDocument, readSpecDocument, SpecDocument } from '../specs/service';
import { isChangeFilePath } from '../specs/paths';

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

function renderSourceSpec(spec: SpecDocument, cspSource: string): string {
  const progress = spec.taskProgress.total === 0 ? 0 : Math.round((spec.taskProgress.completed / spec.taskProgress.total) * 100);

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
        ${specSectionNames.map((section) => renderSection(section, spec.sections[section])).join('')}
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

function renderSpecLinks(specs: readonly SpecDocument[]): string {
  if (specs.length === 0) {
    return '<p class="empty">No delta specs yet.</p>';
  }

  return `
    <div class="spec-list">
      ${specs.map((spec) => `
        <button class="spec-link" data-uri="${escapeHtml(spec.uri.toString())}">
          <strong>${escapeHtml(spec.title)}</strong>
          <span>${escapeHtml(spec.uri.fsPath)}</span>
        </button>
      `).join('')}
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
        .spec-list {
          display: grid;
          gap: 10px;
        }
        .spec-link {
          text-align: left;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editor-background);
          color: inherit;
          border-radius: 10px;
          padding: 12px;
          cursor: pointer;
        }
        .spec-link span {
          display: block;
          margin-top: 4px;
          color: var(--vscode-descriptionForeground);
          word-break: break-all;
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
          ${renderSpecLinks(change.specs)}
        </section>
      </main>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const tabs = [...document.querySelectorAll('.tab')];
        const panels = [...document.querySelectorAll('.panel')];
        tabs.forEach((tab) => {
          tab.addEventListener('click', () => {
            const next = tab.getAttribute('data-tab');
            tabs.forEach((item) => item.classList.toggle('active', item === tab));
            panels.forEach((panel) => panel.classList.toggle('active', panel.getAttribute('data-panel') === next));
          });
        });
        document.querySelectorAll('[data-uri]').forEach((element) => {
          element.addEventListener('click', () => {
            vscode.postMessage({ type: 'openSpec', uri: element.getAttribute('data-uri') });
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
      webviewPanel.webview.onDidReceiveMessage((message: { type?: string; uri?: string }) => {
        if (message.type === 'openSpec' && message.uri) {
          void vscode.commands.executeCommand('openspec.openSpec', vscode.Uri.parse(message.uri));
        }
      });
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
