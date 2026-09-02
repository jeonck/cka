# CKA study site

A [Hugo](https://gohugo.io/) study site for the **Certified Kubernetes Administrator** exam, built around the idea
that a performance-based exam is passed by drilling *decisions* under a clock, not by reading a topic list.

Live site: **<https://cka.metacog.co.kr/>** · one-book reference PDF at
[`/cka-reference.pdf`](https://cka.metacog.co.kr/cka-reference.pdf)

---

## How this was specified

[`PROMPT.md`](PROMPT.md) is the build brief that produced this repository, revised after the fact. It carries the
decisions that had to be asked about the first time, the environment constraints that had to be discovered, and a
changelog mapping each of the thirteen things the first attempt got wrong to the change that prevents it. It is a
repository document, not a published page.

## Content policy: no exam dumps

**The CKA is under NDA. Nothing in this repository scrapes, reproduces, or approximates real exam questions, and no such
material was consulted while building it.**

Every practice task, flashcard, cloze drill and mnemonic here is **original**, written from two public sources:

1. **The published curriculum** — [`cncf/curriculum`](https://github.com/cncf/curriculum), transcribed verbatim into
   [`docs/curriculum.md`](docs/curriculum.md) with the version, the fetch date, and the source URL.
2. **Community retrospectives** — public blog posts, DEV/Medium write-ups, and forum threads about *preparation and
   process*: what people ran out of time on, what they underestimated, what they wish they had drilled. Synthesised into
   [`docs/retrospectives.md`](docs/retrospectives.md), with every source URL listed and an honest note about which pages
   were fetched directly and which were read through search summaries.

Task *patterns* are inferred from curriculum weight plus recurring community themes. If a pattern is emphasised here, it
is because the curriculum weights it heavily and people repeatedly report underestimating it — not because anyone
reported seeing it on an exam.

---

## What's in it

| | |
|---|---|
| **Decision-tree content** | Five domain pages organised as *symptom → decision tree → minimal command sequence → why it works*. Imperative `kubectl` is preferred over YAML authoring throughout. |
| **Practice tasks** | 17 original timed scenarios (114 target minutes, close to the real exam's shape), each with a named cluster context, a per-step model solution with reasoning, and verification commands. |
| **Cloze drills** | 35 items, 123 blanks, hiding flags, field names and paths inside real manifests and commands. |
| **Flashcards** | 90 cards, weighted toward the heavier domains. |
| **Mnemonics** | 14 memory aids for what must be recalled cold — `kubeadm` upgrade ordering, etcd's mandatory TLS flags, taint effects, the three conditions that make a PVC bind. |
| **SM-2 scheduler** | Ease factor, interval and repetition count per item, driving both the flashcard and cloze queues. |
| **Dashboard** | Per-domain mastery and time spent, sorted by *exam risk* — curriculum weight × distance from mastery — so the weakest high-weight domain always leads. |
| **Study plan** | Target exam date in, daily workload out, with the last three days reserved for review only. |
| **One-book PDF** | 32 dense A4 pages generated from the same markdown and JSON as the site. |

Seeded with real content for all five domains; **Troubleshooting (30%)** and **Cluster Architecture (25%)** — the two
highest-weighted — go deepest, with five decision trees each.

Dark by default with a light toggle, mobile layout, and keyboard-driven review (<kbd>Space</kbd> reveals,
<kbd>1</kbd>–<kbd>4</kbd> grade, <kbd>s</kbd> skips, <kbd>t</kbd> toggles the theme, <kbd>r</kbd> jumps to review).

---

## Tech choices, and why

**[Hugo](https://gohugo.io/) as the generator.** The requirement was plain markdown as the source of truth plus a
handful of bespoke, stateful UI components. Four Hugo features do real work here rather than being incidental:

- **`data/` is a first-class concept.** `data/*.json` is read natively as `hugo.Data`, so the drill items feed the
  templates with no glue code. That is what makes the mnemonics *page* a render of `data/mnemonics.json` rather than a
  second copy of it — the site and the PDF read one source and cannot drift.
- **Custom output formats** generate `/api/items.json` from that same data (`layouts/api/section.items.json`), so the
  endpoint the study tools fetch is a build artefact, not a file anyone maintains.
- **Module mounts** let `docs/` stay at the repository root — the research write-ups were specified to live at
  `docs/curriculum.md` and `docs/retrospectives.md` — while still being published at `/docs/`.
- **Shortcodes** keep the tool pages as markdown while still rendering the domain dropdowns from the domain pages'
  own front matter, so adding a domain updates every selector.

Plus the obvious: a single static binary, no `node_modules` in the render path, and a ~60 ms build.

The alternatives, honestly. A docs-oriented theme (MkDocs Material, Docusaurus, Starlight) gives nicer navigation for
free but makes bespoke stateful tools an awkward add-on; an app framework makes the markdown the awkward part. Hugo's
cost is Go templates, which are less pleasant to write than JS — that is a real trade, paid once in `layouts/`. It buys
nothing for the study tools themselves, which are vanilla ES modules under any generator.

One configuration decision worth knowing about: **Goldmark runs with `unsafe = true`**. The domain pages carry
hand-written `<div class="callout">` blocks, and Goldmark drops raw HTML by default. The content is trusted (it is in
this repository), so this is safe here and would not be on a site that renders submitted markdown.

Node is still a dependency, but only for the PDF build and the browser smoke test — never for rendering the site.

**No client-side framework, no backend, no accounts.** All progress is in `localStorage` under one versioned key, with
JSON export/import so it survives a cleared cache or a move between machines.

**Headless Chromium for the PDF**, not LaTeX or pandoc. The PDF is rendered from the same markdown-it output as the
site, so the two can't disagree, and it builds on a clean CI runner with no document toolchain to install.

---

## Running it

Needs [Hugo](https://gohugo.io/installation/) v0.164.0 or newer on `PATH`, plus Node 22 for the PDF and the tests.

```bash
npm install
npm run build        # site -> public/     (hugo --gc --minify)
npm run serve        # hugo server, live reload
npm run build:pdf    # PDF  -> public/cka-reference.pdf
npm run build:all    # both
npm run check        # validate the drill data
npm run test:smoke   # drive every study tool in headless Chromium
```

`npm run build:pdf` and `npm run test:smoke` both expect `npm run build` to have run first — the PDF is written into
`public/`, and the smoke test serves `public/` over a local HTTP server.

### Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: install Hugo → validate data → build → regenerate the PDF
→ smoke-test → deploy.

**Custom domain.** The site is served from `cka.metacog.co.kr`. `static/CNAME` holds that hostname and Hugo copies it
into `public/`, which is what tells Pages about the domain; DNS is configured separately at the registrar. Because the
site lives at the root of its own domain there is no path prefix, so one build serves both the tests and the deploy —
if you ever move it back to a `github.io/<repo>/` project page, set `baseURL` in `hugo.toml` accordingly.

**One manual step, and it must be done once before the first deploy succeeds:** in *Settings → Pages*, set **Source**
to **GitHub Actions**.

Until then the build, tests and PDF all pass and only the last step fails, with
`Get Pages site failed`. The workflow cannot do this for you — `actions/configure-pages` has an `enablement: true`
option, but `GITHUB_TOKEN` is refused with `Resource not accessible by integration` when it tries to create the Pages
site, so enabling Pages stays an owner action.

---

## Layout

```
hugo.toml               baseURL, Goldmark unsafe, the items output format, docs/ mount
content/
  _index.md             home page prose (the hero lives in layouts/home.html)
  domains/*.md          the five domain pages — decision trees, prose source of truth
  reference/*.md        command cheat sheet, exam strategy
  tools/*.md            the six tool pages; front matter `script:` names the ES module
  api/_index.md         emits /api/items.json via the `items` output format
docs/                   mounted to /docs/ — kept at the repo root by design
  curriculum.md         CNCF curriculum v1.35, verbatim, with source URLs and fetch date
  retrospectives.md     community themes, with sources and a sourcing caveat
data/                   read natively by Hugo AND by scripts/build-pdf.mjs
  flashcards.json       drill items
  cloze.json            [[blanks]] marked inline
  tasks.json            timed scenarios: solution steps, verification, gotcha
  mnemonics.json        renders both the site page and the PDF chapter
layouts/
  baseof.html           chrome; nav is generated from the domain pages
  home.html page.html section.html
  domains/page.html     weight badge + per-domain drill links
  api/section.items.json
  shortcodes/           domain-select, domain-grid, mnemonics
  _markup/render-heading.html
static/
  CNAME                 cka.metacog.co.kr
  assets/css/main.css
  assets/js/            srs.js store.js review.js practice.js dashboard.js plan.js datatool.js
scripts/
  build-pdf.mjs         markdown + JSON -> Chromium -> public/cka-reference.pdf
  check-data.mjs        data validation
  smoke.mjs             end-to-end browser test
```

### Adding content

- **Prose** — drop a markdown file in `content/domains/` or `content/reference/`. Front matter needs `title`, and for a
  domain also `domain`, `examWeight` (the exam percentage), `shortTitle` if the full one is long, `weight` (Hugo's
  ordering key) and `summary`. Nav, the home page weight bar, and every domain dropdown are generated from those, so
  nothing needs registering.
- **Drill items** — append to the relevant `data/*.json`. `npm run check` enforces unique ids, known domains, balanced
  `[[blanks]]`, and that every task has both a model solution and a verification command.
- Nothing needs registering anywhere: the site, `/api/items.json` and the PDF all read the same files.

---

## Known limits

- **Exam logistics** (duration, pass mark, permitted documentation) are marked in `docs/curriculum.md` as
  *community-reported*. `training.linuxfoundation.org` and `docs.linuxfoundation.org` were unreachable from the network
  this was built on, so those numbers were not read from the Linux Foundation directly. The domain list and every
  competency bullet **were** taken from the CNCF PDF itself. Verify logistics against the current Candidate Handbook.
- Several retrospective sources were likewise read through search-engine summaries rather than fetched. Each is labelled
  as such in `docs/retrospectives.md`.
- The curriculum tracks the Kubernetes release cadence. Re-fetch `CKA_Curriculum_v*.pdf` before you book — the 2025
  revision changed the competency list while leaving the domain names and weights identical, which is exactly the kind
  of change stale guides hide.
