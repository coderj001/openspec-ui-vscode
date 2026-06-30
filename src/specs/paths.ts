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

export function getChangeFolderName(filePath: string): string | null {
  if (!isChangeFilePath(filePath)) {
    return null;
  }

  const segments = normalize(filePath).split('/');
  const changesIndex = segments.lastIndexOf('changes');

  if (changesIndex === -1 || changesIndex + 1 >= segments.length) {
    return null;
  }

  return segments[changesIndex + 1] ?? null;
}

export function getChangeRootPath(filePath: string): string | null {
  if (!isChangeFilePath(filePath)) {
    return null;
  }

  const segments = normalize(filePath).split('/');
  const changesIndex = segments.lastIndexOf('changes');

  if (changesIndex === -1 || changesIndex + 1 >= segments.length) {
    return null;
  }

  return segments.slice(0, changesIndex + 2).join(path.sep);
}

export function getSpecFolderName(filePath: string): string | null {
  const segments = normalize(filePath).split('/');
  const specsIndex = segments.lastIndexOf('specs');

  if (specsIndex === -1 || specsIndex + 1 >= segments.length) {
    return null;
  }

  return segments[specsIndex + 1] ?? null;
}
