import * as vscode from 'vscode';
import { ChangeSummary, listChangeSummaries } from '../specs/service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRow(change: ChangeSummary): string {
  if (!change.openUri) {
    return `
      <div class="row row--muted">
        <span>${escapeHtml(change.name)}</span>
        <span>${escapeHtml(change.status)}</span>
      </div>
    `;
  }

  return `
    <button class="row" data-uri="${escapeHtml(change.openUri.toString())}">
      <span>${escapeHtml(change.name)}</span>
      <span>${escapeHtml(change.status)}</span>
    </button>
  `;
}

function renderSection(title: string, items: readonly ChangeSummary[]): string {
  if (items.length === 0) {
    return '';
  }

  return `
    <section class="section">
      <div class="section__title">${escapeHtml(title)}</div>
      ${items.map(renderRow).join('')}
    </section>
  `;
}

function renderHtml(changes: ChangeSummary[], cspSource: string, nonce: string): string {
  const active = changes.filter((change) => change.status === 'active');
  const archived = changes.filter((change) => change.status === 'archive');

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
          padding: 10px;
          background: var(--vscode-sideBar-background);
          color: var(--vscode-sideBar-foreground);
          font-family: var(--vscode-font-family);
        }
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .toolbar strong {
          font-size: 0.95rem;
        }
        .toolbar button,
        .row {
          width: 100%;
          text-align: left;
          border: 1px solid var(--vscode-panel-border);
          background: var(--vscode-sideBar-background);
          color: inherit;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
        }
        .toolbar button {
          width: auto;
          padding: 6px 10px;
        }
        .section {
          display: grid;
          gap: 6px;
        }
        .section + .section {
          margin-top: 12px;
        }
        .section__title {
          color: var(--vscode-descriptionForeground);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 2px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }
        .row:hover {
          border-color: var(--vscode-focusBorder);
        }
        .row--muted {
          opacity: 0.7;
          cursor: default;
        }
        .empty {
          color: var(--vscode-descriptionForeground);
          border: 1px dashed var(--vscode-panel-border);
          border-radius: 8px;
          padding: 12px;
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <strong>Openspec</strong>
        <button data-action="refresh">Refresh</button>
      </div>
      ${changes.length === 0 ? '<div class="empty">No openspec changes under openspec/changes.</div>' : ''}
      ${renderSection('Active', active)}
      ${renderSection('Archive', archived)}
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.querySelector('[data-action="refresh"]').addEventListener('click', () => {
          vscode.postMessage({ type: 'refresh' });
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

export class OpenspecSidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openspec.sidebarView';
  private view?: vscode.WebviewView;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage((message: { type?: string; uri?: string }) => {
      if (message.type === 'refresh') {
        void this.refresh();
        return;
      }

      if (message.type === 'openSpec' && message.uri) {
        void vscode.commands.executeCommand('openspec.openSpec', vscode.Uri.parse(message.uri));
      }
    });

    void this.refresh();
  }

  public async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
    const changes = await listChangeSummaries();
    this.view.webview.html = renderHtml(changes, this.view.webview.cspSource, nonce);
  }
}
