# CKA study site

A static study site for the **Certified Kubernetes Administrator** exam, built around the idea that a performance-based
exam is passed by drilling *decisions* under a clock, not by reading a topic list.

Live site: `https://<owner>.github.io/cka/` · one-book reference PDF at `/cka-reference.pdf`

---

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

**[Eleventy](https://www.11ty.dev/) as the generator.** The requirement was plain markdown as the source of truth plus a
handful of bespoke, stateful UI components. Eleventy renders markdown with almost no ceremony and imposes no client-side
framework, so the study tools are plain ES modules that ship as written. A docs-oriented framework (MkDocs Material,
Docusaurus, Starlight) would have given nicer navigation for free but would have made the interactive tools an
awkward add-on; a full app framework would have made the markdown an awkward add-on. Eleventy sits where this project
actually lives.

Two configuration decisions worth knowing about:

- **Nunjucks is disabled inside markdown** (`markdownTemplateEngine: false`). The content is full of `kubectl jsonpath`
  and JSON patch arguments; leaving a template engine switched on means `'{"spec":{"replicas":4}}'` is one bad day away
  from a build error. URL prefixing is handled by Eleventy's `HtmlBasePlugin` instead, which rewrites the output HTML.
- **`data/*.json` is the source of truth for drill items**, and `content/**/*.md` for prose. The mnemonics *page* is
  rendered from the JSON rather than duplicated as markdown, so the site and the PDF cannot drift apart.

**No client-side framework, no backend, no accounts.** All progress is in `localStorage` under one versioned key, with
JSON export/import so it survives a cleared cache or a move between machines.

**Headless Chromium for the PDF**, not LaTeX or pandoc. The PDF is rendered from the same markdown-it output as the
site, so the two can't disagree, and it builds on a clean CI runner with no document toolchain to install.

---

## Running it

```bash
npm install
npm run build        # site        -> dist/
npm run serve        # dev server with live reload
npm run build:pdf    # PDF         -> dist/cka-reference.pdf
npm run build:all    # both
npm run check        # validate the drill data
npm run test:smoke   # drive every study tool in headless Chromium
```

`npm run test:smoke` expects a root-path build (`npm run build` with no `PATH_PREFIX`) in `dist/`.

### Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: validate data → build → smoke-test → rebuild with the Pages
path prefix → regenerate the PDF → deploy.

The workflow passes `enablement: true` to `actions/configure-pages`, so it turns Pages on and sets the source to
GitHub Actions by itself. If your organisation restricts that, do it by hand in *Settings → Pages* (**Source** →
**GitHub Actions**) — without it the build succeeds and the deploy step fails with `Get Pages site failed`.

The workflow sets `PATH_PREFIX=/<repo-name>/` because a GitHub *project* page is served from a subdirectory. On a user
page (`<owner>.github.io`) or a custom domain, drop that `env:` block.

---

## Layout

```
content/
  domains/*.md          the five domain pages — decision trees, prose source of truth
  reference/*.md        command cheat sheet, exam strategy
docs/
  curriculum.md         CNCF curriculum v1.35, verbatim, with source URLs and fetch date
  retrospectives.md     community themes, with sources and a sourcing caveat
data/
  flashcards.json       drill items — source of truth for the tools AND the PDF
  cloze.json            [[blanks]] marked inline
  tasks.json            timed scenarios: solution steps, verification, gotcha
  mnemonics.json        renders both the site page and the PDF chapter
site/
  _includes/*.njk       layouts
  _data/*.js            global data; drills.js reads data/*.json
  pages/*.njk           tool pages + /api/items.json
  assets/js/            srs.js store.js review.js practice.js dashboard.js plan.js datatool.js
scripts/
  build-pdf.mjs         markdown + JSON -> Chromium -> dist/cka-reference.pdf
  check-data.mjs        data validation
  smoke.mjs             end-to-end browser test
```

### Adding content

- **Prose** — drop a markdown file in `content/domains/` or `content/reference/`. Front matter needs `title`, and for a
  domain also `domain`, `weight`, `order`, `summary`. Permalinks come from the directory data files.
- **Drill items** — append to the relevant `data/*.json`. `npm run check` enforces unique ids, known domains, balanced
  `[[blanks]]`, and that every task has both a model solution and a verification command.
- Nothing needs registering anywhere: the site, the API endpoint and the PDF all read the same files.

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
