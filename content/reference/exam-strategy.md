---
title: Exam Strategy
order: 3
summary: The seven-minute budget, the wrong-cluster trap, flag-and-skip, and the verification habit.
---

# Exam strategy

Derived from the [community retrospectives](/docs/retrospectives/). Nearly every reported failure is a process failure,
not a knowledge failure.

---

## The arithmetic that drives everything

120 minutes ÷ ~17 tasks ≈ **7 minutes per task**, and that 7 minutes includes reading the prompt, switching context, and
verifying. It is not 7 minutes of typing.

Passing is 66%. You do **not** need every task. You need most of them done correctly, which is a different objective from
every task done perfectly — and optimising for the second is the most-reported cause of a second failed attempt.

---

## The opening

1. **Before task 1:** aliases, completion, `$do`, `.vimrc`. Two minutes, saves twenty.
2. **Read every task first**, noting its point weight. Weights are shown and they are not equal.
3. **Order by points ÷ estimated minutes.** Bank cheap, heavy tasks; defer expensive ones.

## Per task, in this order

```
1. kubectl config use-context <given>   ← FIRST ACTION. Then current-context to confirm.
2. Read the task twice. Note the namespace. Note the exact names asked for.
3. Generate, don't author:  kubectl create ... $do > x.yaml
4. Apply.
5. Verify with a get/describe that proves the end state, not the API call.
6. Move on. Do not polish.
```

### Step 1 is the one that silently costs whole tasks

Solving on the wrong cluster scores zero and gives you **no signal at all** — your resource exists, your YAML is right,
and the grader looks somewhere else. Two seconds of `current-context` eliminates the single most costly mistake reported.

The namespace is the same trap one level down. If the task names a namespace and you forget `-n`, you built the right
thing in the wrong place, and `kubectl get` in your current namespace will happily show you nothing while you assume
success.

### Step 5 is what converts work into points

Twenty seconds. Confirm the *end state*:

| You did | Verify with |
|---------|-------------|
| created a Pod/Deployment | `kubectl get po` → `Running`, `1/1` |
| created a Service | `kubectl get endpoints <svc>` → non-empty |
| created a PVC | `kubectl get pvc` → `Bound` |
| fixed a node | `kubectl get nodes` → `Ready` |
| rolled a Deployment | `kubectl rollout status deploy/<d>` |
| wrote RBAC | `kubectl auth can-i ... --as=...` → `yes` |
| wrote a file | `cat` the file |
| restored etcd | `kubectl get po -A` returns the expected objects |

"It applied without an error" is not verification. Objects apply cleanly and then fail to run all the time.

---

## Flag and skip

- If you're **3 minutes in with no traction**, flag it and go.
- If reading it suggests **more than 8 minutes**, defer it on the first pass by default.
- Come back only after every cheap task is banked and verified.

The failure mode is emotional, not technical: a hard task feels like it needs finishing *now*. It doesn't. It's worth
the same points at minute 100.

---

## Things that quietly eat minutes

| Time sink | Replace with |
|-----------|--------------|
| Writing YAML from scratch | `$do` generation, then edit |
| Browsing kubernetes.io for field names | `kubectl explain <kind>.<path> --recursive` |
| `kubectl edit` on a live object | `kubectl set image` / `set env` / `set resources` / `patch` |
| Retyping long resource names | shell completion (set it up in the first minute) |
| Re-reading the task for the namespace | write the namespace down before you start |
| Perfecting a task that already works | leave; it scores the same |

---

## Documentation you are allowed, and how to use it

One additional browser tab, official Kubernetes documentation. Bookmark the handful of pages you genuinely cannot
produce cold — realistically: etcd backup/restore, kubeadm upgrade, NetworkPolicy schema, Gateway API examples,
PV/PVC examples.

Everything else should come from `kubectl explain` and `kubectl <cmd> --help`, both of which are faster than a page load
and always match the cluster's version.

---

## Preparation calibration

- The **Killer.sh simulator** ships with the exam voucher: 2 sessions, 17 scenarios each. It is consistently reported as
  harder than the real exam. Not finishing it is not a fail signal; the value is disproportionately in the 34 hours of
  post-session access where you read the solutions.
- **Practise timed, always.** Untimed practice trains the wrong exam. Every practice task on this site shows a target
  time before you start for exactly this reason.
- **Break your own cluster weekly.** Stop a kubelet, corrupt a static Pod manifest, delete a CNI config, point etcd at
  an empty directory. Troubleshooting is 30% and it is the one domain that does not yield to reading.
- **Practise on Linux.** Muscle memory built on other shortcuts costs real minutes.

---

## The evening before

- Confirm ID, webcam, and a clear desk against the current Candidate Handbook.
- Re-read your own weakest-domain notes — the [dashboard](/tools/dashboard/) surfaces them.
- Rehearse the two all-or-nothing recipes once: etcd restore, kubeadm upgrade.
- Sleep. The exam is 120 minutes of sustained attention, and every reported time-management failure gets worse when
  you're tired.
