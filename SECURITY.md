# Security policy

Report vulnerabilities privately through [GitHub’s reporting form](https://github.com/BkashJEE/hermes-agent-archive/security/advisories/new). Include the affected commit or URL, reproduction steps, impact and a proposed fix if available. Do not put secrets, personal data or exploit details in a public issue.

If the private form is unavailable, open an issue asking for a private contact without including vulnerability details. There is no guaranteed response time or paid bug bounty. BkashJEE coordinates reports and publication of fixes.

## Scope and support

The maintained target is the current `main` branch. Older forks and deployments may need to update. The archive is a static website, with no visitor account or submission endpoint. GitHub issues and pull requests are reviewed proposals; they cannot edit the hosted site directly.

The local preview binds to `127.0.0.1` and serves only configured public data and assets. Do not expose it as a production server. Keep `.env`, API tokens, Vercel credentials and personal analytics exports out of version control. Optional maintenance scripts use credentials locally; the browser does not need them.

A listed repository, quoted command or skill is not a security endorsement. This project does not audit or execute listed projects. Inspect upstream code and permissions before installing anything, and use a sandbox for unfamiliar commands. Only test security issues against your own local copy; this policy does not authorize testing other projects or third-party services.

Contributions must not add workflows that execute untrusted pull-request code with secrets or deployment permissions. Validation runs without repository secrets. Production publication requires the owner's decision.
