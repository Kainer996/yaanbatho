# Obsidian brain

Yaan's shared memory lives in the `Kainer996/ava-yaan-obsidian` repo. Every session should use it.

At session start:

1. Add the repo with `add_repo` (push access) and clone it.
2. Read `Agent-Shared/user-profile.md`, `Agent-Shared/project-state.md`, and `Agent-ClaudeCode/working-context.md`.
3. Read today's note in `Agent-ClaudeCode/daily/` if it exists.

Before ending a session where you did real work:

1. Append a summary to `Agent-ClaudeCode/daily/YYYY-MM-DD.md`.
2. Update `Agent-Shared/project-state.md` if project state changed.
3. Append durable decisions to `Agent-Shared/decisions-log.md`.
4. Pull, commit, and push the vault to `main`.

Write summaries, not transcripts. Never overwrite `Agent-Hermes/` — that space belongs to Ava. Full protocol: `Agent-ClaudeCode/README.md` in the vault.

# Writing style

The rule is simple. Use short sentences. Use the active voice. Give each word one meaning. Cut the clutter. Keep the writing warm and human - a person wrote it, not a manual.

This rule covers everything written for people: UI copy, quest text, toasts, docs, commit messages.
