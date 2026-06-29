# agent-framework

A portable, multi-agent development framework for Claude Code. It gives a new project a
small team of specialized subagents plus a read-only review workflow — without rebuilding
anything. The agents describe **how to work**; your project's `CLAUDE.md` supplies **what**
(the facts, rules, and commands). Battle-tested on a real repo before extraction.

## The two-tier model

**Portable layer (ships ready-to-use, project-agnostic):**
- `dev` — generalist implementer; reads CLAUDE.md for the project's rules.
- `testing` — runs suites/typecheck/lint; edits test files only, never prod source.
- `docs` — keeps CLAUDE.md / ADRs accurate; records-not-invents.
- `ship-feature-review` workflow — fans out `security-reviewer` + `testing` in parallel
  on a diff; returns one combined report. **Read-only agents only.**
- `/ship-feature` — thin entry point that resolves the diff target and triggers the
  workflow.
- `/retro` — propose-only capture-learnings loop (below).

**Project-template layer (skeletons you fill in — too stack-specific to genericize):**
- `security-reviewer`, `db-migration`, `deploy` in `templates/agents/`. Each has a generic
  structure and a commented "FILL IN from your CLAUDE.md" block. Copy into your repo's
  `.claude/agents/` (drop the `.template` from the filename) and fill the bracketed rules
  from your CLAUDE.md.

Plus `templates/CLAUDE.md.template` — a starter CLAUDE.md with the sections the agents read.

## Wiring up a new project
1. Install this plugin (marketplace) — or copy `agents/`, `workflows/`, `commands/` into
   the project's `.claude/`.
2. Create `CLAUDE.md` from `templates/CLAUDE.md.template`; fill in your product, stack,
   load-bearing rules, test commands, and (if relevant) DB/deploy specifics.
3. Create your `security-reviewer` (required for `/ship-feature`), and `db-migration` /
   `deploy` as needed, from `templates/agents/*.template.md` — fill the bracketed rules
   from your CLAUDE.md.
4. Confirm a Bash permission allowlist in `.claude/settings.local.json` that covers your
   test/build/deploy commands. The agents **reuse** this; they never widen it.
5. Run `/ship-feature` on a branch diff (or recent commit) to validate the fan-out.

## Model tiers (guidance — the portable agents leave `model` unset to inherit)
The three portable agents (`dev`, `testing`, `docs`) intentionally **do not pin a model** —
they inherit the session model, so each consuming project picks its own tier. Recommended
tiers if you do want to pin them (set `model:` in the agent front-matter):
- **Strongest** — `security-reviewer` (highest-stakes reasoning) and `dev` (code generation).
- **Strong** — `db-migration`, `deploy` (expensive-to-reverse, but narrower).
- **Mid** — `testing`, `docs` (mechanical, high-volume).
The inert `templates/agents/*` ship with a sensible default `model:` line plus a comment
saying to tune or delete it.

## Two workflow gotchas (carried forward — they will bite you otherwise)
1. **Invoke workflows by `scriptPath`, not `name`.** Repo/plugin-local `*.js` workflows do
   not register in the name registry; invoking by `name` returns "not found". The
   `/ship-feature` command uses `${CLAUDE_PLUGIN_ROOT}/workflows/ship-feature-review.js`.
2. **`args` arrive JSON-stringified.** The workflow parses-if-string before use; if you
   author your own, do the same. As a thread-check, confirm the returned `target` echoes
   the `rangeDesc` you passed — a silent fallback to the default target means `args` didn't
   thread (usually a too-large/quote-heavy payload).

## Read-only-first (and how to expand safely)
The bundled workflow drives **only** the read-only agents (`security-reviewer`, `testing`).
It never invokes `dev`, `db-migration`, or `deploy`. Expanding it to drive mutating agents
(fix → migrate → deploy) is a documented TODO in the workflow script and **requires an
explicit human-confirmation gate before each mutating step** — especially any prod deploy
or destructive DB op. Keep mutating phases in separate, explicitly-gated workflows rather
than one auto-running chain.

## Capture-learnings (the achievable self-improvement loop)
This is the practical mimic of a self-learning agent — **experiential memory + reusable
skills, not weight updates.**
- **`/retro`** — after a run or on demand, the `docs` agent reflects on what was learned
  (new gotchas, recurring fixes, process tweaks) and **proposes** updates to CLAUDE.md, a
  memory file, or a new skill. It never writes learnings silently.
- **Skill-capture convention** — when a workflow or procedure has been solved **more than
  once**, promote it to a reusable skill under `.claude/skills/` (use a skill-creator if
  available). Repeated work graduates into a loadable recipe instead of being re-derived.

### Guardrail (by design)
Learnings capture is **human-reviewed**. A wrong "lesson" written unsupervised becomes
load-bearing misinformation that every future session trusts. We deliberately trade
autonomy for memory quality: propose-then-approve, always. The two gotchas above were
captured exactly this way — surfaced from a real failure, reviewed, then written down.

## What stays project-specific
The portable agents intentionally contain **no** account IDs, slugs, table names, or
package-filter names. Those live in your CLAUDE.md. That's what makes the same `dev`/
`testing`/`docs` work across projects — and why the security/db/deploy agents are templates
you refit rather than drop-in portables.

---
*This plugin's permanent home is its own repo (github.com/Zax1976/agent-framework). It is
staged inside another project only for the initial build; push it to its own repo before
installing into a second project so that project doesn't depend on the originating repo.*
