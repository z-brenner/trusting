---
name: Bug report
about: Something does not work as documented
title: ""
labels: bug
assignees: ""
---

**What happened?**
A clear description of the problem.

**What did you expect to happen?**

**Steps to reproduce**
1.
2.
3.

**Environment**
- Trusting version (from `/api/health` or the image tag):
- How you run it (Docker Compose / other):
- Storage driver (`local` / `s3`, which S3 service):
- Reverse proxy (Caddy / nginx / Traefik / none):
- Browser (for UI issues):

**Logs**
Relevant output of `docker compose logs app` (remove secrets, tokens and personal data first).

**Security issues:** please do not report vulnerabilities here. See [SECURITY.md](../../SECURITY.md).
