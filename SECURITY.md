# Security Policy

## Supported Versions

Concord is currently in pre-release (0.x). Only the latest published version receives security fixes.

| Version | Supported |
| --- | --- |
| 0.x (latest) | Yes |
| Older 0.x | No — upgrade to the latest release |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **security@codeswhat.com** with:

- A description of the vulnerability
- Steps to reproduce (proof of concept if possible)
- The potential impact
- Any suggested mitigations

You'll receive an acknowledgment within 48 hours. We aim to resolve confirmed vulnerabilities within 90 days.

## Disclosure Policy

Concord follows **90-day coordinated disclosure**:

1. You report privately to security@codeswhat.com
2. We confirm and assess severity within 48 hours
3. We develop and test a fix
4. We publish a patched release
5. You may publicly disclose after the fix is released or 90 days have passed — whichever comes first

If the 90-day window needs to be extended due to complexity, we'll coordinate with you directly.

## Scope

The following are in scope:

- **Authentication and session management** — bypass, session fixation, token leakage
- **Authorization and privilege escalation** — accessing data or actions beyond your permission level
- **Injection attacks** — SQL injection, command injection, SSRF
- **Cross-site scripting (XSS)** — stored or reflected
- **Data exposure** — unintended access to private messages, user data, or server contents
- **WebSocket security** — unauthorized gateway access, event spoofing

Out of scope: denial-of-service against self-hosted instances you control, issues requiring physical access, and social engineering.

## Credit

We're happy to credit researchers who report valid vulnerabilities in the changelog and release notes.
