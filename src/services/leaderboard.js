import { redis } from "../redis.js";

export async function getNearbyRanks(username, range = 10) {
  const rank = await redis.zRevRank("leaderboard", username);
  if (rank === null) return { entries: [], rank: 0 };

  const start = Math.max(0, rank - range);
  const end = rank + range - 1;

  const raw = await redis.zRangeWithScores("leaderboard", start, end, { REV: true });
  const entries = raw.map((entry, i) => ({
    name: entry.value,
    score: entry.score,
    rank: start + i + 1,
  }));

  return { entries, rank: rank + 1 };
}

export async function getTop(count = 20) {
  const raw = await redis.zRangeWithScores("leaderboard", 0, count - 1, { REV: true });
  return raw.map((entry, i) => ({
    name: entry.value,
    score: entry.score,
    rank: i + 1,
  }));
}
