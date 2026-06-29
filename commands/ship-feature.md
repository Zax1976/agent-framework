---
description: Entry point for the read-only review workflow — resolves a branch diff and triggers the ship-feature-review dynamic workflow (security-reviewer + testing in parallel). No playbook logic here; the workflow coordinates.
argument-hint: "[base ref or commit range] (default: current branch vs main)"
---

You are the thin entry point for `/ship-feature`. Your ONLY job is to resolve the review
target and hand it to the dynamic workflow — do NOT do the review yourself, and do NOT run
any dev/db-migration/deploy work. The workflow is the coordinator.

Argument (optional): **$ARGUMENTS**

## Steps

0. **Prerequisite check.** The workflow fans out the `security-reviewer` agent, which ships
   as a TEMPLATE (it's too stack-specific to genericize). Before doing anything else,
   confirm `security-reviewer` is RESOLVABLE in this session's agent roster — i.e. an agent
   named `security-reviewer` is available to delegate to, whether it's defined at the
   project level (`.claude/agents/`) OR the user level (`~/.claude/agents/`) OR provided by
   an installed plugin. Do NOT test for a specific file path — that would false-block
   user-level and marketplace installs. Check availability/resolvability only.
   If it is genuinely NOT available in the roster, STOP and tell the user verbatim:
   > "`/ship-feature` needs a `security-reviewer` agent, which isn't set up yet. Create it
   > from `templates/agents/security-reviewer.template.md` (in the agent-framework plugin)
   > and fill in its 'load-bearing rules' section from this project's CLAUDE.md, then re-run
   > `/ship-feature`."
   (That path is the remedy HINT, not the existence test.) Do NOT trigger the workflow
   until the agent resolves. (`testing` ships ready-to-use, so it needs no check.)

1. **Resolve the review target** (the only logic you do — gathering *what* to review):
   - If `$ARGUMENTS` names a base ref or commit range, use it.
   - Otherwise default to the current branch vs `main`: run `git diff --stat main...HEAD`
     and `git diff main...HEAD --name-only`.
   - If that diff is EMPTY (on `main`, nothing ahead), fall back to the most recent commit:
     range `HEAD~1..HEAD` (report the fallback and which commit).
   - Keep the payload LEAN and quote-free so `args` threads reliably (a large unified diff
     with embedded quotes/newlines can break the args JSON and drop the whole payload).
     Capture: `rangeDesc` (human label), `changedFiles` (`--name-only`), `diffStat`
     (`--stat` summary). Do NOT pass the full unified diff — security-reviewer reads the
     changed files' full state itself.

2. **Trigger the workflow.** Call the Workflow tool by **scriptPath** (NOT by name —
   repo/plugin-local workflows do not register in the name registry in this harness; `name`
   returns "not found"):
   ```
   Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/ship-feature-review.js",
              args: { rangeDesc, changedFiles, diffStat } })
   ```
   (If this plugin's files were copied into the consuming repo instead of installed as a
   plugin, point scriptPath at the local `.claude/workflows/ship-feature-review.js`.)
   **Thread-check:** confirm the returned `target` echoes your `rangeDesc`. If it comes
   back as the default `"current branch vs main"` when you passed something else, `args`
   didn't thread — shrink/quote-clean the payload and retry.

3. **Present the combined report**: the security findings (with the verdict line) and the
   testing/typecheck verdict, side by side, plus any disagreement or blind spots. Do NOT
   act on the findings — this is review only. If there are critical/high security findings
   or red tests, say so plainly and stop for the user to decide next steps.

## Boundaries
- This command and its workflow are READ-ONLY. They never invoke `dev`, `db-migration`, or
  `deploy`, never edit source, never deploy.
- Do not widen `.claude/settings*.json`.
