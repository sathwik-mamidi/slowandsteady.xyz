import { createClient } from "redis";
import { config } from "./config.js";

export const redis = createClient({ url: config.redisUrl });

redis.on("error", (err) => console.error("Redis error:", err));

export async function connectRedis() {
  await redis.connect();
  console.log("Redis connected");
  // Clear online set on server start (stale connections)
  await redis.del("online");
}
