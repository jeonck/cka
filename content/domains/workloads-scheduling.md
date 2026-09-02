---
title: Workloads and Scheduling
domain: workloads-scheduling
examWeight: 15
weight: 4
summary: Deployments and rollouts, ConfigMaps and Secrets, autoscaling, self-healing primitives, scheduling controls.
---

# Workloads and Scheduling — 15%

Almost entirely imperative-command territory. If you're authoring YAML here, you're losing time.

**Curriculum competencies:** application deployments, rolling updates and rollbacks · ConfigMaps and Secrets ·
workload autoscaling · primitives for robust self-healing deployments · Pod admission and scheduling (limits, node
affinity, etc.).

---

## Tree 1 — Create and roll

```bash
kubectl create deploy web --image=nginx:1.26 --replicas=3
kubectl set image deploy/web nginx=nginx:1.27          # container-name=new-image
kubectl rollout status deploy/web
kubectl rollout history deploy/web
kubectl rollout undo deploy/web                        # previous revision
kubectl rollout undo deploy/web --to-revision=2
kubectl rollout restart deploy/web                     # re-create Pods, same spec
kubectl scale deploy/web --replicas=5
```
*Why `set image` and not `edit`:* it patches only the container image and triggers exactly one rollout. `kubectl edit`
on a bad day leaves you in vim with an invalid document and a Deployment that didn't change.

*Why `rollout restart` exists:* changing a mounted ConfigMap doesn't restart Pods. `restart` stamps a new annotation on
the Pod template, which is a template change, which rolls the Deployment.

```
Rollout stuck?
├── kubectl rollout status hangs
│   ├── new Pods Pending          → scheduling (see Troubleshooting Tree 1)
│   ├── new Pods ImagePullBackOff → bad tag; rollout undo
│   └── new Pods Running, 0/1     → readiness probe never passes → maxUnavailable blocks progress
└── kubectl describe deploy → "ProgressDeadlineExceeded" after 600s
```

Strategy knobs, which a task will name explicitly:

```bash
kubectl patch deploy web -p \
  '{"spec":{"strategy":{"rollingUpdate":{"maxSurge":1,"maxUnavailable":0}}}}'
```
*Why `maxUnavailable: 0`:* it forces a new Pod to become Ready **before** an old one is removed — the zero-downtime
shape. `maxSurge: 0` with `maxUnavailable: 1` is the opposite trade (no extra capacity, brief reduction).

---

## Tree 2 — Configuration: ConfigMaps and Secrets

```bash
kubectl create configmap app-cfg --from-literal=LOG_LEVEL=debug --from-literal=MODE=prod
kubectl create configmap app-cfg --from-file=./app.properties
kubectl create configmap app-cfg --from-env-file=./app.env

kubectl create secret generic db-cred \
  --from-literal=username=admin --from-literal=password=s3cr3t
kubectl create secret docker-registry regcred \
  --docker-server=registry.io --docker-username=u --docker-password=p
kubectl create secret tls web-tls --cert=tls.crt --key=tls.key
```

Consume them — `--from-file` vs `--from-env-file` is the distinction that gets missed:

| Flag | Result |
|------|--------|
| `--from-file=app.properties` | **one** key `app.properties` whose value is the whole file |
| `--from-env-file=app.env` | **one key per line** of `KEY=value` |

```bash
kubectl set env deploy/web --from=configmap/app-cfg      # all keys as env vars
kubectl set env deploy/web --from=secret/db-cred
kubectl set env deploy/web LOG_LEVEL=debug
kubectl set env deploy/web LOG_LEVEL-                    # trailing dash removes it
```
*Why `set env --from`:* it writes `envFrom` correctly in one command. Hand-authoring `envFrom.configMapRef.name` is a
common misspelling (`configMapRef`, capital M).

Reading a Secret back:

```bash
kubectl get secret db-cred -o jsonpath='{.data.password}' | base64 -d
```
*Why:* Secret values are base64 in the API, not encrypted. A task asking you to "find the password" wants this pipe.

Mounting as a volume is the one place YAML is unavoidable:

```yaml
spec:
  containers:
    - name: web
      volumeMounts:
        - name: cfg
          mountPath: /etc/config
          readOnly: true
  volumes:
    - name: cfg
      configMap:
        name: app-cfg
```
*Why mount instead of env:* mounted ConfigMap keys update in place (eventually) when the ConfigMap changes; environment
variables are fixed at container start.

---

## Tree 3 — Autoscaling

```bash
kubectl autoscale deploy web --min=2 --max=10 --cpu-percent=70
kubectl get hpa
kubectl describe hpa web            # the Events + Conditions tell you why it isn't scaling
```

