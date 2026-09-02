---
title: Community Retrospectives
layout: page.njk
order: 2
---

# What people say went wrong — community retrospectives

**Gathered:** 2026-09-02

This is a synthesis of publicly shared pass/fail write-ups: blog posts, DEV Community articles, Medium retrospectives,
Linux Foundation forum threads, KodeKloud community posts, and vendor prep guides. It contains **no exam content** — see
the [no-dumps policy](/#policy). Everything below is about *preparation and process*, which is what people are free to
talk about and what actually separates a pass from a fail.

**Sourcing caveat, stated plainly:** the network this site was built on blocked direct fetches to `medium.com`,
`dev.to`, `killer.sh`, `sailor.sh`, `kodekloud.com`, `spectrocloud.com` and `training.linuxfoundation.org`. Themes below
were extracted from search-engine summaries of those pages plus directly-fetched GitHub-hosted study repos. Quoted
phrasing is the summary's, not necessarily the author's. Treat individual claims as community consensus signal, not as
verified fact. Source URLs are listed at the bottom so you can read the originals yourself.

---

## Theme 1 — Time is the binding constraint, not knowledge

The single most repeated failure story is not "I didn't know how to do it." It is "I knew how and I ran out of clock."

- **~7 minutes per task.** 120 minutes across ~16–17 tasks. Multiple write-ups converge on "max 7–8 minutes per question,
  and verify before moving on."
- **Perfectionism is the classic second-attempt failure.** One candidate who failed twice reported the cause of the second
  failure as trying to answer every question perfectly; a handful of tasks overran and several were never attempted at all.
- **Flag-and-skip is a skill you have to rehearse.** Repeated advice: if you're stuck ~3 minutes in, flag it and move on;
  anything that looks like it will exceed ~8 minutes gets deferred to a second pass after the easy points are banked.
- **Tasks are not equally weighted**, and the weight is shown. Sorting by points-per-minute at the start is cheap and
  people who did it say it mattered.
- **The environment can be slow.** At least one write-up describes a single task eating ~5 minutes largely to environment
  latency. Budget for it; don't assume your laptop's responsiveness.

**Drill implication:** every practice task on this site is timed, with a target time visible before you start. Practising
untimed is practising the wrong exam.

## Theme 2 — Wrong-cluster errors silently zero out correct work

Described in more than one place as the most costly mistake on the exam.

- Each task names its cluster and hands you the exact `kubectl config use-context <name>` line.
- Solve it on the wrong cluster and you score **zero** — with no signal. Your resource exists, your YAML is right, and
  you will not find out.
- The stated fix is mechanical: run the given context command **as the first action of every task**, then
  `kubectl config current-context` to confirm. Two seconds.

**Drill implication:** context-switch-then-confirm is baked in as step 0 of every model solution here.

## Theme 3 — The post-2025 topics are where prepared people get surprised

Candidates who studied from older guides report the updated exam as "much more challenging and in-depth… especially on
the new topics." Named weak areas, repeatedly:

- **Helm** and **Kustomize** for installing cluster components
- **Gateway API** (as distinct from Ingress — both are examinable)
- **CRDs and operators**
- **Extension interfaces**: CNI, CSI, CRI

If your study material doesn't have chapters on these, it predates the current curriculum and is actively misleading you,
because the *domain names and weights did not change* — only the competencies underneath them did.

## Theme 4 — etcd and kubeadm are free points, or zero points

- etcd backup/restore is described as near-universally tested and as having a **deterministic recipe**: get it right,
  bank ~7–10 points; get it wrong, lose them outright, with little partial credit.
- The most-cited miss: after restoring to a new data directory, **failing to edit
  `/etc/kubernetes/manifests/etcd.yaml`** so the static Pod actually points at the restored `--data-dir` (and its
  hostPath volume). The restore "succeeds" and the cluster still serves the old data.
- Same shape for `kubeadm upgrade`: a fixed sequence with an ordering that must be recalled cold — drain, upgrade the
  binary, `kubeadm upgrade apply`/`node`, upgrade kubelet+kubectl, restart kubelet, uncordon. Skipping the
  `apt-mark unhold`/`hold` bracket or the `kubelet` restart is the common stumble.
- Advice repeated across guides: get etcd restore reliably under ~6 minutes and treat it as guaranteed points.

**Drill implication:** these two live in [Mnemonics](/reference/mnemonics/) as ordered sequences, because ordering is
what fails under time pressure — not comprehension.

## Theme 5 — Troubleshooting fluency comes from breaking things, not reading

Troubleshooting is 30% of the exam — more than any other domain — and it's the one people report as hardest to self-study.

Recurring scenario shapes people say they met or wished they had drilled:

- Node `NotReady` — kubelet stopped/misconfigured, CNI broken, disk or memory pressure
- A control-plane static Pod that won't come up because its manifest in `/etc/kubernetes/manifests` has a typo'd flag;
  the API server "starts and immediately disappears"
- Reading logs when `kubectl` itself is down, i.e. via `crictl` and `journalctl`, not `kubectl logs`
- Service with no endpoints — selector/label mismatch, wrong `targetPort`, Pod not Ready
- DNS resolution failures traced back to CoreDNS

The most-repeated advice is procedural: **break your own lab on purpose**, then fix it. Misconfigure etcd, stop the
kubelet, corrupt a static Pod manifest.

**Drill implication:** the [Troubleshooting](/domains/troubleshooting/) page is organised as decision trees from a symptom,
not as a list of components, because that's the order you meet them in.

## Theme 6 — Speed comes from the shell, not from typing faster

Near-universal, and the cheapest wins available:

- `alias k=kubectl` plus completion; several write-ups estimate shell setup saves **20–30 minutes across the exam**.
- `export do='--dry-run=client -o yaml'` (and `now='--force --grace-period=0'` for fast deletes). Generate manifests,
  never author them from scratch.
- `.vimrc`: `set expandtab tabstop=2 shiftwidth=2` — YAML plus literal tabs is a self-inflicted failure. Know `:set paste`.
- **`kubectl explain --recursive` beats the web docs** for field names. Round-tripping to a browser tab costs a minute
  you don't have.
- Bookmark the handful of doc pages you genuinely can't memorise (etcd restore, kubeadm upgrade, NetworkPolicy schema)
  before the exam starts.

**Drill implication:** [Cloze drills](/tools/cloze/) hide exactly these — flags, field names, and paths — because those
are what you must produce without a lookup.

## Theme 7 — Verify, always, and in the same 20 seconds

- "Imperative → YAML → Apply → **Verify**" is the pattern people credit for full marks.
- ~20 seconds after every task: `kubectl get` / `describe` the thing you just made, and confirm it is actually `Running`
  / `Bound` / has endpoints — not merely created.
- The verification is what catches the wrong-namespace and wrong-context errors that are otherwise invisible.

**Drill implication:** every practice task here ships with a **verification command**, and the task isn't complete until
it passes.

## Theme 8 — Simulator calibration

- The Killer.sh simulator is included with the exam voucher: 2 sessions × 17 scenarios, 120 minutes live, then 36 hours
  of access to work through the solutions.
- Consistent report: **it is harder than the real exam**. Doing well there is a strong pass signal; not finishing it is
  not by itself a fail signal.
- Its value is disproportionately in the 34 post-session hours — reading solutions to scenarios you couldn't finish.
- Practical note: practise in a Linux/Ubuntu environment. Muscle memory built on a different OS's shortcuts costs time.

---

## The short version

1. Set up the shell before task 1. Alias, completion, `$do`, `.vimrc`.
2. `use-context` then `current-context` — first action, every task.
3. Read all tasks, note the point weights, do cheap-and-heavy first.
4. Hard stop at ~7 minutes. Flag, move, come back.
5. Verify every task with a `get`/`describe` before you leave it.
6. Never author YAML you could have generated with `--dry-run=client -o yaml`.
7. Drill etcd restore and kubeadm upgrade until the ordering is cold recall.
8. Break your own cluster weekly. That's the 30% domain.

---

## Sources consulted

Directly fetched:

- <https://github.com/cncf/curriculum>
- <https://raw.githubusercontent.com/cncf/curriculum/master/CKA_Curriculum_v1.35.pdf>
- <https://github.com/techiescamp/cka-certification-guide/blob/main/SYLLABUS.md>

Read via search-result summaries (page fetch blocked by network egress):

- <https://github.com/techiescamp/cka-certification-guide/blob/main/EXAM_TIPS.md>
- <https://github.com/techiescamp/cka-certification-guide/blob/main/study-notes/05-troubleshooting.md>
- <https://github.com/theplatformlab/CKA-Certified-Kubernetes-Administrator>
- <https://dev.to/shahzadahmad91/my-cka-exam-day-experience-what-went-right-what-went-wrong-and-lessons-learned-5gd3>
- <https://dev.to/suzuki0430/cka-certified-kubernetes-administrator-exam-report-2026-dont-rely-on-old-guides-mastering-the-534m>
- <https://dev.to/mjace/the-path-to-cka-and-some-tips-1723>
- <https://dev.to/asteryujano/cka-feedbacks-456c>
- <https://medium.com/@meenakshi-sharma/how-i-cracked-the-kubernetes-cka-exam-after-failing-twice-d0b99a84e64f>
- <https://adhyatmaabbas.medium.com/how-i-failed-my-cka-exam-ed7854ff2e72>
- <https://medium.com/@alihanuludag/how-i-passed-the-cka-exam-in-2026-558b1a8702dd>
- <https://medium.com/@shoeb.off/how-i-passed-the-cka-exam-2026-real-questions-tips-and-my-strategy-ba0258254eca>
- <https://medium.com/codex/cka-exam-tips-eaade4724b58>
- <https://medium.com/@joaovitor/cka-and-ckad-exam-tips-79f92cdf45f7>
- <https://medium.com/@savitapadarya22/cka-exam-cluster-context-c7564f4c7c74>
- <https://raghu.sh/new-cka-exam-tips-tricks-ft-gateway-api-cni-cri-csi-helm-kustomize-ab5bb621b914>
- <https://kodekloud.com/blog/cka-exam-verification-guide/>
- <https://kodekloud.com/community/t/cka-mock-exam-series-difficulty-compared-to-killer-sh-and-the-exam-itself/362809>
- <https://forum.linuxfoundation.org/discussion/869703/looking-for-cka-practice-test-harder-than-killer-sh>
- <https://killer.sh/faq>
- <https://sailor.sh/blog/cka-exam-guide-2026/>
- <https://www.spectrocloud.com/blog/a-practical-guide-to-acing-your-cka-exam>
- <https://www.freecodecamp.org/news/prepare-for-the-kubernetes-administrator-certification-and-pass-2026-update/>
- <https://support.tools/training/cka-prep/08-troubleshooting/>
- <https://yanhan.github.io/posts/ckad-cka-exam-tactics/>
