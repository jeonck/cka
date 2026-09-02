---
title: Storage
domain: storage
weight: 10
order: 5
summary: StorageClasses and dynamic provisioning, volume types, access modes, reclaim policies, PV/PVC binding.
---

# Storage — 10%

The smallest domain, and the one with the tightest failure mode: a PVC that stays `Pending` blocks every Pod that wants
it, and the reason is always one of four things.

**Curriculum competencies:** implement storage classes and dynamic volume provisioning · configure volume types, access
modes and reclaim policies · manage persistent volumes and persistent volume claims.

---

## Tree 1 — PVC is Pending

```
kubectl describe pvc <name>  → read the Events
├── "no persistent volumes available for this claim and no storage class is set"
│   → no matching PV, and storageClassName is "" or absent with no default class
├── "waiting for a volume to be created ... or by the system administrator"
│   → dynamic provisioning: the StorageClass's provisioner isn't running
├── "waiting for first consumer to be created before binding"
│   → volumeBindingMode: WaitForFirstConsumer — NORMAL. Bind happens when a Pod uses it.
└── bound to nothing, a PV exists but is Available
    → a mismatch: size, accessModes, or storageClassName
```

```bash
kubectl get pvc,pv
kubectl describe pvc <name> -n <ns>
kubectl get storageclass
kubectl get sc -o custom-columns=NAME:.metadata.name,PROV:.provisioner,BIND:.volumeBindingMode,RECLAIM:.reclaimPolicy
```
*Why the four-way check:* a PV binds to a PVC only when **capacity ≥ request**, **access modes are a superset**, and
**storageClassName matches exactly** (including the empty string). Any one mismatch leaves both objects sitting there
looking healthy.

<div class="callout warn">

**Trap:** `storageClassName: ""` means "explicitly no class, static binding only" and is **not** the same as omitting
the field, which means "use the default StorageClass". If there's no default class, omitting it leaves the PVC Pending
forever.

</div>

```bash
kubectl get sc -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.storageclass\.kubernetes\.io/is-default-class}{"\n"}{end}'
```

---

## Tree 2 — StorageClass and dynamic provisioning

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: kubernetes.io/no-provisioner     # or a CSI driver name
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
allowVolumeExpansion: true
```

| Field | Choose | Because |
|-------|--------|---------|
| `provisioner` | a CSI driver name | `kubernetes.io/no-provisioner` means *static only* — PVCs will never auto-provision |
| `volumeBindingMode` | `WaitForFirstConsumer` | delays binding until a Pod is scheduled, so the volume lands in the right zone/node |
| | `Immediate` | binds at PVC creation; can strand a volume in a zone with no capacity |
| `reclaimPolicy` | `Delete` | PV and backing storage removed when the PVC goes |
| | `Retain` | PV survives as `Released`; data kept, needs manual cleanup before reuse |
| `allowVolumeExpansion` | `true` | required before you can grow a PVC by editing its request |

*Why `WaitForFirstConsumer` is the safe default:* with `Immediate`, the volume is created before the scheduler has
picked a node. If it lands in a zone the Pod can't be scheduled into, the Pod fails with
`had volume node affinity conflict` — a symptom that reads as scheduling but is caused by storage.

Switching the default class:

```bash
kubectl patch sc standard -p \
  '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
kubectl patch sc fast -p \
  '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```
*Why both patches:* two defaults is an error state — the API accepts it and provisioning becomes non-deterministic.

---

## Tree 3 — Access modes and reclaim policies

| Access mode | Short | Means |
|-------------|-------|-------|
| `ReadWriteOnce` | RWO | read-write by Pods on **one node** |
| `ReadOnlyMany` | ROX | read-only from many nodes |
| `ReadWriteMany` | RWX | read-write from many nodes (needs NFS/CephFS-class backing) |
| `ReadWriteOncePod` | RWOP | read-write by exactly **one Pod**, cluster-wide |

*Why RWO trips people:* it is per-**node**, not per-Pod. Two Pods on the same node can both mount an RWO volume. That's
`ReadWriteOncePod`'s reason to exist.

| Reclaim policy | On PVC deletion |
|----------------|-----------------|
| `Delete` | PV and the underlying storage are deleted |
| `Retain` | PV goes `Released`; data kept; not reusable until the `claimRef` is cleared |
| `Recycle` | deprecated — don't |

Reusing a `Retain`ed PV:

```bash
kubectl patch pv <pv> -p '{"spec":{"claimRef": null}}'
```
*Why:* a `Released` PV still points at its old claim. Clearing `claimRef` returns it to `Available`.

Change a policy in place:

```bash
kubectl patch pv <pv> -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

---

## Tree 4 — Static PV + PVC (the classic exam shape)

No imperative command creates a PV; this is one of the few manifests worth memorising.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata: { name: pv-data }
spec:
  capacity:
    storage: 2Gi
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: pvc-data, namespace: default }
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: manual
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f pv.yaml && kubectl get pv,pvc
```
*Why it binds:* 2Gi ≥ 1Gi, access modes match, and `storageClassName: manual` is identical on both. Change any one and
it stops.

Mount it:

```yaml
spec:
  containers:
    - name: app
      image: nginx
      volumeMounts:
        - name: data
          mountPath: /usr/share/nginx/html
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: pvc-data
```

Generate the Pod skeleton rather than typing it:

```bash
kubectl run app --image=nginx --dry-run=client -o yaml > pod.yaml
kubectl explain pod.spec.volumes.persistentVolumeClaim      # field names, offline
```

---

## Tree 5 — Volume types worth knowing

| Type | Lifetime | Use |
|------|----------|-----|
| `emptyDir` | the Pod | scratch space, sidecar hand-off; `medium: Memory` for tmpfs |
| `hostPath` | the node | node-local files; what exam clusters use for PVs |
| `persistentVolumeClaim` | independent of the Pod | real persistence |
| `configMap` / `secret` | the Pod | config and credentials as files |
| `projected` | the Pod | several sources into one directory |

*Why `emptyDir` matters for drain:* `kubectl drain` refuses to evict Pods with an `emptyDir` unless you pass
`--delete-emptydir-data`, because the data is destroyed. That's a Cluster Architecture task failing for a Storage reason.

Expanding a volume:

```bash
kubectl patch pvc pvc-data -p '{"spec":{"resources":{"requests":{"storage":"5Gi"}}}}'
kubectl get pvc pvc-data -o jsonpath='{.status.capacity.storage}'
```
*Why it may not take effect immediately:* expansion requires `allowVolumeExpansion: true` on the StorageClass, and some
drivers only finish the filesystem resize after the Pod restarts. `status.capacity` is the truth; `spec.resources` is
the request.

---

## Verification habit

```bash
kubectl get pvc -n <ns>                     # STATUS must be Bound
kubectl get pv                              # correct CLAIM, correct RECLAIM POLICY
kubectl describe pod <p> | grep -A5 Mounts  # the volume is actually mounted where asked
kubectl exec <p> -- df -h /path             # and it is the right size
```
