import * as path from 'path';

function normalize(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function isOpenSpecPath(filePath: string): boolean {
  return /(^|[\\/])openspec([\\/]|$)/i.test(filePath);
}

export function isSourceSpecPath(filePath: string): boolean {
  return /(^|[\\/])openspec[\\/]specs[\\/].+[\\/]spec\.md$/i.test(filePath);
}

export function isChangeFilePath(filePath: string): boolean {
  return /(^|[\\/])openspec[\\/]changes[\\/].+\.md$/i.test(filePath);
}

export function isChangeSpecPath(filePath: string): boolean {
  return /(^|[\\/])openspec[\\/]changes[\\/].+[\\/]specs[\\/].+[\\/]spec\.md$/i.test(filePath);
}

function getChangeFolderIndex(segments: readonly string[]): number {
  const changesIndex = segments.lastIndexOf('changes');

  if (changesIndex === -1) {
    return -1;
  }

  const bucket = segments[changesIndex + 1]?.toLowerCase();

  if (bucket === 'archive' || bucket === 'archived') {
    return changesIndex + 2;
  }

  return changesIndex + 1;
}

export function getChangeFolderName(filePath: string): string | null {
  if (!isChangeFilePath(filePath)) {
    return null;
  }

  const segments = normalize(filePath).split('/');
  const folderIndex = getChangeFolderIndex(segments);

  if (folderIndex === -1 || folderIndex >= segments.length) {
    return null;
  }

  return segments[folderIndex] ?? null;
}

export function getChangeRootPath(filePath: string): string | null {
  if (!isChangeFilePath(filePath)) {
    return null;
  }

  const segments = normalize(filePath).split('/');
  const folderIndex = getChangeFolderIndex(segments);

  if (folderIndex === -1 || folderIndex >= segments.length) {
    return null;
  }

  return segments.slice(0, folderIndex + 1).join(path.sep);
}

export function getSpecFolderName(filePath: string): string | null {
  const segments = normalize(filePath).split('/');
  const specsIndex = segments.lastIndexOf('specs');

  if (specsIndex === -1 || specsIndex + 1 >= segments.length) {
    return null;
  }

  return segments[specsIndex + 1] ?? null;
}

export function formatArchiveName(name: string): string {
  return name.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}
