---
title: Exam Bookmarks
script: bookmarks
weight: 2
summary: 79 exam-legal documentation links, ordered by domain weight and walked in exam order — and an honest note about whether you can take them into the exam at all.
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

Seventy-nine links, weighted the way the exam is: Troubleshooting and Cluster Architecture go deepest, Storage
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

## The same set, in exam order

The folders below sort by domain weight, which is the right order for a bookmarks bar. The exam does not run in that
order: it runs [one loop](/reference/exam-strategy/#per-task-in-this-order), about seventeen times, with two set pieces
inside it. This is which pages belong to which step. Every link filters the list below to the row it means — that is the
lookup you will do in the exam, minus the bookmark.

**Minute 0–2 · before task 1.** Aliases, completion, `$do`, `.vimrc`. Open the [kubectl quick reference](?q=quick-reference)
in the docs tab — the alias block is at the top — and leave it there. Nothing else yet.

**Step 1 · `use-context`, then `current-context`.** No page. If the task hands you a kubeconfig to repair instead of a
context to switch to: [kubeconfig — contexts and users](?q=set-context).

**Step 2 · read the task twice.** No page. Decide which of three shapes it is: *generate* (kubectl can produce it),
*copy* (a spec block with no generator), or *recipe* (etcd, kubeadm). Note the namespace.

**Step 3 · generate, don't author.** [kubectl create — subcommands](?q=create+subcommands) settles whether a generator
exists. For field names, `kubectl explain --recursive` first; the [API reference](?q=object+fields) only when that
fails. When there is no generator, these are the blocks you copy and cut down, by kind:

| The task says | Copy from |
|---|---|
| NetworkPolicy, "deny all except…" | [the resource](?q=networkpolicy+resource) · [default deny](?q=default+deny) |
| Ingress path rules · Gateway / HTTPRoute | [Ingress resource](?q=pathtype) · [Gateway API guides](?q=gateway+guides) |
| PV / PVC / StorageClass | [PV/PVC YAML](?q=pv+pvc+yaml) · [StorageClass](?q=reclaimpolicy) |
| probes · requests and limits · ConfigMap/Secret into a Pod | [probes](?q=probes) · [requests and limits](?q=units+for+cpu) · [ConfigMap into a Pod](?q=configmap+pod) |
| taint/toleration · affinity · PDB | [tolerations](?q=taints) · [node affinity](?q=required+preferred) · [PodDisruptionBudget](?q=pdb) |
| Role/RoleBinding · "create a user" | [RBAC YAML](?q=rbac+yaml) · [CSR](?q=certificatesigningrequest) |
| Helm install/upgrade · Kustomize | [helm install](?q=create-namespace) · [Kustomize](?q=kustomize) |

**Step 4 · apply. Step 5 · verify the end state.** The [verification table](/reference/exam-strategy/#step-5-is-what-converts-work-into-points)
is the checklist, and it needs no page. When the check fails, two pages explain the two most common failures faster than
thinking does: [Service has no endpoints](?q=no+endpoints) and [PVC Pending](?q=pvc+pending).

**Minute 3 with no traction · flag and skip.** One `describe … | sed -n '/Events/,$p'` before you leave; if Events is
empty, go. When you come back, walk the troubleshooting folder top to bottom — it is arranged in diagnosis order:
[cluster](?q=cluster+broken) → [node](?q=node+status) → [Pod](?q=application+not+running) →
[Service](?q=no+endpoints) → [DNS](?q=dns+resolution). `crictl` and `journalctl` are the two things you reach for when
`kubectl` itself is the casualty: [crictl](?q=crictl) · [system logs](?q=system+component+logs).

**The two set pieces · do them fresh, not at minute 100.** These are the only pages worth opening *before* you type
anything: [etcd backup](?q=etcd+back) · [etcd restore](?q=etcd+restore) · [kubeadm upgrade — control plane](?q=unhold) ·
[kubeadm upgrade — workers](?q=upgrade+worker) · [drain](?q=delete-emptydir). Both recipes are all-or-nothing; a half-finished
upgrade is worth the same as an untouched one.

**Minute 110–120 · no new tasks.** Re-run the verification `get` on everything you marked done — Running, Bound, Ready,
endpoints non-empty, `auth can-i` → yes. Nothing to look up. This is the ten minutes that most often turns a 64 into a 70.

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
