/**
 * Creates RediSearch indexes for player and guild search.
 * Requires Redis Stack (redis-stack-server) or the RediSearch module.
 *
 * Run once: npm run setup-indexes
 */
import "dotenv/config";
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });

async function setup() {
  await redis.connect();
  console.log("Connected to Redis");

  // Drop existing indexes (ignore errors if they don't exist)
  for (const idx of ["idx:player", "idx:guild"]) {
    try {
      await redis.sendCommand(["FT.DROPINDEX", idx]);
      console.log(`Dropped existing index: ${idx}`);
    } catch {
      // Index didn't exist, that's fine
    }
  }

  // Create player search index
  await redis.sendCommand([
    "FT.CREATE", "idx:player",
    "ON", "HASH",
    "PREFIX", "1", "player:",
    "SCHEMA", "username", "TEXT", "SORTABLE",
  ]);
  console.log("Created index: idx:player");

  // Create guild search index
  await redis.sendCommand([
    "FT.CREATE", "idx:guild",
    "ON", "HASH",
    "PREFIX", "1", "guild:",
    "SCHEMA", "name", "TEXT", "SORTABLE",
  ]);
  console.log("Created index: idx:guild");

  await redis.quit();
  console.log("Done. Indexes will automatically index existing and new data.");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
