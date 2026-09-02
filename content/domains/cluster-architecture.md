---
title: Cluster Architecture, Installation and Configuration
domain: cluster-architecture
shortTitle: Cluster Architecture
examWeight: 25
weight: 2
summary: RBAC, kubeadm lifecycle, etcd, HA control plane, Helm/Kustomize, extension interfaces, CRDs and operators.
---

# Cluster Architecture, Installation and Configuration — 25%

Second-largest domain and the one with the most *deterministic recipes* on the exam. etcd restore and `kubeadm upgrade`
are near-guaranteed appearances, both are all-or-nothing, and both fail on **ordering**, not on understanding. Drill the
sequences until they're cold recall.

**Curriculum competencies:** RBAC · prepare underlying infrastructure · create and manage clusters using kubeadm ·
manage the cluster lifecycle · implement and configure a highly-available control plane · use Helm and Kustomize to
install cluster components · understand extension interfaces (CNI, CSI, CRI, etc.) · understand CRDs, install and
configure operators.

---

## Tree 1 — "X can't do Y" → RBAC

```
Permission problem
├── Who is the subject?
│   ├── a ServiceAccount → system:serviceaccount:<ns>:<name>
│   ├── a user           → the CN of their client certificate
│   └── a group          → the O of their client certificate
├── Is the resource namespaced?   (kubectl api-resources --namespaced=true)
│   ├── yes → Role + RoleBinding   (scoped to one namespace)
│   └── no  → ClusterRole + ClusterRoleBinding   (nodes, PVs, namespaces, CRDs…)
└── Special case: namespaced permission, reusable definition
    → ClusterRole + RoleBinding   (grants the ClusterRole only inside that namespace)
```

The whole domain in four imperative commands — never author RBAC YAML by hand:

```bash
kubectl create role pod-reader --verb=get,list,watch --resource=pods -n dev
kubectl create rolebinding read-pods --role=pod-reader --serviceaccount=dev:app-sa -n dev

kubectl create clusterrole node-reader --verb=get,list,watch --resource=nodes
kubectl create clusterrolebinding read-nodes --clusterrole=node-reader --user=jane
```
*Why it works:* `create role`/`create clusterrole` take `--verb` and `--resource` as repeatable comma lists and emit
correct `apiGroups` for you — which is the field people get wrong by hand (`""` for core, `apps` for Deployments,
`rbac.authorization.k8s.io` for RBAC itself).

Binding subject flags, which is where the typos live:

| Subject | Flag |
|---------|------|
| ServiceAccount | `--serviceaccount=<namespace>:<name>` |
| User | `--user=<name>` |
| Group | `--group=<name>` |

**Always verify with the impersonation check**, not by reading YAML:

```bash
kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:app-sa
kubectl auth can-i --list -n dev --as=system:serviceaccount:dev:app-sa
kubectl auth can-i '*' '*' --as=jane           # is this subject cluster-admin?
```
*Why:* `auth can-i --as` asks the API server's own authorizer. It is the same code path the real request takes, so a
`yes` is proof and a `no` tells you the binding didn't land.

Sub-resources and named objects, when a task is deliberately narrow:

```bash
kubectl create role log-reader --verb=get --resource=pods/log -n dev
kubectl create role cm-editor --verb=get,update --resource=configmaps \
  --resource-name=app-config -n dev
```
*Why:* `--resource-name` restricts the rule to a named object, and `pods/log` is a distinct resource from `pods` — a
role granting `pods` does **not** grant `kubectl logs`.

Grant a Pod an identity:

```bash
kubectl create serviceaccount app-sa -n dev
kubectl set serviceaccount deploy/web app-sa -n dev
```

<div class="callout warn">

**Trap:** RBAC is purely additive — there are no deny rules. If a subject can still do the thing, look for a *second*
binding (often to `system:authenticated` or a group) rather than trying to subtract from the one you found.

</div>

---

## Tree 2 — etcd backup and restore

The single highest points-per-minute task on the exam. Get it under six minutes.

```
etcd task
├── "take a snapshot"  → snapshot save (cluster keeps running; nothing else to do)
└── "restore from <file>"
    ├── 1. restore the snapshot to a NEW data dir
    ├── 2. point the static Pod at that dir   ← the step everyone forgets
    │      /etc/kubernetes/manifests/etcd.yaml:
    │        --data-dir=<new dir>            (command flag)
    │        volumes[etcd-data].hostPath.path=<new dir>   ← and this one
    └── 3. wait for the kubelet to recreate the Pod, then verify
```

