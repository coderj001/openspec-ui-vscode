import * as vscode from 'vscode';
import { OpenspecSidebarViewProvider } from './views/sidebar';
import { OpenspecSpecEditorProvider } from './editors/spec-editor';

export function activate(context: vscode.ExtensionContext): void {
  const dashboard = new OpenspecSidebarViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(OpenspecSidebarViewProvider.viewType, dashboard),
    vscode.window.registerCustomEditorProvider(
      OpenspecSpecEditorProvider.viewType,
      new OpenspecSpecEditorProvider(),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      },
    ),
    vscode.commands.registerCommand('openspec.showDashboard', () => {
      void vscode.commands.executeCommand('workbench.view.extension.openspec');
    }),
    vscode.commands.registerCommand('openspec.refreshDashboard', () => {
      void dashboard.refresh();
    }),
    vscode.commands.registerCommand('openspec.openSpec', async (uri: vscode.Uri) => {
      if (!(uri instanceof vscode.Uri)) {
        return;
      }

      await vscode.commands.executeCommand('vscode.openWith', uri, OpenspecSpecEditorProvider.viewType);
    }),
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
  watcher.onDidCreate(() => void dashboard.refresh());
  watcher.onDidChange(() => void dashboard.refresh());
  watcher.onDidDelete(() => void dashboard.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate(): void {}
