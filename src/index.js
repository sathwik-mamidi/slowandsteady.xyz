import express from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "./config.js";
import { connectRedis } from "./redis.js";
import { setupWebSocket } from "./ws.js";
import { validateUsername } from "./validation.js";
import * as playerService from "./services/player.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = join(__dirname, "..", "public");

const app = express();
const server = createServer(app);

app.disable("x-powered-by");
app.use(express.static(pub));
app.use(express.json({ limit: "16kb" }));

app.get("/", (req, res) => {
  res.sendFile(join(pub, "index.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(join(pub, "game.html"));
});

// REST registration endpoint for the landing page
app.post("/api/register", async (req, res) => {
  const username = req.body?.username;
  const error = validateUsername(username);
  if (error) return res.status(400).json({ error });

  const result = await playerService.register(username);
  if (result.error === "taken") {
    return res.status(409).json({ error: "Username already taken" });
  }

  res.json({ uid: result.uid, username });
});

async function start() {
  await connectRedis();
  setupWebSocket(server);
  server.listen(config.port, () => {
    console.log(`SlowAndSteady 2 running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