### Backup

```bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /opt/etcd-backup.db

etcdctl --write-out=table snapshot status /opt/etcd-backup.db   # verify
```
*Why:* etcd only speaks mutual TLS, so all three of `--cacert/--cert/--key` are mandatory; without them the failure
looks like an outage but is your own client being rejected.

<div class="callout">

**Don't memorise the cert paths — read them off the running Pod:**

```bash
grep -E 'cert-file|key-file|trusted-ca-file|data-dir|listen-client-urls' \
  /etc/kubernetes/manifests/etcd.yaml
```
That file is the source of truth for this cluster and takes ten seconds.

</div>

### Restore

```bash
# 1. restore into a new directory (never over the live one)
sudo ETCDCTL_API=3 etcdctl snapshot restore /opt/etcd-backup.db \
  --data-dir=/var/lib/etcd-restore
# etcd 3.5+ prefers: sudo etcdutl snapshot restore /opt/etcd-backup.db --data-dir=/var/lib/etcd-restore

# 2. repoint the static Pod
sudo cp /etc/kubernetes/manifests/etcd.yaml /tmp/etcd.yaml.bak
sudo vi /etc/kubernetes/manifests/etcd.yaml
#   spec.containers[0].command:  --data-dir=/var/lib/etcd-restore
#   spec.volumes[name=etcd-data].hostPath.path: /var/lib/etcd-restore

# 3. the kubelet recreates the Pod on file change — wait, don't restart anything
sudo crictl ps | grep etcd
kubectl get pods -A
```
*Why the second edit matters:* `--data-dir` is a path *inside the container*. The `etcd-data` volume is what maps that
path to the host. Change only the flag and etcd reads an empty directory; change only the volume and it reads the old
data. Restores "succeed" and serve stale state precisely because one of the two was missed.

*Why no restart command:* etcd is a static Pod. The kubelet watches `/etc/kubernetes/manifests/` and recreates the Pod
when the file's mtime changes. If it seems stuck, `mv` the manifest out of the directory, wait for the container to
disappear, and `mv` it back.

---

## Tree 3 — kubeadm cluster lifecycle

### Upgrade (the order is the whole exam question)

**Control-plane node first, always.**

```bash
# from a machine with kubectl:
kubectl drain cp-1 --ignore-daemonsets

# on cp-1 — update the package repo to the target MINOR version first (pkgs.k8s.io is per-minor)
sudo sed -i 's|v1.34|v1.35|' /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-mark unhold kubeadm
sudo apt-get install -y kubeadm=1.35.0-1.1
sudo apt-mark hold kubeadm
kubeadm version

sudo kubeadm upgrade plan                 # shows what it will do; reads the target version
sudo kubeadm upgrade apply v1.35.0        # control plane ONLY on the first node

sudo apt-mark unhold kubelet kubectl
sudo apt-get install -y kubelet=1.35.0-1.1 kubectl=1.35.0-1.1
sudo apt-mark hold kubelet kubectl
sudo systemctl daemon-reload
sudo systemctl restart kubelet

kubectl uncordon cp-1
```

**Then each worker:**

```bash
kubectl drain worker-1 --ignore-daemonsets --delete-emptydir-data
# on worker-1:
sudo sed -i 's|v1.34|v1.35|' /etc/apt/sources.list.d/kubernetes.list && sudo apt-get update
sudo apt-mark unhold kubeadm && sudo apt-get install -y kubeadm=1.35.0-1.1 && sudo apt-mark hold kubeadm
sudo kubeadm upgrade node                 # NOT "apply" — workers only refresh local config
sudo apt-mark unhold kubelet kubectl
sudo apt-get install -y kubelet=1.35.0-1.1 kubectl=1.35.0-1.1
sudo apt-mark hold kubelet kubectl
sudo systemctl daemon-reload && sudo systemctl restart kubelet
kubectl uncordon worker-1
```

*Why this order:* `kubeadm` is only an installer — upgrading the binary changes nothing until `upgrade apply` rewrites
the static Pod manifests. The kubelet is a *separate* package that `kubeadm` never touches, which is why it is upgraded
and restarted by hand afterwards. `apt-mark hold` exists because the packages are pinned to stop accidental upgrades;
forgetting `unhold` makes `apt-get install` silently keep the old version.

