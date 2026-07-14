# Openspec UI

Openspec UI is a VS Code extension for browsing, opening, and understanding
Openspec changes without leaving the editor.

## Features

- **Change explorer:** Browse active changes and archived changes in the
  Openspec activity-bar view.
- **Progress at a glance:** See proposal, design, tasks, and specs availability
  for each change, along with completed tasks and progress bars.
- **Separate dashboard:** Open `Openspec: Show Dashboard` for a larger view of
  the change portfolio and its analytics.
- **Portfolio statistics:** Track active and archived changes, total and
  remaining tasks, completed-task percentage, delta specs, and document
  coverage.
- **Active workload:** Quickly identify active changes with unfinished tasks.
- **Git insights:** See change creators and spec counts based on Git history
  when the workspace is a Git repository.
- **Change timeline:** Compare changes started and archived by month using Git
  and folder timestamps.
- **Sorting:** Sort active and archived changes by date, folder creation time,
  or Git activity.
- **Spec viewer:** Open `proposal.md`, `design.md`, `tasks.md`, and `spec.md`
  with the extension's custom viewer.
- **Artifact comments:** Add review comments directly to lines in rendered
  Openspec artifacts.
- **CLI handoff:** Use `Copy Comments` to copy all current comments, including
  artifact names and line numbers, so they can be pasted into Codex,
  Claude Code, or another CLI tool to update the Openspec change.
- **Live refresh:** Refresh manually or let file changes update the sidebar and
  dashboard automatically.

The extension reads Openspec markdown files from the workspace and does not
require a separate server or database.

## Review Workflow

1. Open an Openspec artifact in the custom viewer.
2. Select the comment icon beside a line and add your feedback.
3. Select `Copy Comments` and paste the exported context into your preferred
   CLI coding tool.

Comments are collected for the current viewer session and are not written into
the Openspec markdown files.

## Scripts

- `npm run compile`
- `npm run test`
- `npm run watch`

## Releases

- Push a tag like `v0.1.0` to build the VSIX and create a GitHub Release.
