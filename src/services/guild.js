import { redis } from "../redis.js";
import { hashPassword, verifyPassword } from "../security.js";

export async function createGuild(name, password, ownerUsername) {
  const key = `guild:${name}`;
  const reserved = await redis.hSetNX(key, "name", name);
  if (!reserved) return { error: "Guild already exists" };

  try {
    const passwordHash = await hashPassword(password);
    await redis.multi()
      .hSet(key, { password_hash: passwordHash, owner: ownerUsername })
      .sAdd(`guild-members:${name}`, ownerUsername)
      .sAdd(`_guilds:${ownerUsername}`, name)
      .exec();
  } catch (error) {
    await redis.del(key).catch(() => {});
    throw error;
  }

  return { success: true };
}

export async function joinGuild(name, password, username) {
  const guild = await redis.hGetAll(`guild:${name}`);
  if (!guild || !guild.name) return { error: "Guild not found" };

  let passwordMatches = false;
  if (guild.password_hash) {
    passwordMatches = await verifyPassword(password, guild.password_hash);
  } else if (guild.password && guild.password === password) {
    passwordMatches = true;
    const passwordHash = await hashPassword(password);
    await redis.multi().hSet(`guild:${name}`, "password_hash", passwordHash).hDel(`guild:${name}`, "password").exec();
  }
  if (!passwordMatches) return { error: "Wrong password" };

  await Promise.all([
    redis.sAdd(`guild-members:${name}`, username),
    redis.sAdd(`_guilds:${username}`, name),
  ]);

  return { success: true };
}

export async function getPlayerGuilds(username) {
  return redis.sMembers(`_guilds:${username}`);
}

export async function getGuildMembers(name) {
  return redis.sMembers(`guild-members:${name}`);
}
