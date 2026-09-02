---
title: Command Cheat Sheet
order: 1
summary: The commands and flags worth memorising, grouped by what you are trying to do.
---

# Command cheat sheet

Everything here is imperative. If a task can be done without opening an editor, do it without opening an editor.

---

## Setup — the first 60 seconds of the exam

```bash
alias k=kubectl
source <(kubectl completion bash)
complete -o default -F __start_kubectl k
export do='--dry-run=client -o yaml'
export now='--force --grace-period=0'
export ns='-n '        # then:  k get po $ns dev

cat >> ~/.vimrc <<'EOF'
set expandtab tabstop=2 shiftwidth=2 number
EOF
```
*Why:* `$do` turns every `create`/`run` into a manifest generator; `set expandtab` prevents literal tabs, which YAML
rejects outright. Community write-ups put the saving at 20–30 minutes across the exam.

Per-task, before anything else:

```bash
kubectl config use-context <given-in-the-task>
kubectl config current-context
```

---

## Discovery — instead of the docs tab

```bash
kubectl api-resources                       # every kind, its group, short name, namespaced?
kubectl api-resources --namespaced=false    # cluster-scoped kinds (PV, node, CRD, ClusterRole)
kubectl explain deploy.spec.template.spec.containers --recursive
kubectl explain networkpolicy.spec --recursive | head -40
kubectl <verb> --help | grep -A2 example    # every kubectl subcommand ships examples
```
*Why:* `explain --recursive` prints the schema from the API server you're connected to — always the right version,
always faster than a browser tab.

---

## Generate, don't author

```bash
kubectl run web --image=nginx $do > pod.yaml
kubectl run web --image=nginx --restart=Never --rm -it -- sh      # throwaway debug Pod
kubectl create deploy web --image=nginx --replicas=3 $do > deploy.yaml
kubectl create job pi --image=perl $do -- perl -Mbignum=bpi -wle 'print bpi(200)'
kubectl create cronjob rep --image=busybox --schedule="*/5 * * * *" $do -- /bin/sh -c date
kubectl expose deploy web --port=80 --target-port=8080 $do > svc.yaml
kubectl create ingress web --rule="host/path*=svc:80" --class=nginx $do
kubectl create configmap cfg --from-literal=k=v $do
kubectl create secret generic s --from-literal=p=x $do
kubectl create role r --verb=get,list --resource=pods $do
kubectl create rolebinding rb --role=r --serviceaccount=ns:sa $do
kubectl create quota q --hard=cpu=2,memory=4Gi $do
kubectl create poddisruptionbudget pdb --selector=app=web --min-available=2 $do
```

<div class="callout" markdown="1">
There is **no** imperative generator for: PersistentVolume, PersistentVolumeClaim, StorageClass, NetworkPolicy,
DaemonSet, StatefulSet, Gateway, HTTPRoute, or tolerations/affinity stanzas. Those four manifests plus the two Gateway
API kinds are the memorisation list — everything else you can generate.
</div>

---

## Inspect

```bash
kubectl get po -A -o wide
kubectl get po --show-labels
kubectl get po -l app=web,tier!=cache
kubectl get po --field-selector status.phase=Running
kubectl get po --sort-by=.status.startTime
kubectl get events -A --sort-by=.lastTimestamp | tail -20
kubectl get po -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IMG:.spec.containers[*].image
kubectl get po <p> -o jsonpath='{.spec.containers[*].image}{"\n"}'
kubectl get no -o json | jq '.items[].status.capacity'
kubectl describe po <p> | sed -n '/Events/,$p'
kubectl top no ; kubectl top po -A --sort-by=memory
```

## Modify without an editor

```bash
kubectl set image deploy/web nginx=nginx:1.27
kubectl set resources deploy/web --requests=cpu=100m --limits=memory=256Mi
kubectl set env deploy/web --from=configmap/cfg
kubectl set serviceaccount deploy/web app-sa
kubectl label node w1 disktype=ssd
kubectl annotate deploy web owner=team-a
kubectl scale deploy/web --replicas=5
kubectl patch deploy web -p '{"spec":{"replicas":4}}'
kubectl patch pv pv1 -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
kubectl patch deploy web --type=json -p='[{"op":"replace","path":"/spec/replicas","value":4}]'
```
*Why two patch types:* a strategic-merge `-p '{...}'` handles most fields; `--type=json` is for list surgery
(add/remove an element at an index) where merge semantics are ambiguous.

