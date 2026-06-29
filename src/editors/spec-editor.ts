import * as vscode from 'vscode';
import { readSpecDocument, SpecDocument } from '../specs/service';
import { specSectionNames } from '../specs/parser';

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
    <section class="section">
      <h2>${escapeHtml(name)}</h2>
      <pre>${escapeHtml(content || 'No content yet')}</pre>
    </section>
  `;
}

function renderSpec(spec: SpecDocument, cspSource: string, nonce: string): string {
  const progress = spec.taskProgress.total === 0 ? 0 : Math.round((spec.taskProgress.completed / spec.taskProgress.total) * 100);

  return /* html */ `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}';">
      <style nonce="${nonce}">
        :root {
          color-scheme: dark;
          --bg: #0b1020;
          --panel: #121a30;
          --border: rgba(148, 163, 184, 0.18);
          --text: #e2e8f0;
          --muted: #94a3b8;
          --accent: #38bdf8;
          --accent-2: #a78bfa;
          --accent-3: #34d399;
        }
        body {
          margin: 0;
          padding: 24px;
          background: radial-gradient(circle at top, #172554 0%, var(--bg) 38%);
          color: var(--text);
          font-family: var(--vscode-font-family);
        }
        .shell {
          max-width: 1120px;
          margin: 0 auto;
        }
        .hero {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: start;
          margin-bottom: 20px;
        }
        .title {
          margin: 0 0 8px;
          font-size: 1.8rem;
        }
        .meta {
          color: var(--muted);
          margin: 0;
        }
        .pill {
          display: inline-block;
          margin-top: 10px;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.18);
          color: #7dd3fc;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .metric {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
        }
        .metric span {
          color: var(--muted);
          display: block;
          margin-bottom: 6px;
        }
        .metric strong {
          font-size: 1.6rem;
        }
        .sections {
          display: grid;
          gap: 14px;
        }
        .section {
          background: rgba(15, 23, 42, 0.82);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
        }
        .section:nth-child(1) h2 { color: var(--accent); }
        .section:nth-child(2) h2 { color: var(--accent-2); }
        .section:nth-child(3) h2 { color: var(--accent-3); }
        .section:nth-child(4) h2 { color: #f59e0b; }
        h2 {
          margin: 0 0 12px;
          font-size: 1.05rem;
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--vscode-editor-font-family);
          line-height: 1.55;
          color: var(--text);
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="hero">
          <div>
            <h1 class="title">${escapeHtml(spec.title)}</h1>
            <p class="meta">${escapeHtml(spec.uri.fsPath)}</p>
            <span class="pill">${escapeHtml(spec.status)}</span>
          </div>
          <div class="metric">
            <span>Tasks complete</span>
            <strong>${spec.taskProgress.completed}/${spec.taskProgress.total} (${progress}%)</strong>
          </div>
        </section>
        <section class="metrics">
          ${specSectionNames.map((section) => `
            <div class="metric">
              <span>${section}</span>
              <strong>${spec.sections[section] ? 'Ready' : 'Empty'}</strong>
            </div>
          `).join('')}
        </section>
        <section class="sections">
          ${specSectionNames.map((section) => renderSection(section, spec.sections[section])).join('')}
        </section>
      </main>
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
      enableScripts: false,
      localResourceRoots: [],
    };

    const spec = await readSpecDocument(document.uri);
    const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
    webviewPanel.webview.html = spec
      ? renderSpec(spec, webviewPanel.webview.cspSource, nonce)
      : `<html><body><p>Not an Openspec document.</p></body></html>`;
  }
}