<div class="callout warn">

**Traps:** you may only upgrade **one minor version at a time** (1.33 → 1.34 → 1.35, never 1.33 → 1.35). `upgrade apply`
runs on the first control-plane node only; every other node — control plane or worker — uses `upgrade node`. And the
`pkgs.k8s.io` apt repository URL is per-minor-version, so skipping the `sed` makes every `apt-get install` fail to find
the version you asked for.

</div>

### Join a new node

```bash
# on a control-plane node:
kubeadm token create --print-join-command
# on the new node, run what it printed:
sudo kubeadm join <cp-endpoint>:6443 --token <t> --discovery-token-ca-cert-hash sha256:<hash>
```
*Why:* join tokens expire (24h by default), so the stored one from install time is usually dead;
`--print-join-command` mints a fresh token and computes the CA hash in one shot.

### Remove a node

```bash
kubectl drain worker-2 --ignore-daemonsets --delete-emptydir-data --force
kubectl delete node worker-2
# on worker-2:
sudo kubeadm reset -f && sudo rm -rf /etc/cni/net.d $HOME/.kube/config
```
*Why:* `drain` evicts workloads and cordons; `delete node` removes the API object; `kubeadm reset` cleans the local
state so the machine could rejoin. Doing them out of order strands Pods.

### Cordon vs. drain

```bash
kubectl cordon <node>     # mark unschedulable; running Pods stay
kubectl drain <node>      # cordon + evict
kubectl uncordon <node>   # back into rotation
```

Drain flags you will need, and why:

| Flag | Needed when |
|------|-------------|
| `--ignore-daemonsets` | almost always — DaemonSet Pods can't be evicted, only ignored |
| `--delete-emptydir-data` | a Pod uses an `emptyDir`; refuses without it |
| `--force` | bare Pods with no controller; they will be deleted, not rescheduled |

---

## Tree 4 — Highly-available control plane

```
HA topology
├── Stacked etcd     → etcd runs as a static Pod on each control-plane node (kubeadm default)
│                      simpler; losing a node loses both an apiserver and an etcd member
└── External etcd    → etcd on its own machines
                       more machines; control plane and storage fail independently
```

Both need a **load balancer in front of :6443** and an odd member count.

```bash
# first control-plane node
sudo kubeadm init \
  --control-plane-endpoint "k8s-api.example.com:6443" \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16

# additional control-plane nodes (note the extra two flags)
sudo kubeadm join k8s-api.example.com:6443 --token <t> \
  --discovery-token-ca-cert-hash sha256:<hash> \
  --control-plane --certificate-key <key>
```
*Why `--control-plane-endpoint` must be set at init time:* it bakes the LB name into every generated kubeconfig and
certificate SAN. Add it later and you're regenerating the PKI. `--upload-certs` stores the CA material in a
`kubeadm-certs` Secret so joining control planes can pull it — that Secret **expires after two hours**;
regenerate with `sudo kubeadm init phase upload-certs --upload-certs`.

**Quorum arithmetic — memorise it:** an etcd cluster of *n* members tolerates `(n-1)/2` failures.

| Members | Tolerates | Note |
|---------|-----------|------|
| 1 | 0 | not HA |
| 3 | 1 | the standard |
| 5 | 2 | large clusters |
| 4 | 1 | same tolerance as 3, more to break — **never use even numbers** |

```bash
ETCDCTL_API=3 etcdctl member list --write-out=table \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

---

## Tree 5 — Install cluster components: Helm and Kustomize

New in the post-2025 curriculum, and a reported weak spot. Both are about *installing things into the cluster*, so
expect "install component X with values Y" rather than authoring charts.

### Helm

```bash
helm repo add <name> <url> && helm repo update
helm search repo <name> --versions
helm show values <name>/<chart> > /tmp/values.yaml     # discover what's configurable
helm install <release> <name>/<chart> -n <ns> --create-namespace \
  --set key=value -f /tmp/values.yaml
