# Build brief — CKA study site (revision 2)

The prompt that produced this repository, rewritten after the fact.

Revision 1 built the site in roughly 50 minutes of active work. About 11 of those minutes were spent on CI and
deployment problems that surfaced *after* all the content was written, and a further ~14 on a generator migration that
a single up-front decision would have avoided. This revision folds those lessons back in: the decisions that had to be
asked about are now stated, the environment constraints that had to be discovered are now given, and the order of work
is now prescribed so that the expensive failures happen while they are still cheap.

The [changelog](#changelog--what-revision-1-got-wrong) at the bottom maps each change to the specific thing it prevents.

**To use:** paste everything between the two horizontal rules below.

---

## 0. Decisions already made — do not ask about these

| | |
|---|---|
| **Hosting** | GitHub Pages, deployed by GitHub Actions |
| **Domain** | `cka.metacog.co.kr`, DNS already configured. The site is served from the domain root, so there is **no path prefix** — one build serves both testing and deployment |
| **Generator** | **Hugo**. Not negotiable, and not a coin flip: it is chosen for its native `data/` directory, custom output formats, and module mounts, all three of which this design uses |
| **Branch** | Commit and push to `main`. If your session designates a feature branch, note the conflict in one sentence and proceed on `main` |
| **Language** | English content and UI |
| **Sources of truth** | Prose is markdown under `content/`; drill items are JSON under `data/`. Never let a fact live in both |

If something else is genuinely ambiguous, make the call, state the assumption in your final report, and keep building.
Do not stop and wait for an answer unless proceeding either way would waste the work.

## 1. Order of work — this ordering is the point

1. **Walking skeleton, before any content.** `hugo.toml`, one placeholder page, `static/CNAME`, the Actions workflow,
   and a **green deploy you have actually watched finish**. Content is cheap to redo; a broken pipeline discovered at
   the end is not.
2. **Probe the network** (§2) and record what is reachable before planning any research that depends on it.
3. Research → 4. Content → 5. Drill data → 6. Study tools → 7. PDF → 8. Final verification.

Commit at each numbered step. Push early and often, so CI failures arrive one at a time rather than in a cluster at the
end.

## 2. Environment constraints — verified, do not rediscover them

**Egress is restricted.** Reachable: `github.com`, `raw.githubusercontent.com`, `registry.npmjs.org`,
`proxy.golang.org`, and the web-search tool. Blocked: `training.linuxfoundation.org`, `docs.linuxfoundation.org`,
`kubernetes.io`, `medium.com`, `dev.to`, `killer.sh`, `sailor.sh`, `kodekloud.com`, `spectrocloud.com` — **and the
deployed site itself**, so you will not be able to load your own output. Blocks are policy denials: report them, do not
retry or route around them.

**Toolchain.** No pandoc, no LaTeX. `apt-get install poppler-utils` 404s, and `pypdf` fails to import (broken
`cryptography` binding). To *read* a PDF use `pdfjs-dist` from npm; to *write* one use headless Chromium. Chromium is
preinstalled under `$PLAYWRIGHT_BROWSERS_PATH`, but its build number may not match the npm `playwright` package — never
call `chromium.launch()` bare, resolve the executable path first and fall back to Playwright's own default so the same
code works in CI.

**Hugo is not installed**, and its GitHub release downloads are blocked here (they work fine inside Actions).
`go install github.com/gohugoio/hugo@vX.Y.Z` works because `proxy.golang.org` is reachable directly. It takes about
four minutes and one module download may time out — retry it, and start it in the background so you can write layouts
while it compiles.

## 3. Research — do this before writing a single line of content

- Fetch the **current** CKA curriculum from the CNCF repo (`cncf/curriculum`) and extract the PDF's text. Do not rely
  on memory: the domains and weights were revised and may have changed again.
- Record the exact domain list and percentage weights in `docs/curriculum.md`, with source URLs and the date fetched.
  Transcribe the competency bullets **verbatim**, and note any typo in the source rather than silently correcting it.
- Gather publicly shared pass/fail retrospectives (blogs, Reddit, forum threads, Killer.sh feedback). Extract recurring
  themes — what people ran out of time on, what they underestimated, what they wish they had drilled — into
  `docs/retrospectives.md`.
- **Disclose sourcing per URL.** Most of the interesting write-ups are on blocked hosts and will only be readable
  through search-result summaries. That is acceptable; presenting it as a direct read is not. Label every source as
  fetched-directly or read-via-summary, and say plainly which claims that weakens.
- Anything you cannot verify at the primary source — exam duration, pass mark, permitted documentation — must be marked
  as community-reported in the file itself, not just mentioned in chat.

## 4. Content principle: reasoning flow, not topic lists

The exam is performance-based, so organise around decision paths, not a table of contents. For each major area:

- A diagnostic decision tree, entered from a **symptom** ("Pod is Pending → check events → node capacity? taints? PVC
  unbound? scheduler down?").
- The minimal command sequence for each branch, with the imperative `kubectl` form preferred over YAML authoring.
- A "why it works" one-liner under each command.

Seed real content for **all five domains**, going deepest on the two highest-weighted. Empty scaffolding is not a
deliverable.

## 5. Study tools — client-side, no framework

- **Practice tasks**: scenario-based, timed against a target derived from the real budget, each with a named cluster
  context, a model solution with reasoning per step, and a verification command.
- **Cloze**: hide flags, field names and paths inside real manifests and commands. Mark blanks with a delimiter that
  cannot collide with template syntax — `[[like this]]`, never `{{ }}`.
- **Mnemonics**: for what must be recalled cold — field ordering, the `kubeadm` upgrade sequence, RBAC verbs.
- **Affordances**: render a keyboard shortcut as a key cap (`<kbd>`), never as `Label (1)` — that reads as a counter.
  Where a control has a consequence the user cannot infer, put it on the control: a grade button should say when the
  item returns, not just what the grade is called.
- **Flashcards** driven by the spaced-repetition scheduler.

Render the mnemonics *page* from the JSON rather than writing a second markdown copy. One source, two outputs.

## 6. Spaced repetition and progress

- SM-2 scheduler: ease factor, interval, repetition count, ease floored at 1.3.
- Per-domain mastery and time spent, on a dashboard that surfaces weak areas first — rank by *exam risk*, meaning
  curriculum weight multiplied by distance from mastery, so a weak heavyweight domain outranks a weak lightweight one.
- Persist in `localStorage` under one versioned key, with JSON export/import. No backend, no accounts.
- Study-plan view: target exam date → daily workload derived from what is due and what has never been seen, reserving
  the last few days for review only.

## 7. Pattern analysis, not exam dumps

**The CKA is under NDA. Do not scrape, reproduce, or approximate real exam questions.** Infer high-yield task patterns
from the published curriculum weights plus community retrospectives, and write **original** practice tasks in that
shape. State this policy in the README and on the site's home page.

## 8. Consolidated reference PDF

Generate one dense, printable reference from the site's own markdown and JSON — cheat sheet, decision trees, mnemonics,
and the `kubectl` flags worth memorising. A build script regenerates it; it is never hand-edited. Render it through
headless Chromium (see §2), which also guarantees it inherits the same markdown rendering as the site.

## 9. Delivery — known failure modes, pre-empted

- **Job needs `timeout-minutes`.** Without it a hung step burns the default six hours.
- **Do not use `playwright install --with-deps`** on `ubuntu-latest`. The runner already ships those libraries, and the
  apt step it adds hangs. Use `npx --yes playwright install chromium` — `--yes` so npx cannot block on a prompt.
- **GitHub Pages must be enabled by hand** by the repository owner (*Settings → Pages → Source: GitHub Actions*) before
  the first deploy can succeed. `actions/configure-pages` has an `enablement: true` option; it fails with
  `Resource not accessible by integration` because `GITHUB_TOKEN` may not create a Pages site. Do not spend a
  round-trip trying. Ask the owner, and note in the README that this step is manual.
- `static/CNAME` holds the custom domain; Hugo copies it into `public/` and that is what points Pages at it.
- Pin the Hugo version in the workflow and download the release `.deb` with `curl -f`, so a bad URL fails there instead
  of handing `dpkg` an HTML error page.
- Use `actions/checkout@v5` and `actions/setup-node@v5`.
- Mobile-readable, dark mode, keyboard-driven review sessions.

## 10. Verification — required, and "the build passed" is not it

- A data validation script: unique ids, known domains, balanced cloze delimiters, every task carrying both a model
  solution and a verification command. Run it in CI.
- A browser smoke test that drives every interactive tool — grade a card and confirm the scheduler state persisted,
  reveal a cloze, run a task timer, check the dashboard ordering, round-trip export/import — and **fails on any console
  error**. Run it in CI too.
- A structural audit of the rendered output, not the source: every page has exactly one `h1`, no internal link points
  at a page that does not exist, and markdown inside raw HTML blocks actually rendered. That last one fails silently —
  a `<div>` with no blank line after it swallows the markdown inside and the build still succeeds.
- Check rendered HTML after any templating change. A migration that "builds fine" can still drop every heading.

## 11. Commit and report

Commit in logical steps with messages that say *why*, not just what. Push to `main`.

In the final report, separate what you verified from what you did not. You cannot load the deployed site from this
environment, so "CI deployed successfully" is a claim you can make and "the page renders correctly at that URL" is not.
Say which is which.

---

## Changelog — what revision 1 got wrong

| # | What happened | Cost | Change in this revision |
|---|---|---|---|
| 1 | Brief said "push to `main`" while the session designated a feature branch | one blocking question | §0 states the branch policy and how to resolve the conflict |
| 2 | "Static site generator of your choice" → picked Eleventy → asked to switch to Hugo | ~14 min migration | §0 names Hugo and says why |
| 3 | Custom domain arrived after the build, so a two-build path-prefix scheme was written and then deleted | wasted complexity + CI restructure | §0 gives the domain up front and notes there is no path prefix |
| 4 | Content language was unspecified | one blocking question | §0 states it |
| 5 | CI, Pages permissions and a hung install all surfaced *after* the content was done | ~11 of ~50 min | §1 requires a green deploy before any content |
| 6 | `playwright install --with-deps` hung for 9+ minutes on the first run | ~9 min | §9 forbids it, §9 requires `timeout-minutes` |
| 7 | Tried `enablement: true` to self-enable Pages; `GITHUB_TOKEN` is not permitted | one failed run | §9 says it cannot work and to ask the owner |
| 8 | Blocked hosts discovered one at a time (LF, Medium, dev.to, Killer.sh, kubernetes.io) | scattered dead ends | §2 lists them, §3 sets the disclosure rule that follows |
| 9 | PDF text extraction: `pypdf` import broke, `poppler-utils` 404'd, settled on `pdfjs-dist` | several detours | §2 gives the working tools directly |
| 10 | `kubectl jsonpath` braces collide with template syntax in markdown | latent build hazard | §5 mandates a non-colliding cloze delimiter; Hugo avoids the wider problem |
| 11 | Callout `<div>`s swallowed their markdown — no blank line after the opening tag — and the build still passed | caught only by reading output | §10 names it as a silent failure to check for |
| 12 | Two internal links pointed at pages that never existed, surviving the whole first build | shipped broken | §10 requires a link check |
| 13 | Migration silently dropped the `h1` from all six tool pages | caught by audit | §10 requires the structural audit after templating changes |
| 14 | Grade buttons rendered their keyboard shortcut as `Again (1)`, which reads as a counter — a user clicked them and asked why the number never went up | shipped confusing | §5 requires shortcuts rendered as key caps and controls labelled with their consequence, not just their name |

### What revision 1 got right, and this revision keeps unchanged

The content principle (§4), the NDA policy (§7), the SM-2 design (§6) and the PDF-from-source requirement (§8) all
worked as written and needed no revision. The failures were concentrated in **unstated decisions** and **unstated
environment**, not in the description of the product.
