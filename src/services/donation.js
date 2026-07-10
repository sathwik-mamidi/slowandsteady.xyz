import { redis } from "../redis.js";
import { randomUUID } from "node:crypto";
import { calculateDonation, canDonate, nowSeconds } from "../game.js";
import { getPlayer } from "./player.js";
import { validateGuildName, validateUsername } from "../validation.js";

const LOCK_TTL_MS = 10_000;

async function withDonationLock(username, operation) {
  const key = `lock:donation:${username}`;
  const token = randomUUID();
  const acquired = await redis.set(key, token, { NX: true, PX: LOCK_TTL_MS });
  if (!acquired) return { error: "Donation already in progress" };

  try {
    return await operation();
  } finally {
    await redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      { keys: [key], arguments: [token] },
    ).catch(() => {});
  }
}

/**
 * Donate from one player to another.
 * Returns { success, amount } or { error }.
 */
export async function donateToPlayer(donorUsername, recipientUsername) {
  if (validateUsername(recipientUsername)) return { error: "Invalid recipient" };
  if (donorUsername === recipientUsername) return { error: "Cannot donate to yourself" };

  return withDonationLock(donorUsername, async () => {
    const [donor, recipient] = await Promise.all([
      getPlayer(donorUsername),
      getPlayer(recipientUsername),
    ]);

    if (!donor) return { error: "Donor not found" };
    if (!recipient) return { error: "Recipient not found" };
    if (!canDonate(donor)) return { error: "Not enough progress to donate" };

    const amount = calculateDonation(donor);
    const time = nowSeconds();

    await redis.multi()
      .rPush(`_to:${donorUsername}`, `${recipientUsername}:${amount}:${time}`)
      .rPush(`_from:${recipientUsername}`, `${donorUsername}:${amount}:${time}`)
      .hIncrBy(`player:${recipientUsername}`, "wallet", amount)
      .zIncrBy("leaderboard", amount * 2, donorUsername)
      .hSet(`player:${donorUsername}`, "wallet", "0")
      .hSet(`player:${donorUsername}`, "last_donated", time.toString())
      .hIncrBy(`player:${donorUsername}`, "total_donated", amount)
      .exec();

    return { success: true, amount };
  });
}

/**
 * Donate to all members of a guild (split equally).
 * Returns { success, amount, perMember } or { error }.
 */
export async function donateToGuild(donorUsername, guildName) {
  if (validateGuildName(guildName)) return { error: "Invalid guild" };
  return withDonationLock(donorUsername, async () => {
    const members = await redis.sMembers(`guild-members:${guildName}`);
    if (!members || members.length <= 1) return { error: "Guild has no other members" };
    if (!members.includes(donorUsername)) return { error: "You are not a member of this guild" };

    const donor = await getPlayer(donorUsername);
    if (!donor) return { error: "Donor not found" };
    if (!canDonate(donor)) return { error: "Not enough progress to donate" };

    const amount = calculateDonation(donor);
    const time = nowSeconds();
    const otherMembers = members.filter((m) => m !== donorUsername);
    const perMember = Math.floor(amount / otherMembers.length);

    const transaction = redis.multi()
      .rPush(`_to:${donorUsername}`, `${guildName}::${amount}:${time}`)
      .zIncrBy("leaderboard", amount * 2, donorUsername)
      .hSet(`player:${donorUsername}`, "wallet", "0")
      .hSet(`player:${donorUsername}`, "last_donated", time.toString())
      .hIncrBy(`player:${donorUsername}`, "total_donated", amount);

    for (const member of otherMembers) {
      transaction
        .hIncrBy(`player:${member}`, "wallet", perMember)
        .rPush(`_from:${member}`, `${guildName}::${perMember}:${time}:${donorUsername}`);
    }

    await transaction.exec();

    return { success: true, amount, perMember };
  });
}
