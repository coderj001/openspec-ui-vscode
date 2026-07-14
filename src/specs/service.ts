import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { countTaskProgress, looksLikeSpec, parseSpecText, ParsedSpec, SpecTaskProgress } from './parser';
import { compareChangeSortKey, parseFolderDateTimestamp } from './change-sort';
import { getChangeFolderName, getChangeRootPath, isChangeFilePath, isChangeSpecPath, isOpenSpecPath, isSourceSpecPath } from './paths';

const execFileAsync = promisify(execFile);

export type OpenSpecDocumentKind = 'source' | 'change';

export interface SpecDocument extends ParsedSpec {
  readonly uri: vscode.Uri;
  readonly kind: OpenSpecDocumentKind;
}

export interface ChangeSummary {
  name: string;
  folderUri: vscode.Uri;
  openUri?: vscode.Uri;
  proposalUri?: vscode.Uri;
  designUri?: vscode.Uri;
  tasksUri?: vscode.Uri;
  deltaSpecCount: number;
  taskProgress: SpecTaskProgress;
  title: string;
  status: 'active' | 'archive';
}

export interface ChangeDocument {
  readonly kind: 'change';
  readonly name: string;
  readonly title: string;
  readonly status: 'active' | 'archive';
  readonly folderUri: vscode.Uri;
  readonly selectedTab: ChangeTabName;
  readonly selectedSpecUri?: vscode.Uri;
  readonly proposal?: ChangeFileDocument;
  readonly design?: ChangeFileDocument;
  readonly tasks?: ChangeFileDocument;
  readonly specs: readonly SpecDocument[];
  readonly taskProgress: SpecTaskProgress;
}

export interface ChangeFileDocument {
  readonly uri: vscode.Uri;
  readonly title: string;
  readonly content: string;
}

export type ChangeTabName = 'proposal' | 'design' | 'tasks' | 'specs';

function toText(data: Uint8Array): string {
  return Buffer.from(data).toString('utf8');
}

function extractTitle(text: string, fallback: string): string {
  const match = text.match(/^\s*#\s+(.*?)\s*$/m);

  return match?.[1]?.trim() || fallback;
}

function createEmptyChangeSummary(filePath: string): ChangeSummary {
  const folderName = getChangeFolderName(filePath) ?? path.basename(path.dirname(filePath));
  const folderRoot = getChangeRootPath(filePath) ?? path.dirname(filePath);
  const status = /(^|[\\/])(archive|archived)([\\/]|$)/i.test(folderRoot) ? 'archive' : 'active';

  return {
    name: folderName,
    folderUri: vscode.Uri.file(folderRoot),
    deltaSpecCount: 0,
    taskProgress: {
      completed: 0,
      total: 0,
    },
    title: folderName,
    status,
  };
}

async function getFolderTimestamp(folderUri: vscode.Uri): Promise<number | null> {
  try {
    const stat = await vscode.workspace.fs.stat(folderUri);

    return stat.ctime > 0 ? stat.ctime : stat.mtime > 0 ? stat.mtime : null;
  } catch {
    return null;
  }
}

async function getGitTimestamp(folderUri: vscode.Uri): Promise<number | null> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(folderUri);

  if (!workspaceFolder) {
    return null;
  }

  const relativePath = path.relative(workspaceFolder.uri.fsPath, folderUri.fsPath) || '.';

  try {
    const { stdout } = await execFileAsync('git', [
      '-C',
      workspaceFolder.uri.fsPath,
      'log',
      '-1',
      '--format=%ct',
      '--',
      relativePath,
    ]);
    const timestamp = Number(String(stdout).trim());

    return Number.isNaN(timestamp) ? null : timestamp * 1000;
  } catch {
    return null;
  }
}

function getSelectedTab(filePath: string): ChangeTabName {
  const basename = path.basename(filePath).toLowerCase();

  if (basename === 'proposal.md') {
    return 'proposal';
  }

  if (basename === 'design.md') {
    return 'design';
  }

  if (basename === 'tasks.md') {
    return 'tasks';
  }

  return 'specs';
}

function createFileDocument(uri: vscode.Uri, text: string, fallback: string): ChangeFileDocument {
  return {
    uri,
    title: extractTitle(text, fallback),
    content: text,
  };
}

export async function readSpecDocument(uri: vscode.Uri): Promise<SpecDocument | null> {
  let text: string;

  try {
    text = toText(await vscode.workspace.fs.readFile(uri));
  } catch {
    return null;
  }

  if (!isOpenSpecPath(uri.fsPath) || !looksLikeSpec(uri.fsPath, text)) {
    return null;
  }

  return {
    uri,
    kind: isSourceSpecPath(uri.fsPath) ? 'source' : 'change',
    ...parseSpecText(uri.fsPath, text),
  };
}

