import * as vscode from 'vscode';
import * as path from 'path';
import { OpenspecSidebarViewProvider } from './views/sidebar';
import { OpenspecSpecEditorProvider } from './editors/spec-editor';
import { isChangeFilePath, isOpenSpecPath } from './specs/paths';

export function activate(context: vscode.ExtensionContext): void {
  const dashboard = new OpenspecSidebarViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(OpenspecSidebarViewProvider.viewType, dashboard),
    vscode.window.registerCustomEditorProvider(
      OpenspecSpecEditorProvider.viewType,
      new OpenspecSpecEditorProvider(context.extensionUri),
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

      const isSpecMarkdown = path.basename(uri.fsPath).toLowerCase() === 'spec.md';
      const isCustomChangeMarkdown = isChangeFilePath(uri.fsPath);

      if ((isOpenSpecPath(uri.fsPath) && isSpecMarkdown) || isCustomChangeMarkdown) {
        await vscode.commands.executeCommand('vscode.openWith', uri, OpenspecSpecEditorProvider.viewType);
        return;
      }

      await vscode.commands.executeCommand('vscode.open', uri);
    }),
  );

  const specWatcher = vscode.workspace.createFileSystemWatcher('**/openspec/**/*.md');
  const configWatcher = vscode.workspace.createFileSystemWatcher('**/openspec/config.yaml');
  specWatcher.onDidCreate(() => void dashboard.refresh());
  specWatcher.onDidChange(() => void dashboard.refresh());
  specWatcher.onDidDelete(() => void dashboard.refresh());
  configWatcher.onDidCreate(() => void dashboard.refresh());
  configWatcher.onDidChange(() => void dashboard.refresh());
  configWatcher.onDidDelete(() => void dashboard.refresh());
  context.subscriptions.push(specWatcher, configWatcher);
}

export function deactivate(): void {}
