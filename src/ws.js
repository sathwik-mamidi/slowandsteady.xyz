import { WebSocketServer } from "ws";
import { redis } from "./redis.js";
import { config } from "./config.js";
import { normalizeSearchQuery, validateUsername, validateGuildName, validateGuildPassword } from "./validation.js";
import * as playerService from "./services/player.js";
import * as leaderboard from "./services/leaderboard.js";
import * as donation from "./services/donation.js";
import * as guild from "./services/guild.js";
import * as search from "./services/search.js";

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

  wss.on("connection", (ws) => {
    const session = {
      username: null,
      alive: true,
      friendSearch: "",
      guildSearch: "",
      loopTimer: null,
      messageQueue: Promise.resolve(),
    };

    ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        ws.close();
        return;
      }

      session.messageQueue = session.messageQueue
        .then(() => handleMessage(ws, session, data))
        .catch((err) => console.error("WS message error:", err));
    });

    ws.on("close", async () => {
      session.alive = false;
      if (session.loopTimer) clearTimeout(session.loopTimer);
      if (session.username) {
        await playerService.setOffline(session.username).catch(() => {});
      }
    });
  });

  return wss;
}

async function handleMessage(ws, session, data) {
  switch (data.head) {
    case "register":
      return handleRegister(ws, data.tail);

    case "uid":
      return handleAuth(ws, session, data.tail);

    case "input":
      if (!session.username) return;
      return handleInput(ws, session, data);

    default:
      break;
  }
}

async function handleRegister(ws, username) {
  const error = validateUsername(username);
  if (error) {
    return send(ws, { head: "register", tail: "usernamenotallowed", message: error });
  }

  const result = await playerService.register(username);
  if (result.error) {
    return send(ws, { head: "register", tail: "taken" });
  }

  send(ws, { head: "register", tail: result.uid });
}

async function handleAuth(ws, session, uid) {
  if (session.username) return;
  const username = await playerService.getByUid(uid);
  if (!username) return send(ws, { head: "auth_error" });

  session.username = username;
  await playerService.setOnline(username);
  startGameLoop(ws, session);
}

function startGameLoop(ws, session) {
  async function tick() {
    if (!session.alive) return;

    try {
      const data = await gatherGameState(session);
      send(ws, data);
    } catch (err) {
      console.error("Game loop error:", err);
    }

    if (session.alive) {
      session.loopTimer = setTimeout(tick, config.gameTickMs);
    }
  }

  tick();
}

async function gatherGameState(session) {
  const { username } = session;

  const [
    player,
    nearby,
    topEntries,
    fromList,
    toList,
    friends,
    guilds,
    friendSearchResults,
    guildSearchResults,
  ] = await Promise.all([
    playerService.getPlayer(username),
    leaderboard.getNearbyRanks(username),
    leaderboard.getTop(20),
    redis.lRange(`_from:${username}`, -20, -1),
    redis.lRange(`_to:${username}`, -20, -1),
    redis.sMembers(`_friends:${username}`),
    redis.sMembers(`_guilds:${username}`),
    search.searchPlayers(session.friendSearch),
    search.searchGuilds(session.guildSearch),
  ]);

  return {
    head: "data",
    timer: config.gameTickMs,
    username,
    player,
    leaderboard: nearby.entries,
    leaderboardTop: topEntries,
    rank: nearby.rank,
    fromHistory: fromList.reverse().map(parseTransaction),
    toHistory: toList.reverse().map(parseTransaction),
    friends,
    guilds,
    friendSearchResults,
    guildSearchResults,
  };
}

function parseTransaction(raw) {
  // Player donation: "name:amount:timestamp"
  // Guild donation:  "guildname::amount:timestamp" or "guildname::amount:timestamp:donor"
  if (raw.includes("::")) {
    const parts = raw.split("::");
    const guildName = parts[0];
    const rest = parts[1].split(":");
    return {
      name: guildName,
      isGuild: true,
      amount: parseInt(rest[0], 10),
      time: parseInt(rest[1], 10),
      donor: rest[2] || null,
    };
  }

  const parts = raw.split(":");
  return {
    name: parts[0],
    isGuild: false,
    amount: parseInt(parts[1], 10),
    time: parseInt(parts[2], 10),
  };
}

async function handleInput(ws, session, data) {
  const { tag } = data;

  switch (tag) {
    case "leaderboard_donate":
    case "friends_donate": {
      const result = await donation.donateToPlayer(session.username, data.to);
      if (result.error) send(ws, { head: "error", message: result.error });
      break;
    }

    case "from_donate":
    case "to_donate": {
      if (data.isGuild) {
        const result = await donation.donateToGuild(session.username, data.guildName);
        if (result.error) send(ws, { head: "error", message: result.error });
      } else {
        const result = await donation.donateToPlayer(session.username, data.to);
        if (result.error) send(ws, { head: "error", message: result.error });
      }
      break;
    }

    case "add_friend": {
      const nameError = validateUsername(data.name);
      if (nameError) return send(ws, { head: "error", message: nameError });
      if (data.name === session.username) return;
      const player = await playerService.getPlayer(data.name);
      if (!player) return send(ws, { head: "error", message: "Player not found" });
      await redis.sAdd(`_friends:${session.username}`, data.name);
      break;
    }

    case "guild_donate": {
      const result = await donation.donateToGuild(session.username, data.name);
      if (result.error) send(ws, { head: "error", message: result.error });
      break;
    }

    case "guild_join": {
      const nameError = validateGuildName(data.name);
      if (nameError) return send(ws, { head: "error", message: nameError });
      const passError = validateGuildPassword(data.password);
      if (passError) return send(ws, { head: "error", message: passError });
      const result = await guild.joinGuild(data.name, data.password, session.username);
      if (result.error) send(ws, { head: "error", message: result.error });
      break;
    }

    case "create_guild": {
      const nameErr = validateGuildName(data.name);
      if (nameErr) return send(ws, { head: "error", message: nameErr });
      const passErr = validateGuildPassword(data.password);
      if (passErr) return send(ws, { head: "error", message: passErr });
      const result = await guild.createGuild(data.name, data.password, session.username);
      if (result.error) send(ws, { head: "error", message: result.error });
      break;
    }

    case "friend_search": {
      session.friendSearch = normalizeSearchQuery(data.query);
      break;
    }

    case "guild_search": {
      session.guildSearch = normalizeSearchQuery(data.query);
      break;
    }

    default:
      break;
  }
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
