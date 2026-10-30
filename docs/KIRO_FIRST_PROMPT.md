# First Kiro prompt

Open the project folder in Kiro. Start a native **Feature Spec**, using **Requirements-First**, named `tapeghost-mvp`. Paste the following prompt. Follow the native requirements/design review stages; do not bypass them by marking tasks complete.

```text
You are the primary implementation agent for TapeGhost, a browser-only project
for Kiroween 2026, Resurrection category. Tagline: Bring forgotten data back to life.

Read SKILL.md and docs/PROJECT_PLAN.md in this workspace first. They are initial
planning documents authored by another assistant, not evidence of Kiro usage.
Explain decisions to me in Romanian. Write all repository artifacts in English.

Use your native Feature Spec workflow, Requirements-First, for tapeghost-mvp.
The first milestone is repository preparation and an actionable specification,
not application implementation. Inspect existing files and preserve them.

1. Report the installed Kiro version/surface if observable, plus Node/npm and
   repository status. If a version cannot be observed, mark it unknown.
   Verify the official rules and FAQ linked in the plan before implementation.
   Flag material changes; do not silently replace the project scope.

2. Create .kiro/specs/tapeghost-mvp/requirements.md with user stories and testable
   acceptance criteria derived from the plan. Include the 1024-byte payload cap,
   UTF-8 and binary handling, empty inputs, supported WAV profile, exact recovery,
   independent historical signal checks, malformed/corrupted input behavior,
   accessibility, and measurable performance targets. Distinguish MVP from
   optional physical tape/noise/speed-variation support.

3. Follow the native review flow to produce design.md and tasks.md. Keep the DSP
   independent of React/browser APIs. Specify every envelope field, CRC parameter,
   byte order, audio parameter, synchronization rule, error category, and resource
   limit. Check the proposed calculations. Separate KCS-derived signaling from
   our modern envelope; do not promise arbitrary vintage-tape compatibility.
   Explain any material architectural alternative before adopting it.

4. Create and maintain .kiro/steering/product.md, tech.md, structure.md,
   dsp-correctness.md, testing.md, and accessibility.md. Cover conventions,
   performance, evidence honesty, and the rule that round-trip correctness gates
   decorative work. Use inclusion mechanisms supported by this Kiro version.

5. Break implementation into the M1–M5 gates from the plan. Each task needs
   acceptance criteria and a verification command or explicit manual check.
   Include independent vectors/fixtures as well as round-trip tests. Use seeded
   property tests selectively. Leave all unexecuted implementation tasks unchecked.

6. Plan two economical hooks: targeted DSP tests after supported DSP file-change
   events, and quality checks at a supported task boundary. Verify the current
   hook schema for this installed version. Do not enable commands before the
   scaffold provides them. Include a task that proves each hook actually fires;
   distinguish that evidence from running its command manually.

7. Create docs/KIRO_USAGE.md with an accurate first-session entry. Record only
   what you actually did, including commands and observed outcomes. Update the
   progress section of SKILL.md accordingly. Keep private enrollment evidence
   and credentials outside the public repository.

8. If there is no Git repository, initialize one without overwriting an existing
   repository. Keep .kiro tracked and ensure it is not ignored. If permissions
   prevent initialization, report the precise blocker. Do not publish or push.

Do not implement the DSP or polished UI in this first session. Present the native
requirements/design review checkpoints and finish with the first implementation
task ready to run after architecture approval. Report created files, unresolved
decisions, performed checks, and the estimated human effort for the next step.
```

## Expected outcome and verification

- Native spec files exist under `.kiro/specs/tapeghost-mvp/` after the review stages, with requirements mapped to executable tasks.
- Six steering documents and an honest `docs/KIRO_USAGE.md` exist. `SKILL.md` reflects observed progress.
- The proposed audio/envelope contract is explicit, including historical limitations and resource bounds.
- Hook configuration is planned for the installed version; execution is not claimed before testing it.
- Git initialization is either verified or reported blocked; no remote publication occurs.
- No application feature is reported as implemented or tested during this specification-only milestone.

Estimated owner involvement: 20–30 minutes for the native spec review, excluding setup and agent runtime. The next Kiro session implements M1 after the architecture decision.
