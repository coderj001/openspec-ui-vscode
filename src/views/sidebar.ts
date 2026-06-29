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

function progressPercent(change: ChangeSummary): number {
  if (change.taskProgress.total === 0) {
    return 0;
  }

  return Math.round((change.taskProgress.completed / change.taskProgress.total) * 100);
}

function renderPill(label: string, tone: string, enabled: boolean): string {
  return `<span class="pill pill--${tone} ${enabled ? '' : 'pill--muted'}">${escapeHtml(label)}</span>`;
}

function renderRow(change: ChangeSummary): string {
  const hasProposal = Boolean(change.proposalUri);
  const hasDesign = Boolean(change.designUri);
  const hasTasks = Boolean(change.tasksUri);
  const hasSpecs = change.deltaSpecCount > 0;

  if (!change.openUri) {
    return `
      <div class="row row--muted">
        <span>${escapeHtml(change.name)}</span>
        <span>${escapeHtml(change.status)}</span>
      </div>
    `;
  }

  if (change.status === 'archive') {
    return `
      <button class="row row--archive" data-uri="${escapeHtml(change.openUri.toString())}">
        <span>${escapeHtml(change.name)}</span>
        <span>${escapeHtml(change.status)}</span>
      </button>
    `;
  }

  const progress = progressPercent(change);

  return `
    <button class="card" data-uri="${escapeHtml(change.openUri.toString())}">
      <div class="card__top">
        <strong>${escapeHtml(change.name)}</strong>
        <span class="status">active</span>
      </div>
      <div class="pills">
        ${renderPill('Proposal', 'proposal', hasProposal)}
        ${renderPill('Design', 'design', hasDesign)}
        ${renderPill('Tasks', 'tasks', hasTasks)}
        ${renderPill('Specs', 'specs', hasSpecs)}
      </div>
      <div class="progress-meta">
        <span>${change.taskProgress.completed}/${change.taskProgress.total} tasks</span>
        <span>${progress}%</span>
      </div>
      <div class="progress" aria-hidden="true">
        <div class="progress__bar" style="width:${progress}%"></div>
      </div>
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
        .card {
          width: 100%;
          text-align: left;
          border: 1px solid var(--vscode-panel-border);
          background: color-mix(in srgb, var(--vscode-sideBar-background) 88%, var(--vscode-editor-background));
          color: inherit;
          border-radius: 12px;
          padding: 10px;
          cursor: pointer;
        }
        .card:hover,
        .row:hover {
          border-color: var(--vscode-focusBorder);
        }
        .card__top,
        .progress-meta {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }
        .card__top {
          margin-bottom: 8px;
        }
        .status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 0.72rem;
          color: var(--vscode-badge-foreground);
          background: var(--vscode-badge-background);
        }
        .pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 0.72rem;
          border: 1px solid transparent;
        }
        .pill--proposal {
          color: var(--vscode-textLink-foreground);
          background: color-mix(in srgb, var(--vscode-textLink-foreground) 16%, transparent);
          border-color: color-mix(in srgb, var(--vscode-textLink-foreground) 35%, transparent);
        }
        .pill--design {
          color: var(--vscode-gitDecoration-modifiedResourceForeground);
          background: color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground) 16%, transparent);
          border-color: color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground) 35%, transparent);
        }
        .pill--tasks {
          color: var(--vscode-list-warningForeground);
          background: color-mix(in srgb, var(--vscode-list-warningForeground) 16%, transparent);
          border-color: color-mix(in srgb, var(--vscode-list-warningForeground) 35%, transparent);
        }
        .pill--specs {
          color: var(--vscode-testing-iconPassed);
          background: color-mix(in srgb, var(--vscode-testing-iconPassed) 16%, transparent);
          border-color: color-mix(in srgb, var(--vscode-testing-iconPassed) 35%, transparent);
        }
        .pill--muted {
          color: var(--vscode-descriptionForeground);
          background: transparent;
          border-color: var(--vscode-panel-border);
        }
        .progress-meta {
          margin-bottom: 6px;
          font-size: 0.75rem;
          color: var(--vscode-descriptionForeground);
        }
        .progress {
          height: 6px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--vscode-panel-border) 55%, transparent);
          overflow: hidden;
        }
        .progress__bar {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            var(--vscode-textLink-foreground),
            var(--vscode-testing-iconPassed)
          );
        }
        .row--archive {
          background: color-mix(in srgb, var(--vscode-sideBar-background) 94%, transparent);
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
