import * as path from 'path';

export const specSectionNames = ['Proposal', 'Design', 'Tasks', 'Specs'] as const;

export type SpecSectionName = (typeof specSectionNames)[number];
export type SpecStatus = 'active' | 'archive';

export interface SpecTaskProgress {
  readonly completed: number;
  readonly total: number;
}

export interface ParsedSpec {
  readonly title: string;
  readonly status: SpecStatus;
  readonly sections: Record<SpecSectionName, string>;
  readonly taskProgress: SpecTaskProgress;
}

const headingPattern = /^\s{0,3}(#{1,6})\s+(.*?)\s*$/;
const checkboxPattern = /^[-*]\s+\[( |x|X)\]\s+/gm;

function toTitleCaseSlug(value: string): string {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isArchivePath(filePath: string): boolean {
  return /(^|[\\/])(archive|archived)([\\/]|$)/i.test(filePath);
}

function createEmptySections(): Record<SpecSectionName, string> {
  return {
    Proposal: '',
    Design: '',
    Tasks: '',
    Specs: '',
  };
}

export function countTaskProgress(text: string): SpecTaskProgress {
  const taskMatches = text.match(checkboxPattern) ?? [];

  return {
    completed: taskMatches.filter((entry) => /\[x\]/i.test(entry)).length,
    total: taskMatches.length,
  };
}

export function looksLikeSpec(filePath: string, text: string): boolean {
  if (/(^|[\\/])openspec([\\/]|$)/i.test(filePath) || /\bspecs?\b/i.test(path.basename(filePath))) {
    return true;
  }

  return specSectionNames.some((section) => new RegExp(`^#{1,6}\\s+${section}\\s*$`, 'im').test(text));
}

export function parseSpecText(filePath: string, text: string): ParsedSpec {
  const sections = createEmptySections();
  const lines = text.split(/\r?\n/);
  let title = toTitleCaseSlug(path.basename(filePath));
  let currentSection: SpecSectionName | null = null;
  let seenTitle = false;

  for (const line of lines) {
    const headingMatch = headingPattern.exec(line);
    headingPattern.lastIndex = 0;

    if (headingMatch) {
      const headingText = headingMatch[2].trim();
      const sectionName = specSectionNames.find((section) => section.toLowerCase() === headingText.toLowerCase());

      if (headingMatch[1].length === 1 && !seenTitle) {
        title = headingText;
        seenTitle = true;
      }

      currentSection = sectionName ?? null;
      continue;
    }

    if (currentSection) {
      sections[currentSection] += `${line}\n`;
    }
  }

  for (const sectionName of specSectionNames) {
    sections[sectionName] = sections[sectionName].trim();
  }

  const taskProgress = countTaskProgress(sections.Tasks);

  return {
    title,
    status: isArchivePath(filePath) ? 'archive' : 'active',
    sections,
    taskProgress,
  };
}
