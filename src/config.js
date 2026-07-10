import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  gameTickMs: parseInt(process.env.GAME_TICK_MS || "2000", 10),
};
