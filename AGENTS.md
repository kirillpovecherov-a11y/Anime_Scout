# Codex quality gate (lightweight)

Apply this protocol to every coding task in this repository. Do not spawn a second agent or start background work just to review a task.

## Before editing (preflight, concise)
1. Restate the objective and acceptance criteria in 1–3 sentences.
2. Inspect only relevant existing files and tests. Identify the smallest safe change; do not assume paths or APIs exist.
3. Check security/privacy, credentials, compatibility, and risk to existing functionality. Ask the user only if a missing decision blocks safe progress.
4. If the request is unsafe, contradictory, or missing essential information, stop and explain; otherwise proceed without waiting for approval at each step.

## During implementation
- Prefer focused diffs. Preserve working features, existing user data, and public interfaces.
- Never embed API keys or tokens; never add paid services or download third-party media without explicit authorization.
- Do not edit main directly; work on a task branch and create a PR.
- Do not run unrelated tests, expensive full scans, or repeated network calls without a reason.

## Before reporting completion (postflight)
1. Inspect the actual diff for unintended edits, broken paths, and secrets.
2. Run the smallest relevant available tests and syntax checks. Do not claim tests passed if not run.
3. Verify the acceptance criteria; distinguish confirmed behavior from untested browser/network behavior.
4. Report briefly: changed files, tests (pass/fail/not run), limitations, and PR URL.

## Cost control
- One Codex task at a time by default; no automatic reviewer subagents.
- Use existing test commands rather than adding a new AI-based review service.
- Keep analysis and output short unless an issue warrants deeper investigation.
