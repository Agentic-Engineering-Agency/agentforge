# Security Policy

First off, thank you for helping keep AgentForge and its users safe. We take security seriously and appreciate your effort.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.12.x  | Yes                |
| < 0.12  | No                 |

Only the latest minor release receives security patches. We recommend always running the most recent version.

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities through one of these channels:

1. **Email**: [security@agenticengineering.agency](mailto:security@agenticengineering.agency)
2. **GitHub Security Advisories**: [Report a vulnerability](https://github.com/Agentic-Engineering-Agency/agentforge/security/advisories/new)

Include the following in your report:

1. **Description** -- what the vulnerability is and its potential impact
2. **Reproduction steps** -- a minimal set of steps to reproduce the issue
3. **Affected versions** -- which version(s) you tested against
4. **Suggested fix** (optional) -- if you have a patch or mitigation in mind

## Response Timeline

| Stage                  | Target              |
| ---------------------- | ------------------- |
| Acknowledgment         | 48 hours            |
| Critical fix           | 7 days              |
| Non-critical fix       | 30 days             |
| Public disclosure      | 90-day window       |

We follow a **90-day coordinated disclosure** policy. After reporting, we will work with you to understand and resolve the issue. We aim to release a fix before public disclosure, but will disclose within 90 days regardless, unless an extension is mutually agreed upon.

If you have not received an acknowledgment within 48 hours, please follow up.

## Scope

The following are **in scope** for security reports:

- Secret leakage (API keys, tokens, credentials) through public APIs or logs
- Authentication and authorization bypasses in the HTTP channel or dashboard
- Injection vulnerabilities (command injection, prompt injection with security impact)
- Cryptographic weaknesses in vault encryption (AES-256-GCM)
- Dependency vulnerabilities with a clear exploit path in AgentForge

The following are **out of scope**:

- Vulnerabilities in upstream dependencies without a demonstrated exploit in AgentForge
- Denial of service through expected resource consumption
- Social engineering attacks
- Issues in third-party LLM providers

## Security Design Principles

AgentForge follows these security principles:

- **Secrets never in plaintext at rest** -- API keys are encrypted with AES-256-GCM in the Convex vault; tokens are stored as SHA-256 hashes
- **Internal-only sensitive operations** -- pattern detection, secret censoring, and crypto operations use Convex `internalMutation`/`internalAction`, never public endpoints
- **Node.js for crypto** -- all encryption runs in Node.js actions (`node:crypto`), never in the V8 runtime
- **Minimal public surface** -- public mutations return only the minimum data needed (e.g., `censorText` returns boolean, not pattern names)
- **Rate limiting** -- HTTP channel endpoints enforce per-IP rate limits

## Credit

We believe in recognizing the security community's contributions. Unless you prefer to remain anonymous, we will credit reporters in our release notes and in a dedicated section of our changelog. If you would like to be credited under a specific name or handle, let us know in your report.
