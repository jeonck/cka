---
title: kind lab — 12 tasks in 40 minutes
shortTitle: kind lab
weight: 3
summary: A local three-node kind cluster, seeded with twelve exam-shaped tasks and a grader. Two scripts, one clock.
---

The [practice tasks](/tools/practice/) give you a scenario and a model answer, but no cluster to be wrong on.
This is the cluster. `setup.sh` builds a three-node [kind](https://kind.sigs.k8s.io/) cluster named `cka`
(context `kind-cka`, nodes `cka-control-plane`, `cka-worker`, `cka-worker2`), seeds the broken state the
troubleshooting tasks need, and `check.sh` grades all twelve the way the exam does — by end state, not by what you typed.

<p><a class="btn" href="/lab/setup.sh" download>setup.sh</a> <a class="btn" href="/lab/check.sh" download>check.sh</a>
<span class="small muted">Needs <code>kind</code>, <code>kubectl</code>, and podman (<code>RUNTIME=docker</code> for Docker).
First run creates the cluster and installs Calico, so that task 6 is graded by a CNI that enforces NetworkPolicy — kindnet
does not.</span></p>

```bash
chmod +x setup.sh check.sh
./setup.sh      # create (first time) or reset, then seed
# ... 40 minutes ...
./check.sh      # PASS/FAIL per task, with the reason
```

**Budget: 40 minutes for 12 tasks**, which is a little tighter than the real 7 minutes each — deliberately, because there is
no reading-the-prompt overhead here. Run the whole set in one sitting with the clock going; each row also links to its
timed version with the model solution. Re-running `setup.sh` resets everything, so the set can be drilled until the
troubleshooting pair takes under five minutes together.

{{< lab-tasks "kind-cka" >}}

## How this differs from the exam

- **Node access is `podman exec -it <node> bash`**, not `ssh`. Everything you do inside the node is the same.
- **`etcdctl` is not on the node.** Run it inside the etcd Pod with `kubectl -n kube-system exec etcd-cka-control-plane -- etcdctl …`. The flags are identical.
- **kind has a default StorageClass `standard`.** Task 7 is written so that forgetting `storageClassName` produces a Bound PVC on the wrong volume — the grader checks which volume.
- **The tasks are not independent, and 11 comes first.** `cka-worker2` is NotReady from the moment you start, so the Pod task 3 pins there stays Pending until you have fixed the kubelet. Solve **11 before 3**. Beyond that: 2 depends on 1, 5 on 1, and 4 taints the node 3 does not use. The exam's tasks are independent; treat the order here as given.
