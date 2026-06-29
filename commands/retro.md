---
description: Capture-learnings retro — have the docs agent reflect on what was learned (new gotchas, recurring fixes, process tweaks) and PROPOSE updates to CLAUDE.md / a memory file / a new skill. Propose-then-approve only; never writes learnings silently.
argument-hint: "[optional: what to reflect on — defaults to the current session/run]"
---

You are running a capture-learnings retro. Reflect on the recent work (the current session,
or **$ARGUMENTS** if specified) and surface durable learnings worth persisting — then
PROPOSE how to record them. You do NOT write anything in this step.

## What counts as a learning (be selective)
- A new gotcha or failure mode and its fix (e.g. "args arrive JSON-stringified —
  parse-if-string in the workflow").
- A recurring fix or pattern that showed up more than once.
- A process tweak that worked, or a step that wasted time and should change.
- A non-obvious project fact not already in CLAUDE.md.
Skip: one-off trivia, anything already documented, and anything you can't confirm happened.

## Steps
1. Review the recent work and extract candidate learnings. For each, note the EVIDENCE
   (what happened that proves it) — a learning without evidence is a guess, and a wrong
   lesson poisons every future session that trusts it.
2. For each candidate, propose the right home and the exact edit:
   - **CLAUDE.md** — durable project facts/rules future sessions must read.
   - **a memory file** — cross-session preferences (if the project uses one).
   - **a new skill** (`.claude/skills/`) — when a procedure has now been solved more than
     once and should graduate into a loadable recipe (see the README's skill-capture
     convention; use a skill-creator if one is available).
3. Hand the proposals to the `docs` agent to format as concrete diffs (old text → new
   text), but DO NOT apply them. Present the proposals to the user for approval.

## Guardrail (non-negotiable)
Learnings capture is **propose-then-approve**. Never write a learning silently. A wrong
"lesson" written unsupervised becomes load-bearing misinformation that every future session
trusts. The human reviews before anything lands — autonomy is deliberately traded for
memory quality.

End by listing the proposed learnings, each with: the evidence, the target file, and the
exact proposed edit — awaiting the user's approval to apply.
