# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's
private vulnerability reporting feature from the repository's **Security** tab
and include reproduction steps, affected versions, and the expected impact.

You should receive an initial response within seven days. Please allow time for
a fix to be prepared before publishing details.

Only the latest version on the default branch is currently supported with
security updates.

## Deployment boundaries

Treat WebSocket messages and browser-stored player tokens as untrusted input.
Public deployments should run behind TLS, restrict Redis to the application
network, set production rate limits, and keep `.env` and Redis snapshots out of
the web root and repository.
