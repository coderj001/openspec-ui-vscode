import * as path from 'path';
import { getSpecFolderName } from '../specs/paths';

export interface SessionCommentExportEntry {
  readonly ownerLabel: string;
  readonly fileLabel: string;
  readonly line: number;
  readonly text: string;
}

export function getCommentFileLabel(filePath: string): string {
  const basename = path.basename(filePath);

  if (basename.toLowerCase() !== 'spec.md') {
    return basename;
  }

  const folderName = getSpecFolderName(filePath);

  return folderName ? `${folderName}/spec.md` : basename;
}

export function formatCommentExport(entries: readonly SessionCommentExportEntry[]): string {
  return entries
    .map((entry) => `${entry.ownerLabel} > ${entry.fileLabel} [L${entry.line}] -> ${JSON.stringify(entry.text)}`)
    .join('\n');
}