```
HPA not scaling?
├── TARGETS shows <unknown>/70%
│   ├── metrics-server not installed  → kubectl top pods also fails
│   └── the Deployment has no CPU *requests* → HPA computes a percentage OF the request
├── TARGETS fine, replicas pinned at max/min → hit the bound; that's correct behaviour
└── scaling down is slow → stabilization window (5 min default), also correct
```
*Why requests are mandatory:* `--cpu-percent=70` means "70% of the container's CPU **request**". With no request there
is no denominator, and the HPA reports `<unknown>` forever.

```bash
kubectl set resources deploy web --requests=cpu=100m,memory=128Mi --limits=cpu=500m,memory=256Mi
```

Vertical scaling is manual here; the exam's autoscaling competency is HPA, plus knowing that a **Cluster Autoscaler**
adds nodes and is a separate component.

---

## Tree 4 — Self-healing primitives

| Primitive | Guarantees |
|-----------|-----------|
| `Deployment` → `ReplicaSet` | N stateless replicas, rolling updates, rollback history |
| `StatefulSet` | stable network identity + stable storage, ordered create/delete |
| `DaemonSet` | exactly one Pod per (matching) node, including new nodes |
| `Job` | run to completion, `completions`/`parallelism`, retries via `backoffLimit` |
| `CronJob` | Jobs on a schedule |
| `PodDisruptionBudget` | floor on availability during *voluntary* disruption (drain) |

```bash
kubectl create job pi --image=perl -- perl -Mbignum=bpi -wle 'print bpi(200)'
kubectl create cronjob report --image=busybox --schedule="*/5 * * * *" -- /bin/sh -c 'date'
kubectl create job manual-run --from=cronjob/report        # trigger a CronJob now
kubectl create poddisruptionbudget web-pdb --selector=app=web --min-available=2
```
*Why the PDB matters on this exam:* it is what makes `kubectl drain` block. A drain that hangs forever with
`cannot evict pod as it would violate the disruption budget` is a PDB, not a bug.

Probes — the three, and what each one does:

| Probe | Failure means |
|-------|---------------|
| `livenessProbe` | container is restarted |
| `readinessProbe` | Pod removed from Service endpoints (not restarted) |
| `startupProbe` | disables the other two until it first succeeds; for slow starters |

*Why startupProbe exists:* without it, a slow-booting app gets killed by its own liveness probe in a loop that looks
exactly like a crash.

---

## Tree 5 — Scheduling and admission

```
"Place this Pod on/off node X"
├── hard requirement, simple label     → nodeSelector
├── hard requirement, expressions      → requiredDuringSchedulingIgnoredDuringExecution
├── soft preference                    → preferredDuringSchedulingIgnoredDuringExecution
├── keep Pods AWAY from a node         → taint the node (+ toleration to allow back)
├── co-locate / separate Pods          → podAffinity / podAntiAffinity + topologyKey
├── spread evenly across zones         → topologySpreadConstraints
└── bypass the scheduler entirely      → nodeName (or a static Pod)
```

```bash
kubectl label node worker-1 disktype=ssd
kubectl taint node worker-1 gpu=true:NoSchedule
kubectl taint node worker-1 gpu=true:NoSchedule-          # trailing dash removes
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
kubectl run web --image=nginx --dry-run=client -o yaml > pod.yaml   # then add the stanza
```

Taint effects, which differ in ways tasks exploit:

| Effect | Does |
|--------|------|
| `NoSchedule` | no new Pods without a toleration; existing Pods stay |
| `PreferNoSchedule` | soft version; scheduler tries to avoid |
| `NoExecute` | as `NoSchedule`, **and evicts** running Pods that don't tolerate |

*Why the distinction matters:* "make the existing Pods leave" is `NoExecute`; `NoSchedule` alone will look like it did
nothing.

Resource admission at the namespace level:

```bash
kubectl create quota dev-quota -n dev \
  --hard=cpu=4,memory=8Gi,pods=20,persistentvolumeclaims=5
kubectl describe quota -n dev
kubectl describe limitrange -n dev
```
*Why a ResourceQuota can break Pod creation:* once a quota sets `cpu` or `memory`, every Pod in that namespace **must**
declare matching requests/limits or it is rejected at admission with a `failed quota` error. A `LimitRange` supplies
defaults so that doesn't happen.

Static Pods — the scheduler is not involved at all:

```bash
# on the node
sudo vi /etc/kubernetes/manifests/my-static.yaml    # path from staticPodPath in kubelet config
grep staticPodPath /var/lib/kubelet/config.yaml
```
*Why they matter:* the kubelet runs them straight from disk, they get `-<nodename>` appended to their name, and they
cannot be deleted with `kubectl` — the kubelet just recreates them. Delete the file.

---

## Verification habit

```bash
kubectl rollout status deploy/<d> -n <ns>
kubectl get pods -o wide                      # landed on the intended node?
kubectl get hpa,quota,pdb -n <ns>
kubectl describe pod <p> | grep -A5 'Environment\|Mounts'
```
