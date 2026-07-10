import { redis } from "../redis.js";
import { nowSeconds } from "../game.js";
import { createSessionToken, isSessionToken } from "../security.js";

export async function register(username) {
  const uid = createSessionToken();
  const time = nowSeconds();
  const reserved = await redis.zAdd("leaderboard", { score: 1, value: username }, { NX: true });
  if (!reserved) return { error: "taken" };

  try {
    await redis.multi()
      .hSet("uid", uid, username)
      .hSet(`player:${username}`, {
        username,
        created_on: Date.now().toString(),
        wallet: "0",
        last_donated: time.toString(),
        total_donated: "1",
        uid,
      })
      .exec();
  } catch (error) {
    await redis.zRem("leaderboard", username).catch(() => {});
    throw error;
  }

  return { uid };
}

export async function getByUid(uid) {
  if (!isSessionToken(uid)) return null;
  const username = await redis.hGet("uid", uid);
  if (!username) return null;
  return username;
}

export async function getPlayer(username) {
  const data = await redis.hGetAll(`player:${username}`);
  if (!data || !data.username) return null;
  return data;
}

export async function setOnline(username) {
  await redis.sAdd("online", username);
}

export async function setOffline(username) {
  await redis.sRem("online", username);
}
