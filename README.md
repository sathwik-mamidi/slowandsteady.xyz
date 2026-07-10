# Slow and Steady

[slowandsteady.xyz](https://slowandsteady.xyz) is a massively multiplayer idle
game where giving is how you win. Players earn fantasy points over time, donate
them to one another, grow their future earning power, form guilds, and compete
on a shared leaderboard.

## Features

- Real-time gameplay over WebSockets
- Shared Redis-backed leaderboard and player state
- Direct, random, friend, and guild donations
- Optional RediSearch indexes with a standard Redis fallback
- Responsive browser client with no frontend build step

## Run locally

You need Node.js 20 or newer and a running Redis server.

```bash
git clone https://github.com/sathwik-mamidi/slowandsteady.xyz.git
cd slowandsteady.xyz
cp .env.example .env
npm install
npm start
```

Open <http://localhost:3000>. The defaults in `.env.example` work with Redis on
`localhost:6379`.

Redis Stack is optional. If it is available, create the search indexes with:

```bash
npm run setup-indexes
```

Without those indexes, player and guild search automatically uses Redis
`SCAN`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP and WebSocket port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `GAME_TICK_MS` | `2000` | Client state refresh interval |

Keep `.env`, Redis snapshots, private keys, and deployment backups out of Git.
They are ignored by the repository's defensive `.gitignore` rules.

## Tests

```bash
npm test
npm audit --omit=dev
```

## Upgrade note

This public release replaces predictable legacy player IDs with random session
tokens. Existing installations should expect legacy browser sessions to be
invalidated. Guild passwords created by older versions are migrated from the
legacy plaintext field to a scrypt hash the next time the guild is joined.

## Contributing and security

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Please report
security issues privately as described in [SECURITY.md](SECURITY.md).

## License

Released under the [ISC License](LICENSE).
