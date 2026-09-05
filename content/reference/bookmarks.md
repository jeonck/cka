---
title: Exam Bookmarks
script: bookmarks
weight: 2
summary: 77 exam-legal documentation links, ordered by domain weight — and an honest note about whether you can take them into the exam at all.
---

# Exam bookmarks

<p><a class="btn" href="/cka-bookmarks.html" download="cka-bookmarks.html">Download cka-bookmarks.html</a>
<span class="small muted">Import in Chrome: <code>chrome://bookmarks</code> → ⋮ → Import bookmarks from HTML file.
Firefox: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> → Import and Backup → Import Bookmarks from HTML.</span></p>

## Read this before you plan around bookmarks

Since the exam moved to the PSI Bridge secure browser, the terminal is a **remote desktop** whose browser is
provisioned fresh for every candidate. Personal bookmarks do not travel into it, and neither do extensions —
by design, so that no candidate starts with an advantage. PSI adds its own documentation quick links instead.

So treat this set as three things, in order of how much it is worth:

1. **A drill.** Work through the practice tasks with only these pages open. What you are actually training is
   *which page answers which symptom* — knowledge that survives into an exam where you must find the page by
   searching, not by clicking a bookmark.
2. **A simulator kit.** The [Killer.sh](https://killer.sh/) sessions run in your own browser, where the
   bookmarks work exactly as imported. That is where the bar folder earns its keep.
3. **A URL memory aid.** In the exam you can still type a path or use the docs' own search box. The paths worth
   knowing cold are in *0 · First 60 seconds* and the two etcd links — everything else you can find by search.

Check the rules yourself before exam day: the allowed-resources list is revised with the curriculum, and this
page is a snapshot, not an authority.

## What is in the set, and why it is short

Seventy-seven links, weighted the way the exam is: Troubleshooting and Cluster Architecture go deepest, Storage
gets seven. Nothing here is a page you could reproduce from `kubectl explain` in less time than the page takes
to load — that is the entire selection rule. Deep links land on the anchor with the YAML on it rather than at
the top of a long page.

The folder names sort in order, so the bar reads left to right the way you should reach for them.

**Search it the way the exam asks.** Type the symptom, not the page name — `PVC pending`, `no endpoints`,
`rollback`, `snapshot`. Terms narrow: `network policy deny` matches only rows carrying all three. That is the drill
in miniature, and the one thing you can practise here that survives into an exam where the bookmarks do not.
<kbd>/</kbd> focuses the box, <kbd>Esc</kbd> clears it, and the query stays in the URL so a filtered view can be
shared or reopened. The rule across the site: <kbd>/</kbd> searches what you are looking at,
<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> searches everything.

{{< bookmarks >}}

## The pages deliberately left out

- **Anything `kubectl explain` answers.** `kubectl explain pod.spec.containers.resources --recursive` beats a
  page load, and it matches the cluster's own version.
- **Concept pages you would read, not copy from.** In a 7-minute task you do not read.
- **`raw.githubusercontent.com` example manifests.** Widely shared in older bookmark sets, and *not* on the
  allowed list — `github.com/kubernetes/` is, that host is not. Not worth the risk.
- **`kubernetes.io/search/`.** The docs' in-page search box is the sanctioned way to search; the standalone
  search path sits outside the `/docs/` prefix the rules name, so it is not bookmarked here.

<p class="small muted">Generated from <code>data/bookmarks.json</code>, which also produces the downloadable
file — one source, two outputs. <code>npm run check</code> fails the build if any URL falls outside the
allowed list.</p>
