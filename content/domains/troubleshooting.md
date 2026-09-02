---
title: Troubleshooting
domain: troubleshooting
examWeight: 30
weight: 1
summary: The largest domain. Organised as symptom → decision tree → minimal command sequence.
---

# Troubleshooting — 30%

The biggest domain, and the one you cannot bluff. Every task here starts from a **symptom**, so this page does too.
Nothing on this page is organised by component; you don't meet components, you meet broken things.

**Curriculum competencies:** troubleshoot clusters and nodes · troubleshoot cluster components · monitor cluster and
application resource usage · manage and evaluate container output streams · troubleshoot services and networking.

<div class="callout">

**Step 0, every single task.** Before you read the symptom:

```bash
kubectl config use-context <context-from-the-task>
kubectl config current-context
```

*Why:* a perfect fix on the wrong cluster scores zero, and nothing in the environment will tell you.

</div>

---

## The universal first move

```bash
kubectl get events -A --sort-by=.lastTimestamp | tail -20
```

*Why it works:* the control plane narrates its own failures into Events. Scheduling refusals, image pull failures, probe
failures, volume attach errors and OOM kills all land here with a reason string, before you have to guess at a component.

Its companion, scoped to one object:

```bash
kubectl describe pod <pod> -n <ns>          # Events section is at the bottom — read it first
```

---

## Tree 1 — Pod is not Running

Start: `kubectl get pod <pod> -n <ns> -o wide`. Branch on the **STATUS** column.

```
Pod status?
├── Pending ──────────────► nothing has scheduled it, or it can't start on its node
│   ├── describe says "0/N nodes are available"
│   │   ├── "Insufficient cpu/memory"     → node capacity vs. requests
│   │   ├── "node(s) had untolerated taint" → taint vs. toleration
│   │   ├── "didn't match Pod's node affinity/selector" → nodeSelector / affinity
│   │   └── "had volume node affinity conflict" → PV zone vs. node zone
│   ├── describe says "persistentvolumeclaim ... not found" / PVC is Pending → storage tree
│   └── no events at all                 → scheduler is not running (Tree 4)
├── ContainerCreating ────► scheduled, kubelet is stuck setting it up
│   ├── FailedMount / "timed out waiting for the condition" → volume/secret/configmap missing
│   └── "network plugin is not ready"    → CNI not installed / broken on that node
├── ImagePullBackOff / ErrImagePull ► image name, tag, or registry credentials
├── CrashLoopBackOff ─────► it starts and dies; read the PREVIOUS logs
├── Error / Completed ────► process exited; check exit code in describe
├── Terminating (stuck) ──► finalizer, or the node is gone
└── Running but 0/1 READY ► readiness probe is failing, not the container
```

### Pending — capacity, taints, affinity

```bash
kubectl describe pod <pod> -n <ns> | sed -n '/Events/,$p'
kubectl describe node <node> | grep -A5 'Allocated resources'
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
```
*Why:* the scheduler writes the exact predicate that failed into the `FailedScheduling` event; `Allocated resources`
shows requests already committed (not usage), which is what the scheduler actually compares against.

Fix depending on branch:

```bash
# untolerated taint: remove it from the node ...
kubectl taint nodes <node> key=value:NoSchedule-
# ... or tolerate it on the Pod (must be authored; there is no imperative form)
kubectl patch deploy <d> -n <ns> --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/tolerations","value":[{"key":"key","operator":"Equal","value":"value","effect":"NoSchedule"}]}]'

# insufficient capacity: lower the request
kubectl set resources deploy <d> -n <ns> --requests=cpu=100m,memory=128Mi
```
*Why:* a trailing `-` on a taint means "remove"; `set resources` edits the Pod template in place and rolls it, which is
faster and less error-prone than `kubectl edit`.

### CrashLoopBackOff — read the corpse, not the patient

```bash
kubectl logs <pod> -n <ns> --previous
kubectl logs <pod> -n <ns> -c <container> --previous     # multi-container
kubectl describe pod <pod> -n <ns> | grep -A3 'Last State'
```
*Why:* the running container is a fresh restart with no history. `--previous` reads the log of the instance that died,
and `Last State` gives you its exit code — 1 (app error), 137 (SIGKILL/OOM), 143 (SIGTERM).

Exit code **137** with `Reason: OOMKilled` means the memory limit, not the app:

```bash
kubectl set resources deploy <d> -n <ns> --limits=memory=512Mi
```

### Running but not Ready

