import * as vscode from 'vscode';
import { looksLikeSpec, parseSpecText, ParsedSpec } from './parser';

export interface SpecDocument extends ParsedSpec {
  readonly uri: vscode.Uri;
}

function toText(data: Uint8Array): string {
  return Buffer.from(data).toString('utf8');
}

export async function readSpecDocument(uri: vscode.Uri): Promise<SpecDocument | null> {
  let text: string;

  try {
    text = toText(await vscode.workspace.fs.readFile(uri));
  } catch {
    return null;
  }

  if (!looksLikeSpec(uri.fsPath, text)) {
    return null;
  }

  return {
    uri,
    ...parseSpecText(uri.fsPath, text),
  };
}

export async function listSpecDocuments(): Promise<SpecDocument[]> {
  const files = await vscode.workspace.findFiles('**/*.md', '**/{node_modules,.git}/**');
  const docs = await Promise.all(files.map((uri) => readSpecDocument(uri)));

  return docs.filter((doc): doc is SpecDocument => doc !== null).sort((left, right) => left.title.localeCompare(right.title));
}