## Delete

```bash
kubectl delete po web $now
kubectl delete po -l app=web
kubectl delete all -l app=web -n dev          # NB: "all" ≠ everything; no PVC, no Secret, no CM
kubectl delete -k ./overlays/prod
```

---

## Logs and exec

```bash
kubectl logs <p> -f
kubectl logs <p> --previous
kubectl logs <p> -c <container> --tail=50 --since=10m
kubectl logs -l app=web --all-containers --prefix
kubectl logs <p> | grep ERROR > /opt/answer.txt && cat /opt/answer.txt
kubectl exec -it <p> -- sh
kubectl exec <p> -c <c> -- env
kubectl cp <ns>/<p>:/etc/config/app.conf ./app.conf
kubectl port-forward svc/web 8080:80
kubectl debug -it <p> --image=busybox:1.36 --target=<container>   # ephemeral container
```

---

## Node and cluster lifecycle

```bash
kubectl cordon w1 ; kubectl uncordon w1
kubectl drain w1 --ignore-daemonsets --delete-emptydir-data --force
kubectl get no -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
kubectl taint no w1 key=val:NoSchedule
kubectl taint no w1 key=val:NoSchedule-
kubeadm token create --print-join-command
kubeadm certs check-expiration
kubeadm upgrade plan
kubeadm upgrade apply v1.35.0      # first control-plane node
kubeadm upgrade node               # every other node
```

## On the node, when kubectl is gone

```bash
systemctl status kubelet
journalctl -u kubelet --no-pager -n 50
sudo crictl ps -a
sudo crictl logs <id>
sudo crictl pods
ls /etc/kubernetes/manifests/
sudo ss -lntp | grep 6443
```

## etcd

```bash
export ETCDCTL_API=3
E="--cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key --endpoints=https://127.0.0.1:2379"
etcdctl $E snapshot save /opt/snap.db
etcdctl --write-out=table snapshot status /opt/snap.db
etcdctl $E endpoint health
etcdctl $E member list --write-out=table
etcdctl snapshot restore /opt/snap.db --data-dir=/var/lib/etcd-restore
# then edit /etc/kubernetes/manifests/etcd.yaml: --data-dir AND the hostPath volume
```

## Helm and Kustomize

```bash
helm repo add x <url> && helm repo update
helm search repo x --versions
helm show values x/chart > values.yaml
helm install rel x/chart -n ns --create-namespace --version 1.2.3 -f values.yaml
helm upgrade --install rel x/chart -n ns --set replicaCount=3
helm list -A ; helm history rel -n ns ; helm rollback rel 1 -n ns
helm uninstall rel -n ns
kubectl kustomize ./overlays/prod
kubectl apply -k ./overlays/prod
```

## RBAC checks

```bash
kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:app-sa
kubectl auth can-i --list --as=jane
kubectl auth whoami
```

---

## Flags worth memorising

| Flag | Where | Does |
|------|-------|------|
| `--dry-run=client -o yaml` | create/run/expose | generate a manifest, don't send it |
| `-o wide` | get | node and Pod IP columns |
| `-o jsonpath='{...}'` | get | pull one field for a scripted answer |
| `--sort-by=` | get | `.lastTimestamp`, `.status.startTime`, `memory` |
| `--show-labels` | get | the labels a selector has to match |
| `-l k=v` / `--field-selector` | get/delete | label vs. server-side field filtering |
| `--previous` | logs | the container instance that died |
| `--all-containers` | logs | every container in the Pod |
| `--ignore-daemonsets` | drain | almost always required |
| `--delete-emptydir-data` | drain | required if any Pod has an emptyDir |
| `--force --grace-period=0` | delete | immediate; only when you mean it |
| `--record` | *removed* | don't reach for it; it's gone |
| `-k` | apply/delete | run kustomize first |
| `--as` | any | impersonate, for RBAC verification |
| `-A` / `--all-namespaces` | get | cluster-wide |