```bash
kubectl describe pod <pod> -n <ns> | grep -A10 'Readiness'
kubectl exec <pod> -n <ns> -- wget -qO- localhost:8080/healthz
```
*Why:* Ready is owned by the readiness probe alone. If the probe's port/path/scheme don't match what the container
serves, the Pod runs forever and is silently removed from every Service's endpoints — which shows up as a *networking*
symptom two trees down.

### Terminating forever

```bash
kubectl get pod <pod> -n <ns> -o jsonpath='{.metadata.finalizers}'
kubectl delete pod <pod> -n <ns> --force --grace-period=0
```
*Why:* the API server won't remove an object while a finalizer is listed; `--force --grace-period=0` drops the object
from etcd without waiting for the kubelet, which is the right move only when the node is genuinely gone.

---

## Tree 2 — Node is NotReady

```
kubectl get nodes → NotReady
├── Can you SSH to it?  no → infrastructure, out of scope for the fix
└── yes:
    ├── systemctl is-active kubelet
    │   ├── inactive/failed → journalctl -u kubelet (config error, bad flag, cert)
    │   └── activating (loop) → kubelet crashing on start; read the same journal
    ├── kubelet active but node still NotReady
    │   ├── describe node → "container runtime network not ready" → CNI missing/broken
    │   ├── describe node → DiskPressure / MemoryPressure → free space or evict
    │   └── describe node → "Kubelet stopped posting node status" → clock, network, or API reachability
    └── crictl ps  →  runtime itself dead? systemctl status containerd
```

```bash
kubectl describe node <node> | sed -n '/Conditions/,/Addresses/p'
# then on the node:
systemctl status kubelet
journalctl -u kubelet --no-pager -n 50
systemctl restart kubelet && systemctl enable kubelet
```
*Why:* `Conditions` is the kubelet's own report card — `Ready=False` carries a `message` naming the cause. The journal is
the only place a kubelet that never finished starting can tell you why.

Config lives in two files that are the usual culprits after an edit:

| File | Holds |
|------|-------|
| `/var/lib/kubelet/config.yaml` | kubelet's own config (cgroup driver, `staticPodPath`, cluster DNS) |
| `/etc/kubernetes/kubelet.conf` | kubeconfig the kubelet uses to reach the API server |
| `/etc/kubernetes/pki/` | certificates; expired certs make the node go NotReady in unison with others |

```bash
df -h /var/lib/kubelet          # DiskPressure
kubeadm certs check-expiration  # cluster-wide NotReady with cert errors in the journal
```

---

## Tree 3 — Cluster-wide: `kubectl` itself fails

`The connection to the server <host>:6443 was refused` means the API server is down. You now have no `kubectl`, so you
work from the control-plane node with `crictl` and `journalctl`.

```
kubectl unreachable
├── ss -lntp | grep 6443  →  nothing listening
│   ├── ls /etc/kubernetes/manifests/kube-apiserver.yaml   → present?
│   │   ├── no  → someone moved it; restore it, kubelet will start it within ~20s
│   │   └── yes → the manifest is bad, or a dependency is down
│   ├── crictl ps -a | grep apiserver  → exited container?
│   │   └── crictl logs <id>   ← the actual error: bad flag, bad cert path, etcd unreachable
│   └── journalctl -u kubelet | grep -i apiserver
└── something IS listening → your kubeconfig, not the server
    └── kubectl config view --minify        (wrong cluster/server/user)
```

```bash
# on the control-plane node
sudo crictl ps -a --name kube-apiserver
sudo crictl logs <container-id> 2>&1 | tail -30
sudo journalctl -u kubelet --no-pager | grep -iE 'apiserver|manifest' | tail -20
```
*Why:* control-plane components are **static Pods** — the kubelet reads `/etc/kubernetes/manifests/*.yaml` directly from
disk and runs them without the API server's involvement. That's exactly why they can be repaired when the API is down,
and why editing the manifest is the fix: the kubelet notices the file change and recreates the Pod automatically. There
is no `systemctl restart kube-apiserver`.

<div class="callout warn">

**Trap:** always `cp /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/` before editing. A typo'd flag makes the API
server crash-loop, and now you're editing YAML with no `kubectl` and no undo.

</div>

---

## Tree 4 — A control-plane component other than the API server

If `kubectl` works, the API server is fine. Check the rest:

```bash
kubectl get pods -n kube-system
kubectl get componentstatuses           # deprecated but still answers on many clusters
```

