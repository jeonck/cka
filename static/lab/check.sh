#!/usr/bin/env bash
# kind-cka lab — grade the 12 tasks. One PASS/FAIL line each, with the reason.
#   ./check.sh            # RUNTIME=docker ./check.sh for docker-backed kind
RUNTIME=${RUNTIME:-podman}
kubectl config use-context kind-cka >/dev/null || exit 1
pass=0; fail=0
ok() { echo "PASS  $1"; pass=$((pass+1)); }
no() { echo "FAIL  $1 — $2"; fail=$((fail+1)); }
g()  { kubectl get "$@" 2>/dev/null; }   # a missing object reads as "" rather than an error

# 1 · Deployment with requests
ready=$(g deploy api -n apps -o jsonpath='{.status.readyReplicas}')
req=$(g deploy api -n apps -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}/{.spec.template.spec.containers[0].resources.requests.memory}')
img=$(g deploy api -n apps -o jsonpath='{.spec.template.spec.containers[0].image}')
[[ $ready == 3 && $req == 100m/64Mi ]] && ok "1  api: 3/3 ready, requests 100m/64Mi" || no "1  api" "ready=${ready:-0} requests=${req:-none}"

# 2 · Update then rollback: ≥3 revisions and the image back where it started
revs=$(kubectl rollout history deploy/api -n apps 2>/dev/null | grep -cE '^[0-9]+')
[[ $revs -ge 3 && $img == nginx:1.27-alpine ]] && ok "2  rollback: $revs revisions, image $img" || no "2  rollback" "revisions=$revs image=${img:-none}"

# 3 · Pinned to cka-worker2
node=$(g pod pinned -n apps -o jsonpath='{.spec.nodeName}/{.status.phase}')
[[ $node == cka-worker2/Running ]] && ok "3  pinned on cka-worker2" || no "3  pinned" "node/phase=${node:-missing}"

# 4 · Taint on cka-worker, db tolerates it and lands there
taint=$(g node cka-worker -o jsonpath='{range .spec.taints[*]}{.key}={.value}:{.effect} {end}')
node=$(g pod db -n apps -o jsonpath='{.spec.nodeName}/{.status.phase}')
[[ $taint == *dedicated=db:NoSchedule* && $node == cka-worker/Running ]] && ok "4  taint present, db on cka-worker" || no "4  taint/db" "taints='${taint}' db=${node:-missing}"

# 5 · ClusterIP 8080 → 80 with three endpoints
svc=$(g svc api-svc -n apps -o jsonpath='{.spec.type}:{.spec.ports[0].port}:{.spec.ports[0].targetPort}')
eps=$(g endpoints api-svc -n apps -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w | tr -d ' ')
[[ $svc == ClusterIP:8080:80 && $eps == 3 ]] && ok "5  api-svc ClusterIP 8080→80, 3 endpoints" || no "5  api-svc" "svc=${svc:-missing} endpoints=$eps"

# 6 · NetworkPolicy: granted label gets in, anyone else does not
probe() { kubectl run "np-$RANDOM" -n secure --rm -i --restart=Never --image=busybox:1.36 ${1:+--labels=$1} \
            -- wget -qO- -T 3 http://web >/dev/null 2>&1 </dev/null; }
npol=$(g netpol -n secure -o name | wc -l | tr -d ' ')
if [[ $npol -gt 0 ]] && probe access=granted && ! probe; then ok "6  policy: access=granted allowed, others blocked"
else no "6  policy" "policies=$npol (granted reaches web? $(probe access=granted && echo yes || echo no); unlabelled blocked? $(probe && echo no || echo yes))"; fi

# 7 · PV/PVC bound, file present
pv=$(g pv pv-data -o jsonpath='{.status.phase}')
pvc=$(g pvc pvc-data -n storage -o jsonpath='{.status.phase}/{.spec.volumeName}')
txt=$(kubectl exec data-pod -n storage -- cat /data/hello.txt 2>/dev/null)
[[ $pv == Bound && $pvc == Bound/pv-data && $txt == cka ]] && ok "7  pv-data ↔ pvc-data bound, /data/hello.txt = cka" || no "7  storage" "pv=${pv:-missing} pvc=${pvc:-missing} file='${txt}'"

# 8 · env from ConfigMap and Secret — and actually referenced, not pasted in
env=$(kubectl exec cfg-pod -n apps -- sh -c 'echo $MODE:$DB_PASSWORD' 2>/dev/null)
refs=$(g pod cfg-pod -n apps -o jsonpath='{.spec.containers[0].env[*].valueFrom}')
[[ $env == prod:s3cret && $refs == *app-config* && $refs == *db-secret* ]] && ok "8  cfg-pod: MODE=prod, DB_PASSWORD from db-secret" || no "8  cfg-pod" "env='${env}' valueFrom refs cm/secret? $([[ $refs == *app-config* && $refs == *db-secret* ]] && echo yes || echo no)"

# 9 · RBAC: exactly create+list on deployments
can() { kubectl auth can-i "$1" "$2" -n apps --as=system:serviceaccount:apps:ci 2>/dev/null; }
r="$(can create deployments)/$(can list deployments)/$(can delete pods)/$(can get secrets)/$(can delete deployments)"
[[ $r == yes/yes/no/no/no ]] && ok "9  sa ci: create+list deployments only" || no "9  rbac" "create-deploy/list-deploy/delete-pods/get-secrets/delete-deploy = $r"

# 10 · broken repaired
ready=$(g deploy broken -n trouble -o jsonpath='{.status.readyReplicas}')
eps=$(g endpoints broken-svc -n trouble -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w | tr -d ' ')
[[ $ready == 2 && $eps == 2 ]] && ok "10 broken: 2/2 ready, 2 endpoints" || no "10 broken" "ready=${ready:-0} endpoints=$eps"

# 11 · worker2 Ready
st=$(g node cka-worker2 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
[[ $st == True ]] && ok "11 cka-worker2 Ready" || no "11 cka-worker2" "Ready=${st:-unknown}"

# 12 · snapshot file on the control-plane node
if "$RUNTIME" exec cka-control-plane test -s /var/lib/etcd/backup.db 2>/dev/null; then ok "12 /var/lib/etcd/backup.db present"
else no "12 etcd snapshot" "no non-empty /var/lib/etcd/backup.db on cka-control-plane"; fi

echo
echo "$pass/12 passed"
[[ $fail -eq 0 ]]
