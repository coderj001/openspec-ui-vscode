import * as vscode from 'vscode';
import { ChangeSummary, listChangeSummaries } from '../specs/service';
import { formatArchiveName } from '../specs/paths';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function percent(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function renderBar(label: string, value: number, total: number, tone: string): string {
  const percentage = percent(value, total);

  return `
    <div class="metric-row">
      <div class="metric-row__label"><span>${escapeHtml(label)}</span><strong>${value}/${total}</strong></div>
      <div class="bar"><i class="bar--${tone}" style="width:${percentage}%"></i></div>
    </div>
  `;
}

function renderMiniBar(value: number, total: number, tone: string): string {
  return `<div class="mini-bar"><i class="bar--${tone}" style="width:${percent(value, total)}%"></i></div>`;
}

function monthLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function renderOpenButton(change: ChangeSummary, name: string): string {
  if (!change.openUri) {
    return `<span class="work-item">${escapeHtml(name)}</span>`;
  }

  return `<button class="work-item" data-uri="${escapeHtml(change.openUri.toString())}">${escapeHtml(name)}</button>`;
}

function renderHtml(changes: readonly ChangeSummary[], cspSource: string, nonce: string): string {
  const active = changes.filter((change) => change.status === 'active');
  const archived = changes.filter((change) => change.status === 'archive');
  const totalTasks = changes.reduce((sum, change) => sum + change.taskProgress.total, 0);
  const completedTasks = changes.reduce((sum, change) => sum + change.taskProgress.completed, 0);
  const totalSpecs = changes.reduce((sum, change) => sum + change.deltaSpecCount, 0);
  const coverage = [
    ['Proposal', changes.filter((change) => change.proposalUri).length, 'blue'],
    ['Design', changes.filter((change) => change.designUri).length, 'gold'],
    ['Tasks', changes.filter((change) => change.tasksUri).length, 'orange'],
    ['Specs', changes.filter((change) => change.deltaSpecCount > 0).length, 'green'],
  ] as const;
  const completion = percent(completedTasks, totalTasks);
  const activeRemaining = active
    .filter((change) => change.taskProgress.total > change.taskProgress.completed)
    .slice(0, 5);
  const recentArchive = archived.slice(0, 5);
  const creators = [...changes.reduce((map, change) => {
    const name = change.createdBy ?? 'Local / unknown';
    const existing = map.get(name) ?? { changes: 0, specs: 0 };

    existing.changes += 1;
    existing.specs += change.deltaSpecCount;
    map.set(name, existing);

    return map;
  }, new Map<string, { changes: number; specs: number }>())]
    .sort((left, right) => right[1].changes - left[1].changes || left[0].localeCompare(right[0]))
    .slice(0, 5);
  const timeline = [...changes.reduce((map, change) => {
    const startedAt = change.createdTimestamp;
    const archivedAt = change.status === 'archive' ? change.updatedTimestamp ?? change.createdTimestamp : null;

    for (const [timestamp, key] of [[startedAt, 'started'], [archivedAt, 'archived']] as const) {
      if (!timestamp) {
        continue;
      }

      const month = new Date(timestamp);
      const id = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
      const existing = map.get(id) ?? { timestamp, started: 0, archived: 0 };

      existing[key] += 1;
      existing.timestamp = Math.min(existing.timestamp, timestamp);
      map.set(id, existing);
    }

    return map;
  }, new Map<string, { timestamp: number; started: number; archived: number }>())]
    .sort((left, right) => left[1].timestamp - right[1].timestamp)
    .slice(-8);
  const timelineMax = Math.max(1, ...timeline.map(([, item]) => Math.max(item.started, item.archived)));

  return /* html */ `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
      <style nonce="${nonce}">
        :root { color-scheme: var(--vscode-color-scheme); }
        body { margin: 0; padding: 28px clamp(18px, 5vw, 64px); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }
        main { max-width: 1100px; margin: auto; }
        header { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
        h1 { margin: 0; font-size: clamp(1.6rem, 3vw, 2.5rem); letter-spacing: -0.04em; }
        .eyebrow { color: var(--vscode-textLink-foreground); font-size: .75rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; margin-bottom: 7px; }
        .muted { color: var(--vscode-descriptionForeground); }
        button { font: inherit; }
        .refresh { border: 1px solid var(--vscode-button-border, var(--vscode-panel-border)); border-radius: 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 8px 14px; cursor: pointer; }
        .refresh:hover, .work-item:hover { background: var(--vscode-button-hoverBackground); }
        .stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
        .stat, .panel { border: 1px solid var(--vscode-panel-border); border-radius: 14px; background: color-mix(in srgb, var(--vscode-editor-background) 82%, var(--vscode-sideBar-background)); }
        .stat { padding: 16px; border-top: 3px solid var(--accent); }
        .stat span { display: block; color: var(--vscode-descriptionForeground); font-size: .78rem; }
        .stat strong { display: block; margin-top: 8px; font-size: 1.55rem; color: var(--accent); }
        .grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr); gap: 14px; }
        .panel { padding: 20px; }
        .panel--wide { grid-column: 1 / -1; }
        .panel h2 { margin: 0 0 18px; font-size: 1rem; }
        .panel__head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .completion { display: flex; align-items: center; gap: 26px; margin-bottom: 22px; }
        .donut { --progress: var(--vscode-charts-green, #89d185); width: 112px; height: 112px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; background: conic-gradient(from -90deg, var(--progress) 0 var(--completion), color-mix(in srgb, var(--vscode-panel-border) 55%, transparent) var(--completion) 100%); box-shadow: 0 0 26px color-mix(in srgb, var(--progress) 22%, transparent); }
        .donut::before { content: ''; grid-area: 1 / 1; width: 82px; height: 82px; border-radius: inherit; background: var(--vscode-editor-background); }
        .donut strong { grid-area: 1 / 1; z-index: 1; font-size: 1.4rem; }
        .completion p { margin: 4px 0; }
        .metric-row { margin: 14px 0; }
        .metric-row__label { display: flex; justify-content: space-between; gap: 12px; font-size: .82rem; }
        .metric-row__label strong { color: var(--vscode-descriptionForeground); font-weight: 400; }
        .bar { height: 7px; margin-top: 7px; border-radius: 99px; background: color-mix(in srgb, var(--vscode-panel-border) 50%, transparent); overflow: hidden; }
        .bar i, .mini-bar i { display: block; height: 100%; border-radius: inherit; background: var(--bar-color); }
        .bar--blue { --bar-color: var(--vscode-textLink-foreground); }
        .bar--gold { --bar-color: var(--vscode-editorWarning-foreground); }
        .bar--orange { --bar-color: var(--vscode-list-warningForeground); }
        .bar--green { --bar-color: var(--vscode-testing-iconPassed); }
        .mini-bar { height: 6px; margin-top: 6px; border-radius: 99px; background: color-mix(in srgb, var(--vscode-panel-border) 45%, transparent); overflow: hidden; }
        .status-split { display: grid; gap: 12px; margin-bottom: 22px; }
        .split-bar { display: flex; height: 16px; overflow: hidden; border-radius: 99px; background: var(--vscode-panel-border); }
        .split-bar i { background: var(--vscode-testing-iconPassed); }
        .split-bar i + i { background: var(--vscode-editorWarning-foreground); }
        .legend { display: flex; justify-content: space-between; color: var(--vscode-descriptionForeground); font-size: .82rem; }
        .legend b { color: var(--vscode-editor-foreground); }
        .work-list { display: grid; gap: 8px; }
        .work-item { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 0; border: 0; border-bottom: 1px solid var(--vscode-panel-border); background: transparent; color: var(--vscode-textLink-foreground); text-align: left; cursor: pointer; }
        .work-item::after { content: attr(data-remaining); color: var(--vscode-descriptionForeground); font-size: .78rem; }
        .creator-list { display: grid; gap: 14px; }
        .creator-row { display: grid; gap: 4px; }
        .creator-row__head, .timeline-row__head { display: flex; justify-content: space-between; gap: 12px; }
        .timeline { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 12px; align-items: end; min-height: 180px; }
        .timeline-row { display: grid; gap: 8px; }
        .timeline-bars { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; align-items: end; height: 116px; }
        .timeline-bars i { display: block; min-height: 3px; border-radius: 7px 7px 0 0; background: var(--bar-color); }
        .timeline-bars i:first-child { --bar-color: var(--vscode-textLink-foreground); }
        .timeline-bars i:last-child { --bar-color: var(--vscode-editorWarning-foreground); }
        .empty { color: var(--vscode-descriptionForeground); padding: 12px 0; }
        @media (max-width: 800px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid { grid-template-columns: 1fr; } .panel--wide { grid-column: auto; } }
        @media (max-width: 460px) { header { align-items: start; flex-direction: column; } .completion { gap: 16px; } }
      </style>
    </head>
    <body>
      <main>
        <header>
          <div><div class="eyebrow">Openspec / Insights</div><h1>Dashboard</h1><div class="muted">A live view of your change portfolio</div></div>
          <button class="refresh" data-action="refresh">Refresh</button>
        </header>
        <section class="stats" aria-label="Summary">
          <div class="stat" style="--accent:var(--vscode-testing-iconPassed)"><span>Active changes</span><strong>${active.length}</strong></div>
          <div class="stat" style="--accent:var(--vscode-editorWarning-foreground)"><span>Archived changes</span><strong>${archived.length}</strong></div>
          <div class="stat" style="--accent:var(--vscode-textLink-foreground)"><span>Total tasks</span><strong>${completedTasks}/${totalTasks}</strong></div>
          <div class="stat" style="--accent:var(--vscode-gitDecoration-modifiedResourceForeground)"><span>Remaining</span><strong>${Math.max(0, totalTasks - completedTasks)}</strong></div>
          <div class="stat" style="--accent:var(--vscode-list-warningForeground)"><span>Delta specs</span><strong>${totalSpecs}</strong></div>
        </section>
        <div class="grid">
          <section class="panel">
            <div class="panel__head"><h2>Delivery progress</h2><span class="muted">${completion}% complete</span></div>
            <div class="completion">
              <div class="donut" style="--completion:${completion}%" aria-label="${completion}% of tasks complete"><strong>${completion}%</strong></div>
              <div><p><strong>${completedTasks}</strong> tasks completed</p><p class="muted"><strong>${Math.max(0, totalTasks - completedTasks)}</strong> tasks remaining</p></div>
            </div>
            <h2>Document coverage</h2>
            ${coverage.map(([label, value, tone]) => renderBar(label, value, changes.length, tone)).join('') || '<div class="empty">No changes discovered.</div>'}
          </section>
          <section class="panel">
            <div class="panel__head"><h2>Change status</h2><span class="muted">${changes.length} total</span></div>
            <div class="status-split">
              <div class="split-bar"><i style="width:${percent(active.length, changes.length)}%"></i><i style="width:${percent(archived.length, changes.length)}%"></i></div>
              <div class="legend"><span>● Active <b>${active.length}</b></span><span>● Archive <b>${archived.length}</b></span></div>
            </div>
            <h2>Active workload</h2>
            <div class="work-list">
              ${activeRemaining.map((change) => `<div>${renderOpenButton(change, change.name)}<span class="muted">${change.taskProgress.total - change.taskProgress.completed} left</span></div>`).join('') || '<div class="empty">No unfinished active tasks.</div>'}
            </div>
          </section>
          <section class="panel">
            <div class="panel__head"><h2>Recent archive</h2><span class="muted">sorted by project activity</span></div>
            <div class="work-list">
              ${recentArchive.map((change) => renderOpenButton(change, formatArchiveName(change.name))).join('') || '<div class="empty">No archived changes.</div>'}
            </div>
          </section>
          <section class="panel">
            <div class="panel__head"><h2>Creators</h2><span class="muted">from git history</span></div>
            <div class="creator-list">
              ${creators.map(([name, stats]) => `
                <div class="creator-row">
                  <div class="creator-row__head"><strong>${escapeHtml(name)}</strong><span class="muted">${stats.changes} changes · ${stats.specs} specs</span></div>
                  ${renderMiniBar(stats.changes, changes.length, 'blue')}
                </div>
              `).join('') || '<div class="empty">No git authors found.</div>'}
            </div>
          </section>
          <section class="panel panel--wide">
            <div class="panel__head"><h2>Started vs archived timeline</h2><span class="muted">by month</span></div>
            <div class="legend"><span>● Started</span><span>● Archived</span></div>
            <div class="timeline">
              ${timeline.map(([, item]) => `
                <div class="timeline-row">
                  <div class="timeline-bars">
                    <i title="${item.started} started" style="height:${percent(item.started, timelineMax)}%"></i>
                    <i title="${item.archived} archived" style="height:${percent(item.archived, timelineMax)}%"></i>
                  </div>
                  <div class="timeline-row__head"><span>${monthLabel(item.timestamp)}</span><span class="muted">${item.started}/${item.archived}</span></div>
                </div>
              `).join('') || '<div class="empty">No timeline data yet.</div>'}
            </div>
          </section>
        </div>
      </main>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.querySelector('[data-action="refresh"]').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
        document.querySelectorAll('[data-uri]').forEach((element) => element.addEventListener('click', () => vscode.postMessage({ type: 'openSpec', uri: element.getAttribute('data-uri') })));
      </script>
    </body>
    </html>
  `;
}

export class OpenspecDashboardPanel {
  private panel?: vscode.WebviewPanel;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      void this.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'openspec.dashboard',
      'Openspec Dashboard',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this.extensionUri] },
    );
    this.panel = panel;
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
      }
    });
    panel.webview.onDidReceiveMessage((message: { type?: string; uri?: string }) => {
      if (message.type === 'refresh') {
        void this.refresh();
      } else if (message.type === 'openSpec' && message.uri) {
        void vscode.commands.executeCommand('openspec.openSpec', vscode.Uri.parse(message.uri));
      }
    });
    void this.refresh();
  }

  public async refresh(): Promise<void> {
    if (!this.panel) {
      return;
    }

    const changes = await listChangeSummaries();
    const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
    this.panel.webview.html = renderHtml(changes, this.panel.webview.cspSource, nonce);
  }
}