```
Symptom → suspect
├── Pods stay Pending, no FailedScheduling events → kube-scheduler
├── Deployment created, no ReplicaSet appears     → kube-controller-manager
├── ReplicaSet exists, no Pods                    → kube-controller-manager
├── Deleted node objects linger, no GC            → kube-controller-manager
├── Services get no endpoints anywhere            → kube-controller-manager (endpoints controller)
└── Everything intermittently 500s                → etcd
```

```bash
kubectl -n kube-system logs kube-scheduler-<node>
kubectl -n kube-system logs kube-controller-manager-<node>
kubectl -n kube-system logs etcd-<node> | tail -20
```
*Why:* "created but never acted on" is the controller-manager's signature; "acted on but never placed" is the
scheduler's. Split the two by asking whether the *child object* exists.

Verify etcd directly when you suspect it:

```bash
ETCDCTL_API=3 etcdctl endpoint health \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```
*Why:* etcd speaks mTLS only; without all three cert flags you get a connection error that looks like an outage but is
your own client.

---

## Tree 5 — Service / networking symptoms

```
"I can't reach the service"
├── kubectl get endpoints <svc>  (or: kubectl get endpointslice -l kubernetes.io/service-name=<svc>)
│   ├── <none> ► the Service selects nothing
│   │   ├── selector ≠ pod labels        → fix one of them
│   │   ├── pods exist but are 0/1 READY → readiness probe (Tree 1); unready pods are excluded
│   │   └── pods are in another namespace → Services are namespaced
│   └── endpoints present ► selection is fine, move on
├── endpoints present but connection refused
│   ├── targetPort ≠ containerPort the app listens on
│   └── app bound to 127.0.0.1 instead of 0.0.0.0
├── works by IP, fails by name ► DNS
│   ├── kubectl -n kube-system get pods -l k8s-app=kube-dns   → CoreDNS running?
│   └── kubectl -n kube-system logs -l k8s-app=kube-dns
└── works within namespace, fails across ► NetworkPolicy
    └── kubectl get netpol -A
```

```bash
kubectl get svc,endpoints <svc> -n <ns>
kubectl get pods -n <ns> --show-labels
kubectl run tmp --image=busybox:1.36 --rm -it --restart=Never -- \
  sh -c 'nslookup <svc>.<ns>.svc.cluster.local; wget -qO- --timeout=2 <svc>.<ns>:80'
```
*Why:* an empty `ENDPOINTS` column proves the fault is *label selection or readiness*, not routing — which collapses the
search space immediately. The throwaway Pod tests DNS and connectivity from inside the cluster network, where the
Service actually exists; from a node, ClusterIP may not resolve at all.

DNS name shape, which you must recall cold:

```
<service>.<namespace>.svc.cluster.local          # Services
<pod-ip-with-dashes>.<namespace>.pod.cluster.local
```

Test whether a NetworkPolicy is the cause by reading its `podSelector` — remember an empty `podSelector: {}` selects
**every** Pod in that namespace, and a policy with `policyTypes: [Ingress]` and no `ingress:` rules denies everything.

---

## Monitoring resource usage

```bash
kubectl top nodes
kubectl top pods -A --sort-by=memory
kubectl top pod <pod> -n <ns> --containers
```
*Why:* `top` reads live usage from the metrics-server. `describe node` shows *requests* (what the scheduler reserved) —
different number, different question. If `top` errors with `Metrics API not available`, metrics-server isn't installed;
that's the answer, not a failure.

---

## Container output streams

```bash
kubectl logs <pod> -n <ns> -f                  # follow
kubectl logs <pod> -n <ns> --previous          # the instance that crashed
kubectl logs <pod> -n <ns> --all-containers    # every container in the Pod
kubectl logs -l app=web -n <ns> --tail=50      # by label, across Pods
kubectl logs <pod> -n <ns> --since=10m
kubectl logs <pod> -n <ns> > /opt/answer.txt   # tasks often want the output written to a file
```
*Why:* the kubelet captures each container's stdout/stderr to disk on the node; `kubectl logs` reads that, so it works
even when the container has exited — but only for the current and previous instance.

<div class="callout warn">

**Trap:** when a task says "write the log lines containing X to /opt/file", do it with `grep` and check the file:
`kubectl logs <pod> | grep X > /opt/file && cat /opt/file`. Silent empty files are a common own-goal.

</div>

---

## Verification habit

Never leave a task without one of these coming back correct:

```bash
kubectl get pod <pod> -n <ns>                    # Running, 1/1
kubectl get pvc -n <ns>                          # Bound
kubectl get endpoints <svc> -n <ns>              # non-empty
kubectl get nodes                                # Ready
kubectl -n <ns> rollout status deploy/<d>        # successfully rolled out
```