helm upgrade --install <release> <name>/<chart> -n <ns> --version 1.2.3
helm list -A                                            # every release, all namespaces
helm history <release> -n <ns>
helm rollback <release> <revision> -n <ns>
helm uninstall <release> -n <ns>
helm template <release> <name>/<chart> | kubectl apply -f -   # render without Tiller-era magic
```
*Why `helm show values` first:* the chart's own defaults file names every key you're allowed to `--set`. Guessing key
paths is the main way Helm tasks are lost.

*Why `--version` matters:* `helm install` takes the newest chart by default; a task naming a version fails silently
without it.

### Kustomize (built into kubectl)

```bash
kubectl kustomize ./overlays/prod          # render to stdout — always look before applying
kubectl apply -k ./overlays/prod
kubectl delete -k ./overlays/prod
```

A minimal `kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: prod
resources:
  - ../../base
images:
  - name: nginx
    newTag: "1.27"
configMapGenerator:
  - name: app-config
    literals:
      - LOG_LEVEL=debug
patches:
  - path: replicas-patch.yaml
    target:
      kind: Deployment
      name: web
```
*Why `-k` and not `-f`:* `-k` tells kubectl to run the kustomize build first. `kubectl apply -f kustomization.yaml`
tries to apply the kustomization file itself as an object and fails.

---

## Tree 6 — Extension interfaces (CNI, CSI, CRI)

```
Which interface?
├── CRI — how the kubelet runs containers      → containerd / CRI-O ; crictl ; /etc/crictl.yaml
├── CNI — how Pods get network                 → /etc/cni/net.d/*.conflist ; /opt/cni/bin ; Calico/Cilium/Flannel
└── CSI — how volumes are attached/mounted     → CSIDriver / CSINode objects ; StorageClass provisioner
```

```bash
# CRI
sudo crictl version && sudo crictl info | head -20
sudo crictl ps -a && sudo crictl pods && sudo crictl images
sudo crictl logs <container-id>
cat /etc/crictl.yaml                       # runtime-endpoint: unix:///run/containerd/containerd.sock

# CNI
ls /etc/cni/net.d/ && ls /opt/cni/bin/
kubectl get pods -n kube-system -l k8s-app=calico-node -o wide

# CSI
kubectl get csidrivers
kubectl get csinodes
kubectl get storageclass -o custom-columns=NAME:.metadata.name,PROV:.provisioner
```
*Why `crictl` and not `docker`:* dockershim was removed in 1.24; the kubelet talks CRI to containerd. `crictl` is the
only way to see and log containers when the API server is down — which is exactly when you need it.

*Why an empty `/etc/cni/net.d` matters:* with no CNI config the kubelet reports
`container runtime network not ready`, the node goes NotReady, and every Pod sticks in `ContainerCreating`. That symptom
chain is worth recognising instantly.

---

## Tree 7 — CRDs and operators

```bash
kubectl get crds
kubectl api-resources --api-group=<group>            # what did this CRD add?
kubectl explain <kind> --recursive | head -40        # the whole schema, offline
kubectl get <plural>.<group> -A                      # list instances of a custom resource
kubectl describe crd <name> | grep -iE 'scope|versions|kind'
```
*Why:* after installing an operator, everything you need is discoverable from the cluster itself. `api-resources` gives
you the short name, the group, and whether the kind is namespaced; `explain --recursive` gives you the field names
without a browser. Together they answer almost any "create a resource of this custom kind" task.

Installing an operator is normally one of:

```bash
kubectl apply -f https://<vendor>/operator.yaml      # bundle: CRDs + RBAC + Deployment
helm install <rel> <repo>/<operator> -n <ns> --create-namespace
```

Then confirm in this order — the sequence is the answer to "the operator isn't working":

```bash
kubectl get crds | grep <group>                      # 1. CRDs registered?
kubectl get pods -n <operator-ns>                    # 2. controller running?
kubectl logs deploy/<operator> -n <operator-ns>      # 3. what is it complaining about?
kubectl get <customkind> -A                          # 4. does it act on instances?
```

<div class="callout warn">

**Trap:** deleting a CRD deletes **every custom resource of that kind**, cluster-wide, immediately. There is no
confirmation.

</div>

---

## Verification habit

```bash
kubectl get nodes                                    # all Ready, all on the target version
kubectl get pods -n kube-system                      # control plane healthy
kubectl auth can-i <verb> <resource> --as=<subject>  # RBAC actually landed
helm list -A                                         # release deployed, right chart version
etcdctl --write-out=table snapshot status <file>     # backup is readable
```
