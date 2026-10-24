#!/usr/bin/env bash
# kind-cka lab — build the cluster if it is missing, then (re)seed the 12-task set.
#
#   ./setup.sh                 # podman (default)
#   RUNTIME=docker ./setup.sh
#
# Re-running resets everything a previous attempt left behind, so the same
# cluster can be drilled again. Grade with ./check.sh.
set -euo pipefail
RUNTIME=${RUNTIME:-podman}
export KIND_EXPERIMENTAL_PROVIDER=$RUNTIME
CALICO=${CALICO:-v3.29.3}
NODES="cka-control-plane cka-worker cka-worker2"

if ! kind get clusters 2>/dev/null | grep -qx cka; then
  # kindnet does not enforce NetworkPolicy, so task 6 would silently pass or fail
  # for the wrong reason. Bring the cluster up without a CNI and install Calico.
  kind create cluster --name cka --config - <<'KIND'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true
  podSubnet: 192.168.0.0/16
nodes:
- role: control-plane
- role: worker
- role: worker
KIND
  kubectl apply -f "https://raw.githubusercontent.com/projectcalico/calico/${CALICO}/manifests/calico.yaml"
fi
# A podman/docker machine restart leaves the nodes Exited, and `kind` has no
# "start" verb — so bring them back here rather than making this someone's
# morning debugging session. The published API port is part of the container
# config and survives a start, but refresh the kubeconfig anyway in case it did
# not: a stale port looks exactly like a dead cluster.
stopped=$("$RUNTIME" ps -a --filter label=io.x-k8s.kind.cluster=cka --filter status=exited --format '{{.Names}}')
if [[ -n $stopped ]]; then
  echo "starting stopped nodes: $(echo $stopped | tr '\n' ' ')"
  # shellcheck disable=SC2086
  "$RUNTIME" start $stopped >/dev/null
  kind export kubeconfig --name cka
fi

kubectl config use-context kind-cka
for _ in $(seq 60); do kubectl version >/dev/null 2>&1 && break; sleep 5; done
kubectl version >/dev/null || { echo "the API server never came back — try: kind delete cluster --name cka && ./setup.sh" >&2; exit 1; }

# --- reset ---------------------------------------------------------------------
for n in $NODES; do "$RUNTIME" exec "$n" systemctl start kubelet >/dev/null 2>&1 || true; done
kubectl wait --for=condition=Ready nodes --all --timeout=300s
kubectl taint nodes cka-worker dedicated- >/dev/null 2>&1 || true
kubectl delete ns apps secure storage trouble --ignore-not-found --wait=true
kubectl delete pv pv-data --ignore-not-found
"$RUNTIME" exec cka-control-plane rm -f /var/lib/etcd/backup.db
for n in $NODES; do "$RUNTIME" exec "$n" sh -c 'mkdir -p /mnt/data && rm -rf /mnt/data/*'; done

# --- seed ----------------------------------------------------------------------
# task 11: the kubelet on worker2 goes away. Stopped BEFORE anything is seeded, and
# waited on, because a NotReady node only stops attracting Pods once its
# not-ready taint lands (~40s). Seed first and `web` can be scheduled onto a node
# whose kubelet will never start it, which makes task 6 unsolvable until task 11 is.
"$RUNTIME" exec cka-worker2 systemctl stop kubelet
# A stopped kubelet stops *posting* status, so Ready becomes Unknown rather than
# False and `kubectl wait --for=condition=Ready=false` never fires. Poll instead;
# the not-ready taint lands with the status flip, which is what we are waiting for.
ready_of() { kubectl get node cka-worker2 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'; }
for _ in $(seq 40); do [[ $(ready_of) == True ]] || break; sleep 5; done
[[ $(ready_of) == True ]] && echo "warning: cka-worker2 still Ready — seeded Pods may land there" >&2

for ns in apps secure storage trouble; do kubectl create ns "$ns"; done

# task 6: the workload the policy must protect
kubectl run web -n secure --image=nginx:1.27-alpine --labels=app=web --port=80
kubectl expose pod web -n secure --port=80

# task 10: two faults — a tag that does not exist, and a selector that matches nothing
kubectl create deploy broken -n trouble --image=nginx:1.27-alpin --replicas=2 --port=80
kubectl create svc clusterip broken-svc -n trouble --tcp=80:80
kubectl patch svc broken-svc -n trouble -p '{"spec":{"selector":{"app":"brokn"}}}'

echo
echo "ready — 12 tasks, 40 minutes. Start the clock. Grade with ./check.sh"
