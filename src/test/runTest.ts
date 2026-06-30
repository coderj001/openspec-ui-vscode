import { formatCommentExport, getCommentFileLabel } from '../editors/comment-export';
import * as assert from 'assert';
import { renderCommentableMarkdown, renderMarkdown } from '../editors/markdown';
import { resolveOpenFileUri } from '../editors/open-file-target';
import { parseSpecText, looksLikeSpec } from '../specs/parser';
import { formatArchiveName, getChangeFolderName, getChangeRootPath, getSpecFolderName, isChangeFilePath, isChangeSpecPath, isSourceSpecPath } from '../specs/paths';

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
        '#### Scenario: First',
        'One',
        '',
        '#### Scenario: Second',
        'Two',
        '',
        '## Specs',
        'Details here.',
      ].join('\n'),
    );

    assert.strictEqual(parsed.title, 'Sample Spec');
    assert.strictEqual(parsed.rawText.includes('Ship it.'), true);
    assert.strictEqual(parsed.sections.Proposal, 'Ship it.');
    assert.strictEqual(parsed.scenarioCount, 2);
    assert.strictEqual(parsed.taskProgress.total, 2);
    assert.strictEqual(parsed.taskProgress.completed, 1);
    assert.strictEqual(looksLikeSpec('/workspace/specs/sample.md', '# Proposal\ncontent'), true);
    assert.strictEqual(looksLikeSpec('/workspace/notes/other.md', '# Notes\ncontent'), false);
    assert.strictEqual(isSourceSpecPath('/workspace/openspec/specs/core/spec.md'), true);
    assert.strictEqual(isChangeFilePath('/workspace/openspec/changes/add-views/proposal.md'), true);
    assert.strictEqual(isChangeSpecPath('/workspace/openspec/changes/add-views/specs/core/spec.md'), true);
    assert.strictEqual(getChangeFolderName('/workspace/openspec/changes/add-views/specs/core/spec.md'), 'add-views');
    assert.strictEqual(getChangeRootPath('/workspace/openspec/changes/add-views/specs/core/spec.md'), '/workspace/openspec/changes/add-views');
    assert.strictEqual(getChangeFolderName('/workspace/openspec/changes/archive/2026-06-09-browser-graph-bearer-auth/specs/core/spec.md'), '2026-06-09-browser-graph-bearer-auth');
    assert.strictEqual(getChangeRootPath('/workspace/openspec/changes/archive/2026-06-09-browser-graph-bearer-auth/specs/core/spec.md'), '/workspace/openspec/changes/archive/2026-06-09-browser-graph-bearer-auth');
    assert.strictEqual(getSpecFolderName('/workspace/openspec/changes/add-views/specs/catalog-management/spec.md'), 'catalog-management');
    assert.strictEqual(formatArchiveName('2026-06-09-browser-graph-bearer-auth'), 'browser-graph-bearer-auth');
    assert.strictEqual(formatArchiveName('browser-graph-bearer-auth'), 'browser-graph-bearer-auth');
    assert.strictEqual(parseSpecText('/workspace/openspec/changes/archive/add-views/specs/core/spec.md', '# Archived').status, 'archive');
    assert.strictEqual(renderMarkdown('# Title\n\n- item\n\n`code` **bold**').includes('<h1 class="md-heading md-heading--1">Title</h1>'), true);
    assert.strictEqual(renderMarkdown('# Title\n\n- item\n\n`code` **bold**').includes('<code>code</code>'), true);
    assert.strictEqual(renderMarkdown('- [x] done').includes('md-list__marker--task'), true);
    assert.strictEqual(
      renderCommentableMarkdown('```mermaid\ngraph TD\nA-->B\n```').includes('<pre class="md-mermaid__source" data-mermaid-source hidden>graph TD\nA--&gt;B</pre>'),
      true,
    );
    assert.strictEqual(
      renderCommentableMarkdown('```mermaid\ngraph TD\nA-->B\n```').includes('data-line="1"'),
      true,
    );
    assert.strictEqual(
      renderCommentableMarkdown('```ts\nconst x = 1;\n```').includes('md-code-fence'),
      true,
    );
    assert.strictEqual(
      renderCommentableMarkdown('```mermaid\ngraph TD\nA-->B\n  ```\nAfter').includes('After'),
      true,
    );
    assert.strictEqual(
      renderCommentableMarkdown('```mermaid\ngraph TD\nA-->B\n  ```\nAfter').includes('<pre class="md-mermaid__source" data-mermaid-source hidden>graph TD\nA--&gt;B</pre>'),
      true,
    );
    assert.strictEqual(getCommentFileLabel('/workspace/openspec/changes/add-views/design.md'), 'design.md');
    assert.strictEqual(getCommentFileLabel('/workspace/openspec/changes/add-views/specs/catalog-management/spec.md'), 'catalog-management/spec.md');
    assert.strictEqual(formatCommentExport([
      {
        ownerLabel: 'add-tag-people-suggestions',
        fileLabel: 'design.md',
        line: 12,
        text: 'No longer need this scenario for now as it testing phase',
      },
    ]), 'add-tag-people-suggestions > design.md [L12] -> "No longer need this scenario for now as it testing phase"');
    assert.strictEqual(resolveOpenFileUri({
      selectedTab: 'design',
      proposal: undefined,
      design: { uri: { toString: () => '/workspace/openspec/changes/add-views/design.md' }, title: 'Design', content: '' },
      tasks: undefined,
      selectedSpecUri: undefined,
      specs: [],
    } as unknown as Parameters<typeof resolveOpenFileUri>[0]), '/workspace/openspec/changes/add-views/design.md');
    assert.strictEqual(resolveOpenFileUri({
      kind: 'source',
      uri: { toString: () => '/workspace/openspec/specs/core/spec.md' },
    } as unknown as Parameters<typeof resolveOpenFileUri>[0]), '/workspace/openspec/specs/core/spec.md');

    console.log('test: ok');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void main();
