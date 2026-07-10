// ============================================================
// SlowAndSteady 2 - Game Client
// ============================================================

// --- Redirect to landing if not logged in ---
if (!localStorage.getItem("client_uid")) {
  window.location.href = "/";
}

// --- Growth titles ---
const TITLES = [
  { min: 0,          label: "Seed",    color: "#6b7280" },
  { min: 100,        label: "Sprout",  color: "#34d399" },
  { min: 10000,      label: "Sapling", color: "#22d3ee" },
  { min: 1000000,    label: "Tree",    color: "#6c63ff" },
  { min: 100000000,  label: "Grove",   color: "#f59e0b" },
  { min: 10000000000, label: "Forest", color: "#ef4444" },
  { min: 1e13,       label: "Ancient", color: "#e879f9" },
];

function getTitle(totalDonated) {
  let title = TITLES[0];
  for (const t of TITLES) {
    if (totalDonated >= t.min) title = t;
  }
  return title;
}

function getNextTitle(totalDonated) {
  return TITLES.find((title) => totalDonated < title.min) || null;
}

// --- State ---
const state = {
  uid: localStorage.getItem("client_uid"),
  username: localStorage.getItem("client_username"),
  data: null,
  friendSearchMode: false,
  guildSearchMode: false,
};

// --- DOM refs ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const balanceEl = $("#balance");
const secondsEl = $("#seconds");
const multiplierEl = $("#multiplier");
const totalEl = $("#total");
const progressFill = $("#progress-fill");
const progressLabel = $("#progress-label");
const myRankEl = $("#my-rank");
const playerTitleEl = $("#player-title");
const donationWaitEl = $("#donation-wait");
const donationWaitCard = $("#donation-wait-card");
const titleGoalEl = $("#title-goal");
const leaderboardSearch = $("#leaderboard-search");
const leaderboardSearchResults = $("#leaderboard-search-results");
const friendSearch = $("#friend-search");
const guildSearch = $("#guild-search");
const createGuildBtn = $("#create-guild-btn");
const randomDonateBtn = $("#random-donate-btn");
const guideBtn = $("#guide-btn");
const modalOverlay = $("#modal-overlay");
const modalClose = $("#modal-close");
const guideModalOverlay = $("#guide-modal-overlay");
const guideModalClose = $("#guide-modal-close");
const guildNameInput = $("#guild-name-input");
const guildPasswordInput = $("#guild-password-input");
const guildCreateSubmit = $("#guild-create-submit");
const toastContainer = $("#toast-container");

// --- WebSocket ---
const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(`${wsProtocol}//${location.host}`);

socket.addEventListener("open", () => {
  socket.send(JSON.stringify({ head: "uid", tail: state.uid }));
});

socket.addEventListener("close", () => {
  showToast("Connection lost. Refresh to reconnect.", "error");
});

socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);

  switch (data.head) {
    case "data":
      handleGameData(data);
      break;
    case "error":
      showToast(data.message, "error");
      break;
    case "auth_error":
      localStorage.removeItem("client_uid");
      localStorage.removeItem("client_username");
      window.location.href = "/";
      break;
  }
});

// --- Game Data ---
function handleGameData(data) {
  if (!state.username && data.username) {
    state.username = data.username;
    localStorage.setItem("client_username", data.username);
  }
  state.data = data;
  renderAll(data);
}

// --- Rendering ---
function renderAll(data) {
  renderLeaderboardSearch(data);
  renderLeaderboard(data);
  renderReceived(data);
  renderSent(data);
  renderFriends(data);
  renderGuilds(data);
  renderStatusBar(data);
}

function renderLeaderboardSearch(data) {
  if (!leaderboardSearchResults) return;

  const query = leaderboardSearch.value.trim();
  if (!query) {
    leaderboardSearchResults.innerHTML = "";
    leaderboardSearchResults.classList.remove("active");
    return;
  }

  const results = (data.friendSearchResults || []).filter((name) => name !== state.username);
  leaderboardSearchResults.classList.add("active");

  if (!results.length) {
    leaderboardSearchResults.innerHTML = `<div class="search-empty">No players found</div>`;
    return;
  }

  leaderboardSearchResults.innerHTML = results
    .map((name) => `
      <div class="search-result">
        <span>${esc(name)}</span>
        <button class="btn-donate" onclick="doLeaderboardDonate('${attr(name)}')">Donate</button>
      </div>`)
    .join("");
}

