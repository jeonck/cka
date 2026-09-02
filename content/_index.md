---
title: CKA Study Site
---

## Start here

1. [Read the curriculum](/docs/curriculum/) — the exact domains and weights, transcribed from the CNCF PDF, with the date they were fetched.
2. [Read the retrospectives](/docs/retrospectives/) — eight recurring themes from public pass/fail write-ups. Almost every reported failure is a process failure.
3. [Read the strategy page](/reference/exam-strategy/), then never practise untimed again.
4. [Set a target date](/tools/plan/) and let the scheduler decide your daily workload.

## The domains

{{< domain-grid >}}

## How the study tools work

- **[Review session](/tools/review/)** — flashcards and cloze drills through an SM-2 scheduler. Ease factor, interval
  and repetition count per item; overdue first, then new. Fully keyboard-driven.
- **[Practice tasks](/tools/practice/)** — scenario-based and timed, each with a model solution and a verification
  command. The timer turns red when you pass the target, because that is the moment to flag and move on.
- **[Mnemonics](/tools/mnemonics/)** — for what must be recalled cold: the kubeadm upgrade order, etcd's mandatory TLS
  flags, taint effects, the three conditions that make a PVC bind.
- **[Dashboard](/tools/dashboard/)** — per-domain mastery and time spent, sorted by exam risk (curriculum weight × how
  far you still are from mastery), so the weakest high-weight domain is always first.
- **[Study plan](/tools/plan/)** — target date in, daily workload out, with the last three days reserved for review only.

Everything is stored in `localStorage`. No backend, no account, nothing leaves your browser —
so [export your progress](/tools/data/) if you would mind losing it.

## Content policy: no exam dumps {#policy}

The CKA is under NDA. Nothing here scrapes, reproduces, or approximates real exam questions, and no such material was
consulted while building it.

What the practice tasks *are*: original scenarios inferred from two public sources — the published curriculum weights
and competency list, and community retrospectives about preparation and process. If a task pattern looks high-yield
here, it is because the curriculum weights it heavily and people repeatedly report underestimating it, not because
anyone reported seeing it.

Community write-ups are cited by URL in the [retrospectives](/docs/retrospectives/), along with an honest note about
which pages could be fetched directly and which were read through search summaries.

## Offline

The [one-book reference PDF](/cka-reference.pdf) is generated from the same markdown and JSON as this site — cheat
sheet, every decision tree, every mnemonic, and the flags worth memorising. It regenerates on every build, so it cannot
drift from the site.
