import * as assert from 'assert';
import { parseSpecText, looksLikeSpec } from '../specs/parser';
import { getChangeFolderName, isChangeFilePath, isChangeSpecPath, isSourceSpecPath } from '../specs/paths';

async function main(): Promise<void> {
  try {
    const parsed = parseSpecText(
      '/workspace/specs/sample.md',
      [
        '# Sample Spec',
        '',
        '## Proposal',
        'Ship it.',
        '',
        '## Tasks',
        '- [x] first',
        '- [ ] second',
        '',
        '## Specs',
        'Details here.',
      ].join('\n'),
    );

    assert.strictEqual(parsed.title, 'Sample Spec');
    assert.strictEqual(parsed.sections.Proposal, 'Ship it.');
    assert.strictEqual(parsed.taskProgress.total, 2);
    assert.strictEqual(parsed.taskProgress.completed, 1);
    assert.strictEqual(looksLikeSpec('/workspace/specs/sample.md', '# Proposal\ncontent'), true);
    assert.strictEqual(looksLikeSpec('/workspace/notes/other.md', '# Notes\ncontent'), false);
    assert.strictEqual(isSourceSpecPath('/workspace/openspec/specs/core/spec.md'), true);
    assert.strictEqual(isChangeFilePath('/workspace/openspec/changes/add-views/proposal.md'), true);
    assert.strictEqual(isChangeSpecPath('/workspace/openspec/changes/add-views/specs/core/spec.md'), true);
    assert.strictEqual(getChangeFolderName('/workspace/openspec/changes/add-views/specs/core/spec.md'), 'add-views');
    assert.strictEqual(parseSpecText('/workspace/openspec/changes/archive/add-views/specs/core/spec.md', '# Archived').status, 'archive');

    console.log('test: ok');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void main();
