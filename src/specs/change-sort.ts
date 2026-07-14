export interface ChangeSortKey {
  readonly name: string;
  readonly folderTimestamp: number | null;
  readonly gitTimestamp: number | null;
  readonly dateTimestamp: number | null;
}

function compareTimestampDesc(left: number | null, right: number | null): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right - left;
}

export function parseFolderDateTimestamp(folderName: string): number | null {
  const match = folderName.match(/^(\d{4}-\d{2}-\d{2})-/);

  if (!match) {
    return null;
  }

  const timestamp = Date.parse(`${match[1]}T00:00:00Z`);

  return Number.isNaN(timestamp) ? null : timestamp;
}

export function compareChangeSortKey(left: ChangeSortKey, right: ChangeSortKey): number {
  return compareTimestampDesc(left.folderTimestamp, right.folderTimestamp)
    || compareTimestampDesc(left.gitTimestamp, right.gitTimestamp)
    || compareTimestampDesc(left.dateTimestamp, right.dateTimestamp)
    || left.name.localeCompare(right.name);
}
