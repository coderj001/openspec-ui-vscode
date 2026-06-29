import * as vscode from 'vscode';
import { listSpecDocuments, SpecDocument } from '../specs/service';
import { specSectionNames } from '../specs/parser';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sectionPreview(value: string): string {
  return escapeHtml(value.split(/\r?\n/).find((line) => line.trim().length > 0) ?? 'No content yet');
}

function progressRatio(spec: SpecDocument): number {
  if (spec.taskProgress.total === 0) {
    return 0;
  }

  return Math.round((spec.taskProgress.completed / spec.taskProgress.total) * 100);
}

function renderCard(spec: SpecDocument): string {
  const progress = progressRatio(spec);

  return `
    <button class="spec-card" data-uri="${escapeHtml(spec.uri.toString())}">
      <div class="spec-card__top">
        <div>
          <div class="spec-card__title">${escapeHtml(spec.title)}</div>
          <div class="spec-card__meta">${escapeHtml(spec.uri.fsPath)}</div>
        </div>
        <span class="badge ${spec.status}">${spec.status}</span>
      </div>
      <div class="progress">
        <div class="progress__bar" style="width:${progress}%"></div>
      </div>
      <div class="spec-card__progress">${spec.taskProgress.completed}/${spec.taskProgress.total} tasks</div>
      <div class="spec-card__sections">
        ${specSectionNames.map((section) => `<div class="section-chip"><span>${section}</span><p>${sectionPreview(spec.sections[section])}</p></div>`).join('')}
      </div>
    </button>
  `;
}

function renderDashboard(specs: SpecDocument[]): string {
  const total = specs.length;
  const archive = specs.filter((spec) => spec.status === 'archive').length;
  const active = total - archive;
  const tasksTotal = specs.reduce((sum, spec) => sum + spec.taskProgress.total, 0);
  const tasksDone = specs.reduce((sum, spec) => sum + spec.taskProgress.completed, 0);

  return `
    <div class="stats">
      <div class="stat"><span>Specs</span><strong>${total}</strong></div>
      <div class="stat"><span>Active</span><strong>${active}</strong></div>
      <div class="stat"><span>Archive</span><strong>${archive}</strong></div>
      <div class="stat"><span>Tasks</span><strong>${tasksDone}/${tasksTotal}</strong></div>
    </div>
    <div class="list">
      ${specs.length === 0 ? '<div class="empty">No Openspec markdown found in this workspace.</div>' : specs.map(renderCard).join('')}
    </div>
  `;
}

function renderHtml(specs: SpecDocument[], cspSource: string, nonce: string): string {
  return /* html */ `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
      <style nonce="${nonce}">
        :root {
          color-scheme: dark;
          --bg: #0f172a;
          --panel: #111827;
          --panel-2: #1f2937;
          --text: #e5e7eb;
          --muted: #9ca3af;
          --accent: #38bdf8;
          --accent-2: #22c55e;
          --accent-3: #f59e0b;
          --border: rgba(255,255,255,0.08);
        }
        body {
          margin: 0;
          padding: 12px;
          background: linear-gradient(180deg, var(--bg), #020617);
          color: var(--text);
          font-family: var(--vscode-font-family);
        }
        .toolbar {
          display: flex;
          gap: 8px;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .toolbar button {
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text);
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        .stat {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px;
        }
        .stat span, .spec-card__meta, .spec-card__progress, .section-chip p, .empty {
          color: var(--muted);
        }
        .stat strong {
          display: block;
          font-size: 1.3rem;
          margin-top: 2px;
        }
        .list {
          display: grid;
          gap: 10px;
        }
        .spec-card {
          text-align: left;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px;
          color: inherit;
          cursor: pointer;
        }
        .spec-card:hover {
          border-color: rgba(56, 189, 248, 0.45);
        }
        .spec-card__top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: start;
          margin-bottom: 10px;
        }
        .spec-card__title {
          font-size: 1rem;
          font-weight: 700;
        }
        .spec-card__meta {
          font-size: 0.78rem;
          margin-top: 4px;
          word-break: break-all;
        }
        .badge {
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .badge.active { background: rgba(34, 197, 94, 0.18); color: #86efac; }
        .badge.archive { background: rgba(245, 158, 11, 0.16); color: #fcd34d; }
        .progress {
          height: 6px;
          border-radius: 999px;
          background: var(--panel-2);
          overflow: hidden;
          margin-bottom: 8px;
        }
        .progress__bar {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
        }
        .spec-card__sections {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }
        .section-chip {
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          padding: 8px;
        }
        .section-chip span {
          display: inline-block;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 4px;
        }
        .section-chip p {
          margin: 0;
          font-size: 0.8rem;
          line-height: 1.35;
        }
        .empty {
          padding: 18px 12px;
          text-align: center;
          border: 1px dashed var(--border);
          border-radius: 12px;
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <strong>Openspec Dashboard</strong>
        <button data-action="refresh">Refresh</button>
      </div>
      ${renderDashboard(specs)}
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
    const specs = await listSpecDocuments();
    this.view.webview.html = renderHtml(specs, this.view.webview.cspSource, nonce);
  }
}
