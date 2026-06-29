import * as assert from 'assert';
import { parseSpecText, looksLikeSpec } from '../../specs/parser';

suite('spec parser', () => {
  test('parses sections and task progress', () => {
    const text = [
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
    ].join('\n');

    const parsed = parseSpecText('/workspace/specs/sample.md', text);

    assert.strictEqual(parsed.title, 'Sample Spec');
    assert.strictEqual(parsed.sections.Proposal, 'Ship it.');
    assert.strictEqual(parsed.taskProgress.total, 2);
    assert.strictEqual(parsed.taskProgress.completed, 1);
  });

  test('detects spec-shaped markdown', () => {
    assert.strictEqual(looksLikeSpec('/workspace/specs/sample.md', '# Proposal\ncontent'), true);
    assert.strictEqual(looksLikeSpec('/workspace/notes/other.md', '# Notes\ncontent'), false);
  });
});
