<p align="center">
  <img src="./resources/openspec.svg" width="64" alt="Openspec UI icon">
</p>

<h1 align="center">Openspec UI</h1>

<p align="center">
  A visual workspace for browsing, reviewing, and understanding Openspec changes in VS Code.
</p>

<p align="center">
  <code>change explorer</code>&nbsp;&nbsp; <code>progress dashboard</code>&nbsp;&nbsp; <code>commentable viewer</code>
</p>

## See it in action

Open changes from the Openspec activity bar, inspect their progress, and review
artifacts without leaving the editor.

https://github.com/user-attachments/assets/248784df-3632-4846-89cb-8c636321e05f

## Why Openspec UI?

Openspec UI turns a folder of markdown artifacts into a navigable workspace:

- **Find the work:** Browse active and archived changes from the Openspec
  activity-bar view, with sorting by date, folder creation time, or Git activity.
- **Understand status:** Track proposals, designs, tasks, specs, task completion,
  document coverage, and delta specs from the sidebar and dashboard.
- **Review in context:** Open `proposal.md`, `design.md`, `tasks.md`, and
  `spec.md` in a custom viewer with line-level comments.
- **Hand feedback to your coding agent:** Use `Copy Comments` to export comments,
  artifact names, and line numbers for Codex, Claude Code, or another CLI tool.
- **Read richer artifacts:** Render Mermaid diagrams with a readable fallback when
  a diagram cannot be rendered.
- **Stay current:** Refresh manually or let file changes update the sidebar and
  dashboard automatically.

## A focused review loop

```text
Open an artifact  →  Comment on a line  →  Copy the review context  →  Update the change
```

Comments belong to the current viewer session and are not written into the
Openspec markdown files.

## How it works

The extension reads Openspec markdown directly from the current workspace and
does not require a separate server or database.

It watches:

- `openspec/**/*.md`
- `openspec/config.yaml`

When these files change, the sidebar and dashboard refresh automatically.

## Install locally

This repository is currently set up for local VS Code extension development.

```bash
npm install
npm run compile
npm run vsceBuild
```

Then install the generated `.vsix` file from VS Code with **Extensions → … →
Install from VSIX…**.

## Develop and verify

```bash
npm run watch    # Compile on changes
npm run test     # Compile and run the test suite
npm run lint     # Check TypeScript sources
```

## Release

Push a tag such as `v0.1.0` to build the VSIX and create a GitHub Release.

## Project status

The current release is `v0.0.1`. See the [changelog](./CHANGELOG.md) for the
features included in the initial release.
