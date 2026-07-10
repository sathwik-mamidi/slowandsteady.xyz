import { redis } from "../redis.js";

let searchAvailable = null;

async function isSearchAvailable() {
  if (searchAvailable !== null) return searchAvailable;
  try {
    await redis.sendCommand(["FT._LIST"]);
    searchAvailable = true;
  } catch {
    searchAvailable = false;
    console.log("RediSearch not available, using SCAN-based search fallback");
  }
  return searchAvailable;
}

export async function searchPlayers(prefix, limit = 20) {
  if (!prefix) return [];

  if (await isSearchAvailable()) {
    try {
      const result = await redis.sendCommand([
        "FT.SEARCH", "idx:player", `${prefix}*`,
        "LIMIT", "0", String(limit),
        "RETURN", "1", "username",
      ]);
      return parseSearchResults(result, "player:");
    } catch {
      // Fall back to SCAN if index doesn't exist
    }
  }

  return scanSearch("player:", prefix, limit);
}

export async function searchGuilds(prefix, limit = 20) {
  if (!prefix) return [];

  if (await isSearchAvailable()) {
    try {
      const result = await redis.sendCommand([
        "FT.SEARCH", "idx:guild", `${prefix}*`,
        "LIMIT", "0", String(limit),
        "RETURN", "1", "name",
      ]);
      return parseSearchResults(result, "guild:");
    } catch {
      // Fall back to SCAN if index doesn't exist
    }
  }

  return scanSearch("guild:", prefix, limit);
}

function parseSearchResults(result, keyPrefix) {
  // FT.SEARCH returns [totalCount, key1, [field, value, ...], key2, ...]
  const names = [];
  for (let i = 1; i < result.length; i += 2) {
    const key = String(result[i]);
    if (key.startsWith(keyPrefix)) {
      names.push(key.slice(keyPrefix.length));
    }
  }
  return names;
}

async function scanSearch(prefix, query, limit) {
  const results = [];
  let cursor = "0";
  const lowerQuery = query.toLowerCase();

  do {
    const [nextCursor, keys] = await redis.sendCommand([
      "SCAN", cursor, "MATCH", `${prefix}*`, "COUNT", "100",
    ]);
    cursor = nextCursor;

    for (const key of keys) {
      const name = key.slice(prefix.length);
      if (name.toLowerCase().startsWith(lowerQuery)) {
        results.push(name);
        if (results.length >= limit) return results;
      }
    }
  } while (cursor !== "0" && results.length < limit);

  return results;
}
