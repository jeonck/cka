---
title: CKA Curriculum (verbatim)
layout: page.njk
order: 1
---

# CKA Curriculum — v1.35

**Fetched:** 2026-09-02
**Curriculum document:** `CKA_Curriculum_v1.35.pdf`, a Cloud Native Computing Foundation (CNCF) publication
**Source (authoritative):** <https://github.com/cncf/curriculum> → <https://raw.githubusercontent.com/cncf/curriculum/master/CKA_Curriculum_v1.35.pdf>

CNCF states in that repository: *"The document major and minor version… match the version of Kubernetes"*, with the patch
version representing documentation iterations for that Kubernetes version. So **curriculum v1.35 tracks Kubernetes v1.35**.

> Re-check this file's source URL before you book the exam. The curriculum is revised on the Kubernetes release cadence,
> and the January/February 2025 revision changed the competency list substantially even though the domain weights stayed put.

---

## Domain weights

| # | Domain | Weight |
|---|--------|--------|
| 1 | Troubleshooting | **30%** |
| 2 | Cluster Architecture, Installation and Configuration | **25%** |
| 3 | Services and Networking | **20%** |
| 4 | Workloads and Scheduling | **15%** |
| 5 | Storage | **10%** |

Note on wording: the v1.35 PDF prints the third domain's heading as **"20% - Servicing and Networking"**. Every other
CNCF/Linux Foundation surface calls it *Services and Networking*, and the competencies underneath it are service
networking competencies. Treated here as a typo in the PDF; the weight (20%) is unambiguous.

---

## Competencies, transcribed verbatim from the v1.35 PDF

### 30% — Troubleshooting

- Troubleshoot clusters and nodes
- Troubleshoot cluster components
- Monitor cluster and application resource usage
- Manage and evaluate container output streams
- Troubleshoot services and networking

### 25% — Cluster Architecture, Installation and Configuration

- Manage role based access control (RBAC)
- Prepare underlying infrastructure for installing a Kubernetes cluster
- Create and manage Kubernetes clusters using kubeadm
- Manage the lifecycle of Kubernetes clusters
- Implement and configure a highly-available control plane
- Use Helm and Kustomize to install cluster components
- Understand extension interfaces (CNI, CSI, CRI, etc.)
- Understand CRDs, install and configure operators

### 20% — Services and Networking *(printed as "Servicing and Networking")*

- Understand connectivity between Pods
- Define and enforce Network Policies
- Use ClusterIP, NodePort, LoadBalancer service types and endpoints
- Use the Gateway API to manage Ingress traffic
- Know how to use Ingress controllers and Ingress resources
- Understand and use CoreDNS

### 15% — Workloads and Scheduling

- Understand application deployments and how to perform rolling update and rollbacks
- Use ConfigMaps and Secrets to configure applications
- Configure workload autoscaling
- Understand the primitives used to create robust, self-healing, application deployments
- Configure Pod admission and scheduling (limits, node affinity, etc.)

### 10% — Storage

- Implement storage classes and dynamic volume provisioning
- Configure volume types, access modes and reclaim policies
- Manage persistent volumes and persistent volume claims

---

## What changed in the post-2025 revision (and why old guides mislead)

The domain names and percentages are the same as the pre-2025 CKA, which is exactly why stale study guides look correct
and are not. The competency list gained items that did not exist in the older curriculum:

- **Helm and Kustomize** — "Use Helm and Kustomize to install cluster components" (Cluster Architecture)
- **CRDs and operators** — "Understand CRDs, install and configure operators" (Cluster Architecture)
- **Extension interfaces** — "Understand extension interfaces (CNI, CSI, CRI, etc.)" (Cluster Architecture)
- **Gateway API** — "Use the Gateway API to manage Ingress traffic" (Services and Networking)
- **Autoscaling** — "Configure workload autoscaling" (Workloads and Scheduling)

Community reports consistently flag these five as the weak spots of candidates who studied from pre-2025 material. See
[retrospectives](/docs/retrospectives/).

---

## Exam logistics

These figures are widely and consistently reported by community and vendor sources, and by the CNCF study material listed
below. **They were not read from `training.linuxfoundation.org` or `docs.linuxfoundation.org` directly — both domains were
unreachable from the network this site was built on.** Verify against the Linux Foundation's own Candidate Handbook and
exam page before you rely on any of it.

| Item | Reported value |
|------|----------------|
| Format | Performance-based, hands-on tasks in a live cluster environment; remote proctored |
| Duration | 120 minutes |
| Tasks | 15–20 (commonly reported as 16–17) |
| Passing score | 66% |
| Kubernetes version | v1.35 (matches curriculum v1.35) |
| Permitted documentation | Official Kubernetes documentation, in one additional browser tab |
| Simulator | A Killer.sh exam simulator session is included with the exam purchase — 2 sessions, 17 scenarios each, 120-minute run then 36 hours of total access for reviewing solutions |
| Certification validity | Commonly reported as 2 years |

Budget arithmetic that follows from the numbers above: **120 min ÷ ~17 tasks ≈ 7 minutes per task**, including reading the
prompt, switching context, and verifying. That single number drives most of the strategy on this site.

---

## Sources

| Source | URL | Fetched | How |
|--------|-----|---------|-----|
| CNCF curriculum repository | <https://github.com/cncf/curriculum> | 2026-09-02 | direct fetch |
| CKA_Curriculum_v1.35.pdf | <https://raw.githubusercontent.com/cncf/curriculum/master/CKA_Curriculum_v1.35.pdf> | 2026-09-02 | direct download, text extracted |
| techiescamp CKA syllabus notes | <https://github.com/techiescamp/cka-certification-guide/blob/main/SYLLABUS.md> | 2026-09-02 | direct fetch |
| Linux Foundation CKA exam page | <https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/> | 2026-09-02 | **blocked by network egress; not read** |
| Linux Foundation CKA/CKAD/CKS FAQ | <https://docs.linuxfoundation.org/tc-docs/certification/faq-cka-ckad-cks> | 2026-09-02 | **blocked by network egress; not read** |
| Linux Foundation CKA program changes | <https://training.linuxfoundation.org/certified-kubernetes-administrator-cka-program-changes/> | 2026-09-02 | **blocked by network egress; not read** |
| Killer.sh FAQ | <https://killer.sh/faq> | 2026-09-02 | **blocked by network egress**; simulator details via search-result summary |

The domain list and every competency bullet above came from the CNCF PDF itself, not from a summary. The logistics table
did not.
