---
title: Services and Networking
domain: services-networking
examWeight: 20
weight: 3
summary: Pod connectivity, Services and endpoints, NetworkPolicy, Ingress, Gateway API, CoreDNS.
---

# Services and Networking — 20%

The v1.35 curriculum prints this domain's heading as *"Servicing and Networking"*; the weight is 20% and the
competencies are service networking. Gateway API is new here and is examinable **alongside** Ingress, not instead of it.

**Curriculum competencies:** understand connectivity between Pods · define and enforce Network Policies · use ClusterIP,
NodePort, LoadBalancer service types and endpoints · use the Gateway API to manage Ingress traffic · know how to use
Ingress controllers and Ingress resources · understand and use CoreDNS.

---

## Tree 1 — Expose a workload

```
What has to reach it?
├── another Pod, same cluster            → ClusterIP (default)
├── something outside, no cloud LB       → NodePort (<node-ip>:30000-32767)
├── something outside, cloud provider    → LoadBalancer
├── HTTP(S), name/path routing, many apps → Ingress + an Ingress controller
└── HTTP(S) with role separation / richer routing → Gateway API
```

```bash
kubectl expose deploy web --port=80 --target-port=8080            # ClusterIP
kubectl expose deploy web --port=80 --target-port=8080 --type=NodePort
kubectl create service nodeport web --tcp=80:8080 --node-port=30080
kubectl expose deploy web --port=80 --type=LoadBalancer
```
*Why `expose` over authoring:* it copies the Deployment's own labels into the Service selector, which is the field
most often typo'd by hand. `--port` is what the Service listens on; `--target-port` is the container's port.

Confirm the selector actually matched something — this is the whole game:

```bash
kubectl get endpoints web
kubectl get pods --show-labels
```
*Why:* a Service with an empty `ENDPOINTS` list is selecting nothing (label mismatch) or selecting only **unready** Pods.
Endpoints are populated from Pods that are `Ready`, so a failing readiness probe presents as a networking bug.

---

## Tree 2 — NetworkPolicy

```
Policy question
├── Nothing selects the Pod            → all traffic allowed (default is open)
├── A policy selects the Pod
│   ├── policyTypes includes Ingress   → only listed ingress rules allowed; everything else denied
│   └── policyTypes includes Egress    → only listed egress rules allowed; everything else denied
└── Multiple policies select it        → rules are UNIONed (additive; there is no deny rule)
```

Default-deny for a namespace — the shape you must be able to write cold:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: prod }
spec:
  podSelector: {}                 # {} = every Pod in this namespace
  policyTypes: [Ingress, Egress]  # no rules listed = deny all in those directions
```

Allow one app to reach another on one port:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-web-to-db, namespace: prod }
spec:
  podSelector:
    matchLabels: { app: db }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels: { app: web }
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: staging }
      ports:
        - protocol: TCP
          port: 5432
```

<div class="callout warn">

