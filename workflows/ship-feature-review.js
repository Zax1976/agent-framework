export const meta = {
  name: 'ship-feature-review',
  description: 'Read-only review of a branch diff: fan out the security-reviewer + testing agents in parallel and return one combined report. Drives READ-ONLY agents ONLY.',
  phases: [
    { title: 'Review', detail: 'security-reviewer + testing run in parallel on the diff' },
  ],
}

// ============================================================================
// READ-ONLY SCOPE — DO NOT REMOVE WITHOUT ADDING HUMAN-CONFIRMATION GATES.
//
// This workflow drives ONLY read-only agents: `security-reviewer` (Read/Grep/Glob)
// and `testing` (runs suites/typecheck, edits test files only — never production
// source). It NEVER invokes `dev`, `db-migration`, or `deploy`.
//
// TODO (future expansion): if this workflow is ever extended to drive MUTATING agents
// (e.g. `dev` to fix findings, `db-migration` to apply a migration, `deploy` to
// release), each mutating step MUST be preceded by an EXPLICIT HUMAN-CONFIRMATION GATE.
// The workflow cannot prompt interactively, so the orchestrating session must pause and
// obtain the user's confirmation before any mutating agent runs (especially a prod
// deploy or destructive DB op). Keep read-only and mutating phases in separate,
// explicitly-gated workflows rather than one auto-running chain.
// ============================================================================

// GOTCHA: `args` arrive at the workflow JSON-STRINGIFIED in this harness, not as an
// object — parse-if-string before use, or the whole payload silently falls back to
// defaults. The /ship-feature entry point also confirms the returned `target` echoes
// the passed rangeDesc as a thread-check.
let a = args
if (typeof a === 'string') {
  try { a = JSON.parse(a) } catch { a = {} }
}
if (!a || typeof a !== 'object') a = {}

const rangeDesc = (typeof a.rangeDesc === 'string' && a.rangeDesc.trim()) ? a.rangeDesc.trim() : 'current branch vs main'
const changedFiles = (typeof a.changedFiles === 'string' && a.changedFiles.trim()) ? a.changedFiles.trim() : '(changed-file list not provided)'
const diffStat = (typeof a.diffStat === 'string') ? a.diffStat : ''

log(`Read-only review fan-out — target: ${rangeDesc}`)
phase('Review')

const securityPrompt = [
  `Audit a branch diff for security and correctness defects in THIS project.`,
  ``,
  `Review target: ${rangeDesc}`,
  `Changed files:`,
  changedFiles,
  ``,
  `Read the project's CLAUDE.md and any decision records (ADRs), then read the changed files in full and audit them against THIS project's documented failure modes and security rules — whatever CLAUDE.md flags as load-bearing (e.g. access-control / tenant isolation, how trusted identity must flow, privileged-client traps, secret handling, input-validation bounds, billing/payment discipline). Do not assume another project's rules; use this one's.`,
  ``,
  `Produce your standard findings report: Summary verdict (pass / pass-with-nits / changes-required); Findings as "severity · file:line · rule · why it's exploitable · suggested direction (prose, not a patch)"; and Checklist coverage noting blind spots. You are READ-ONLY — report only, never a patch.`,
  diffStat ? `\nDiff stat (focus hint — Read each changed file's full final state for the actual review, don't rely on the stat):\n\n${diffStat}` : ``,
].join('\n')

const testingPrompt = [
  `Verify a branch change for THIS project. This is a read-only review run.`,
  ``,
  `Read the project's CLAUDE.md / package scripts for the exact test + typecheck (+ lint) commands and run them against the working tree. If CLAUDE.md names a MANDATORY re-run after certain changes and the changed files trigger it, run that too.`,
  ``,
  `Changed files for context (decide which suites are most relevant, but still run the full suite + typecheck):`,
  changedFiles,
  ``,
  `Report: the exact commands you ran, pass/fail counts per suite, typecheck status, and a green/red verdict. Distinguish intentional structured-log stderr from real assertion failures. Do NOT edit production source, and for this review run do NOT add new tests either — just run and report. If something is red, name the failing test, the assertion, and the suspected source location.`,
].join('\n')

const [security, testing] = await parallel([
  () => agent(securityPrompt, { label: 'security-reviewer', phase: 'Review', agentType: 'security-reviewer' }),
  () => agent(testingPrompt, { label: 'testing', phase: 'Review', agentType: 'testing' }),
])

return {
  target: rangeDesc,
  security: security ?? '(security-reviewer produced no output — is the agent created from the template and active?)',
  testing: testing ?? '(testing produced no output — agent may have been skipped or errored)',
}