function renderStatusBar(data) {
  const p = data.player;
  const wallet = parseInt(p.wallet, 10) || 0;
  const totalDonated = parseInt(p.total_donated, 10) || 1;
  const lastDonated = parseInt(p.last_donated, 10) || 0;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - lastDonated;
  const mult = Math.cbrt(totalDonated);
  const amount = Math.floor((wallet + elapsed * mult) / 2);
  const progress = Math.cbrt(totalDonated + amount) - Math.cbrt(totalDonated);
  const progressPct = Math.min(progress, 1);
  const canDonate = progress > 1;

  balanceEl.textContent = formatNumber(wallet);
  secondsEl.textContent = formatDuration(elapsed);
  multiplierEl.textContent = mult.toFixed(2);
  totalEl.textContent = formatNumber(amount * 2);
  progressFill.style.width = `${progressPct * 100}%`;
  progressLabel.textContent = `${(progressPct * 100).toFixed(0)}%`;
  myRankEl.textContent = `Rank #${data.rank}`;
  donationWaitEl.textContent = canDonate ? "ready now" : `${formatDuration(secondsUntilDonation(wallet, totalDonated, elapsed))} left`;
  donationWaitCard.classList.toggle("ready", canDonate);

  // Title
  const title = getTitle(totalDonated);
  playerTitleEl.textContent = title.label;
  playerTitleEl.style.borderColor = title.color;
  playerTitleEl.style.color = title.color;
  renderGrowthTrack(totalDonated);

  const nextTitle = getNextTitle(totalDonated);
  titleGoalEl.textContent = nextTitle
    ? `${nextTitle.label} in ${formatNumber(nextTitle.min - totalDonated)}`
    : "Max title";

  // Enable/disable donate buttons
  $$(".btn-donate").forEach((btn) => {
    btn.disabled = !canDonate;
  });
  randomDonateBtn.disabled = !canDonate;
}

function renderGrowthTrack(totalDonated) {
  $$(".growth-stage").forEach((stage) => {
    const min = Number(stage.dataset.stageMin) || 0;
    stage.classList.toggle("complete", totalDonated >= min);
    stage.classList.toggle("current", getTitle(totalDonated).min === min);
  });
}

function secondsUntilDonation(wallet, totalDonated, elapsed) {
  const requiredAmount = Math.floor(Math.pow(Math.cbrt(totalDonated) + 1, 3) - totalDonated) + 1;
  const requiredElapsed = Math.ceil(Math.max(0, requiredAmount * 2 - wallet) / Math.cbrt(totalDonated));
  return Math.max(0, requiredElapsed - elapsed);
}