**The list-indentation trap.** Under `from:`, two entries at the same level are **OR** ("web Pods, or anything in
staging"). Putting `namespaceSelector` and `podSelector` under a *single* `-` makes them **AND** ("web Pods that are in
staging"). One dash changes the meaning. Read the task's wording carefully and check your indentation before applying.

</div>

```bash
kubectl get netpol -A
kubectl describe netpol <name> -n <ns>
kubectl explain networkpolicy.spec.ingress --recursive     # faster than the docs tab
```
*Why:* NetworkPolicy is enforced by the CNI plugin. If the CNI doesn't implement it (plain Flannel, for example), your
policy applies cleanly to the API and does nothing — so verify with a connection test, not with `get netpol`.

Test it:

```bash
kubectl run probe --image=busybox:1.36 --rm -it --restart=Never -n prod -- \
  sh -c 'wget -qO- --timeout=2 db:5432 || echo BLOCKED'
```

---

## Tree 3 — DNS / CoreDNS

```
Name resolution failing?
├── nslookup fails for everything      → CoreDNS Pods down, or kubelet clusterDNS wrong
├── fails only for one Service         → wrong name, or the Service has no endpoints
├── fails only cross-namespace         → short name used; needs <svc>.<ns>
└── external names fail, internal work → CoreDNS forward/upstream broken
```

```bash
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n kube-system get svc kube-dns
kubectl -n kube-system get cm coredns -o yaml            # the Corefile
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=30

kubectl run dnsutils --image=busybox:1.36 --rm -it --restart=Never -- \
  nslookup web.prod.svc.cluster.local
```
*Why the fully-qualified name in tests:* a Pod's `/etc/resolv.conf` has a `search` list, so short names resolve only from
namespaces the search list covers. Testing with the FQDN separates "DNS is broken" from "you used the wrong short name".

Names to recall cold:

```
<service>.<namespace>.svc.cluster.local
<statefulset-pod>.<headless-service>.<namespace>.svc.cluster.local
<pod-ip-dashed>.<namespace>.pod.cluster.local
```

A **headless** Service (`clusterIP: None`) returns Pod IPs instead of a virtual IP — that's how StatefulSet members get
stable, individually-addressable names:

```bash
kubectl create service clusterip db --clusterip="None" --tcp=5432:5432
```

---

## Tree 4 — Ingress

```bash
kubectl create ingress web --rule="app.example.com/*=web:80" \
  --class=nginx -n prod
kubectl create ingress multi \
  --rule="example.com/api*=api-svc:8080" \
  --rule="example.com/*=web-svc:80" --class=nginx
kubectl get ingress -A
kubectl describe ingress web -n prod
```
*Why the imperative form matters:* `kubectl create ingress` with `--rule` is far quicker than authoring the nested
`spec.rules[].http.paths[]` tree, and it fills in `pathType` for you.

Rule syntax: `host/path=service:port`. A `*` suffix on the path means `pathType: Prefix`; without it, `Exact`.

```
Ingress not working?
├── kubectl get ingress → no ADDRESS      → no controller is running / wrong ingressClassName
├── ADDRESS present, 404                  → host header or path doesn't match a rule
├── ADDRESS present, 503                  → backend Service has no endpoints (Tree 1)
└── controller logs                       → kubectl logs -n ingress-nginx deploy/ingress-nginx-controller
```
*Why:* an Ingress **object** is inert. A controller must be watching for it; without one, nothing reconciles and the
object sits there looking correct.

---

## Tree 5 — Gateway API

The successor to Ingress, and new to the CKA curriculum. The point is **role separation**: three resources instead of one.

| Resource | Owned by | Says |
|----------|----------|------|
| `GatewayClass` | infrastructure provider | which controller implements gateways |
| `Gateway` | cluster operator | listeners: ports, protocols, hostnames, TLS |
| `HTTPRoute` | application team | matches and backends, attached to a Gateway |

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: { name: prod-gw, namespace: infra }
spec:
  gatewayClassName: nginx
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces: { from: All }
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: web, namespace: prod }
spec:
  parentRefs:
    - name: prod-gw
      namespace: infra
  hostnames: ["app.example.com"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /api }
      backendRefs:
        - name: api-svc
          port: 8080
```

```bash
kubectl get gatewayclass,gateway,httproute -A
kubectl describe gateway prod-gw -n infra      # Status.Conditions: Accepted / Programmed
kubectl describe httproute web -n prod         # Status.Parents: did the Gateway accept it?
kubectl api-resources --api-group=gateway.networking.k8s.io
```
*Why the status fields are the debugging tool:* unlike Ingress, Gateway API reports acceptance explicitly. A route that
didn't attach says so in `status.parents[].conditions` — usually `NotAllowedByListeners` (the Gateway's
`allowedRoutes.namespaces` doesn't permit your namespace) or `NoMatchingParent`.

<div class="callout">

Gateway API CRDs are **not** installed by default. `kubectl get gateway` returning
`the server doesn't have a resource type "gateway"` means the CRDs are missing, not that your YAML is wrong.

</div>

---

## Verification habit

```bash
kubectl get svc,endpoints -n <ns>
kubectl get ingress,gateway,httproute -A
kubectl run probe --image=busybox:1.36 --rm -it --restart=Never -- \
  sh -c 'nslookup <svc>.<ns>; wget -qO- --timeout=2 <svc>.<ns>:<port>'
```