export async function listSourceSpecDocuments(): Promise<SpecDocument[]> {
  const files = await vscode.workspace.findFiles('**/openspec/specs/**/spec.md', '**/{node_modules,.git}/**');
  const docs = await Promise.all(files.map((uri) => readSpecDocument(uri)));

  return docs
    .filter((doc): doc is SpecDocument => doc !== null && doc.kind === 'source')
    .sort((left, right) => left.title.localeCompare(right.title));
}

export async function listChangeSummaries(): Promise<ChangeSummary[]> {
  const files = await vscode.workspace.findFiles('**/openspec/changes/**/*.md', '**/{node_modules,.git}/**');
  const buckets = new Map<string, ChangeSummary>();

  for (const uri of files) {
    const filePath = uri.fsPath;
    const rootPath = getChangeRootPath(filePath);
    const folderName = getChangeFolderName(filePath);

    if (!rootPath || !folderName) {
      continue;
    }

    const key = rootPath;
    const existing = buckets.get(key) ?? createEmptyChangeSummary(filePath);
    let text = '';

    try {
      text = toText(await vscode.workspace.fs.readFile(uri));
    } catch {
      text = '';
    }

    const basename = path.basename(filePath).toLowerCase();

    if (basename === 'proposal.md') {
      existing.proposalUri = uri;
      existing.openUri = existing.openUri ?? uri;
      existing.title = extractTitle(text, folderName);
    } else if (basename === 'design.md') {
      existing.designUri = uri;
      existing.openUri = existing.openUri ?? uri;
    } else if (basename === 'tasks.md') {
      existing.tasksUri = uri;
      existing.openUri = existing.openUri ?? uri;
      existing.taskProgress = countTaskProgress(text);
    } else if (basename === 'spec.md' && /(^|[\\/])specs([\\/]|$)/i.test(filePath)) {
      existing.deltaSpecCount += 1;
      existing.openUri = existing.openUri ?? uri;
    }

    buckets.set(key, existing);
  }

  const rankedChanges = await Promise.all([...buckets.values()].map(async (change) => ({
    change,
    sortKey: {
      name: change.name,
      folderTimestamp: await getFolderTimestamp(change.folderUri),
      gitTimestamp: await getGitTimestamp(change.folderUri),
      dateTimestamp: parseFolderDateTimestamp(change.name),
    },
  })));

  return rankedChanges
    .sort((left, right) => compareChangeSortKey(left.sortKey, right.sortKey))
    .map(({ change }) => change);
}

export async function readChangeDocument(uri: vscode.Uri): Promise<ChangeDocument | null> {
  const rootPath = getChangeRootPath(uri.fsPath);
  const changeName = getChangeFolderName(uri.fsPath);

  if (!rootPath || !changeName) {
    return null;
  }

  const folderUri = vscode.Uri.file(rootPath);
  const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folderUri, '**/*.md'), '**/{node_modules,.git}/**');
  let proposal: ChangeFileDocument | undefined;
  let design: ChangeFileDocument | undefined;
  let tasks: ChangeFileDocument | undefined;
  const specs: SpecDocument[] = [];

  for (const file of files) {
    let text = '';

    try {
      text = toText(await vscode.workspace.fs.readFile(file));
    } catch {
      text = '';
    }

    const basename = path.basename(file.fsPath).toLowerCase();

    if (basename === 'proposal.md') {
      proposal = createFileDocument(file, text, changeName);
      continue;
    }

    if (basename === 'design.md') {
      design = createFileDocument(file, text, 'Design');
      continue;
    }

    if (basename === 'tasks.md') {
      tasks = createFileDocument(file, text, 'Tasks');
      continue;
    }

    if (isChangeSpecPath(file.fsPath)) {
      const spec = await readSpecDocument(file);

      if (spec) {
        specs.push(spec);
      }
    }
  }

  const status = /(^|[\\/])(archive|archived)([\\/]|$)/i.test(rootPath) ? 'archive' : 'active';
  const title = proposal?.title ?? changeName;
  const sortedSpecs = specs.sort((left, right) => left.uri.fsPath.localeCompare(right.uri.fsPath));
  const taskProgress = tasks ? countTaskProgress(tasks.content) : { completed: 0, total: 0 };
  const selectedSpecUri = getSelectedTab(uri.fsPath) === 'specs'
    ? sortedSpecs.find((spec) => spec.uri.fsPath === uri.fsPath)?.uri ?? sortedSpecs[0]?.uri
    : undefined;

  return {
    kind: 'change',
    name: changeName,
    title,
    status,
    folderUri,
    selectedTab: getSelectedTab(uri.fsPath),
    selectedSpecUri,
    proposal,
    design,
    tasks,
    specs: sortedSpecs,
    taskProgress,
  };
}
