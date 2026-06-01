# Security Policy

QTP is in early development and should not be treated as production-hardened software yet.

## Supported Versions

Security fixes target the current `main` branch unless a release branch is explicitly announced.

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities that expose secrets, authentication bypasses, data loss, or remote code execution.

Use a private maintainer contact when one is published. If no private channel is available yet, open a minimal public issue that says you have a security report to share, without exploit details.

Include:

- Affected version or commit.
- Impact.
- Reproduction steps.
- Logs or screenshots with secrets removed.
- Suggested fix, if known.

## Scope

Security reports are most useful when they involve:

- Authentication or session handling.
- Secret leakage.
- Unsafe file or network access.
- Dependency vulnerabilities with a reachable exploit path.
- Data exposure in seeded or imported test assets.

General hardening suggestions are welcome as normal issues.