function renderLeaderboard(data) {
  const tbody = $("#leaderboard-body");
  if (!data.leaderboard.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No players yet</td></tr>`;
    return;
  }

  tbody.innerHTML = data.leaderboard
    .map((entry) => {
      const isSelf = entry.name === state.username;
      return `
        <tr class="${isSelf ? "self-row" : ""}">
          <td class="rank-cell">#${entry.rank}</td>
          <td>${esc(entry.name)}${isSelf ? " (you)" : ""}</td>
          <td class="score-cell">${formatNumber(entry.score)}</td>
          <td>
            ${isSelf ? "" : `<button class="btn-donate" onclick="doLeaderboardDonate('${attr(entry.name)}')">Donate</button>`}
          </td>
        </tr>`;
    })
    .join("");
}

function renderReceived(data) {
  const tbody = $("#received-body");
  if (!data.fromHistory.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No donations received yet</td></tr>`;
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  tbody.innerHTML = data.fromHistory
    .map((tx) => {
      const label = tx.isGuild
        ? `<span class="guild-tag">${esc(tx.name)}</span>${tx.donor ? ` <span class="time-cell">via ${esc(tx.donor)}</span>` : ""}`
        : esc(tx.name);

      return `
        <tr>
          <td>${label}</td>
          <td class="score-cell">${formatNumber(tx.amount)}</td>
          <td class="time-cell">${timeSince(now - tx.time)} ago</td>
          <td>
            ${tx.isGuild
              ? `<button class="btn-donate" onclick="doHistoryGuildDonate('${attr(tx.name)}')">Donate</button>`
              : `<button class="btn-donate" onclick="doHistoryPlayerDonate('${attr(tx.name)}')">Donate</button>`}
          </td>
        </tr>`;
    })
    .join("");
}

function renderSent(data) {
  const tbody = $("#sent-body");
  if (!data.toHistory.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No donations sent yet</td></tr>`;
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  tbody.innerHTML = data.toHistory
    .map((tx) => {
      const label = tx.isGuild
        ? `<span class="guild-tag">${esc(tx.name)}</span>`
        : esc(tx.name);

      return `
        <tr>
          <td>${label}</td>
          <td class="score-cell">${formatNumber(tx.amount)}</td>
          <td class="time-cell">${timeSince(now - tx.time)} ago</td>
          <td>
            ${tx.isGuild
              ? `<button class="btn-donate" onclick="doHistoryGuildDonate('${attr(tx.name)}')">Donate</button>`
              : `<button class="btn-donate" onclick="doHistoryPlayerDonate('${attr(tx.name)}')">Donate</button>`}
          </td>
        </tr>`;
    })
    .join("");
}

function renderFriends(data) {
  const tbody = $("#friends-body");
  const list = state.friendSearchMode ? data.friendSearchResults : data.friends;

  if (!list || !list.length) {
    const msg = state.friendSearchMode ? "No players found" : "No friends added yet. Use search above.";
    tbody.innerHTML = `<tr><td colspan="2" class="empty-state">${msg}</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((name) => {
      if (state.friendSearchMode) {
        return `
          <tr>
            <td>${esc(name)}</td>
            <td><button class="btn-add" onclick="doAddFriend('${attr(name)}')">Add Friend</button></td>
          </tr>`;
      }
      return `
        <tr>
          <td>${esc(name)}</td>
          <td><button class="btn-donate" onclick="doFriendDonate('${attr(name)}')">Donate</button></td>
        </tr>`;
    })
    .join("");
}

function renderGuilds(data) {
  const tbody = $("#guilds-body");
  const list = state.guildSearchMode ? data.guildSearchResults : data.guilds;

  if (!list || !list.length) {
    const msg = state.guildSearchMode ? "No guilds found" : "No guilds joined yet. Search or create one.";
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">${msg}</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((name) => {
      if (state.guildSearchMode) {
        return `
          <tr>
            <td>${esc(name)}</td>
            <td><input type="password" class="password-input" id="pw-${attr(name)}" placeholder="Password" /></td>
            <td><button class="btn-join" onclick="doJoinGuild('${attr(name)}')">Join</button></td>
          </tr>`;
      }
      return `
        <tr>
          <td>${esc(name)}</td>
          <td></td>
          <td><button class="btn-donate" onclick="doGuildDonate('${attr(name)}')">Donate</button></td>
        </tr>`;
    })
    .join("");
}

// --- Actions ---
window.doLeaderboardDonate = (name) => {
  socket.send(JSON.stringify({ head: "input", tag: "leaderboard_donate", to: name }));
};

window.doHistoryPlayerDonate = (name) => {
  socket.send(JSON.stringify({ head: "input", tag: "from_donate", to: name, isGuild: false }));
};

window.doHistoryGuildDonate = (guildName) => {
  socket.send(JSON.stringify({ head: "input", tag: "from_donate", guildName, isGuild: true }));
};

window.doFriendDonate = (name) => {
  socket.send(JSON.stringify({ head: "input", tag: "friends_donate", to: name }));
};

window.doAddFriend = (name) => {
  socket.send(JSON.stringify({ head: "input", tag: "add_friend", name }));
  friendSearch.value = "";
  state.friendSearchMode = false;
  socket.send(JSON.stringify({ head: "input", tag: "friend_search", query: "" }));
  showToast(`Added ${name} as friend`, "success");
};

window.doGuildDonate = (name) => {
  socket.send(JSON.stringify({ head: "input", tag: "guild_donate", name }));
};

window.doRandomDonate = () => {
  const candidates = getRandomDonationCandidates();
  if (!candidates.length) {
    showToast("No visible players to donate to yet.", "error");
    return;
  }

  const name = candidates[Math.floor(Math.random() * candidates.length)];
  socket.send(JSON.stringify({ head: "input", tag: "leaderboard_donate", to: name }));
  showToast(`Donating to ${name}`, "info");
};

window.doJoinGuild = (name) => {
  const pwInput = document.getElementById(`pw-${name}`);
  const password = pwInput ? pwInput.value : "";
  socket.send(JSON.stringify({ head: "input", tag: "guild_join", name, password }));
  guildSearch.value = "";
  state.guildSearchMode = false;
  socket.send(JSON.stringify({ head: "input", tag: "guild_search", query: "" }));
};

// --- Search ---
friendSearch.addEventListener("input", (e) => {
  const q = e.target.value.trim();
  state.friendSearchMode = q.length > 0;
  socket.send(JSON.stringify({ head: "input", tag: "friend_search", query: q }));
});

leaderboardSearch.addEventListener("input", (e) => {
  const q = e.target.value.trim();
  socket.send(JSON.stringify({ head: "input", tag: "friend_search", query: q }));
});

guildSearch.addEventListener("input", (e) => {
  const q = e.target.value.trim();
  state.guildSearchMode = q.length > 0;
  socket.send(JSON.stringify({ head: "input", tag: "guild_search", query: q }));
});

randomDonateBtn.addEventListener("click", () => {
  window.doRandomDonate();
});

// --- Guide Modal ---
guideBtn.addEventListener("click", () => {
  guideModalOverlay.classList.add("active");
  guideModalClose.focus();
});

guideModalClose.addEventListener("click", closeGuideModal);
guideModalOverlay.addEventListener("click", (e) => {
  if (e.target === guideModalOverlay) closeGuideModal();
});

// --- Guild Modal ---
createGuildBtn.addEventListener("click", () => {
  modalOverlay.classList.add("active");
  guildNameInput.focus();
});

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

guildCreateSubmit.addEventListener("click", () => {
  const name = guildNameInput.value.trim();
  const password = guildPasswordInput.value.trim();
  if (!name) return;
  socket.send(JSON.stringify({ head: "input", tag: "create_guild", name, password }));
  closeModal();
  guildNameInput.value = "";
  guildPasswordInput.value = "";
  showToast(`Guild "${name}" created!`, "success");
});

function closeModal() {
  modalOverlay.classList.remove("active");
}

function closeGuideModal() {
  guideModalOverlay.classList.remove("active");
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeModal();
  closeGuideModal();
});

// --- Toast ---
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// --- Utilities ---
function formatNumber(num) {
  num = Number(num);
  if (isNaN(num)) return "0";
  if (Math.abs(num) < 1000) return num.toString();
  if (Math.abs(num) < 1_000_000) return (num / 1000).toFixed(1) + "K";
  if (Math.abs(num) < 1_000_000_000) return (num / 1_000_000).toFixed(2) + "M";
  return (num / 1_000_000_000).toFixed(3) + "B";
}

function getRandomDonationCandidates() {
  const data = state.data || {};
  const names = new Set();

  for (const entry of data.leaderboardTop || []) names.add(entry.name);
  for (const entry of data.leaderboard || []) names.add(entry.name);
  for (const name of data.friendSearchResults || []) names.add(name);
  for (const name of data.friends || []) names.add(name);

  return [...names].filter((name) => name && name !== state.username);
}

function timeSince(seconds) {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`;
  return `${Math.floor(seconds / 31536000)}y`;
}

function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(Number(seconds) || 0));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`;
  return `${Math.floor(seconds / 31536000)}y`;
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function attr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
