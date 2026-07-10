import badwordsList from "badwords-list";

const badwords = badwordsList.array;

const SAFE_NAME = /^[\p{L}\p{N} ]+$/u;
const MAX_USERNAME_LENGTH = 14;
const MAX_GUILD_NAME_LENGTH = 14;
const MAX_GUILD_PASSWORD_LENGTH = 10;
const MAX_SEARCH_LENGTH = 30;

function validateName(name, label, maxLength) {
  if (typeof name !== "string" || !name.trim()) return `${label} cannot be empty`;
  if (name !== name.trim()) return `${label} cannot start or end with spaces`;
  if (name.length > maxLength) return `${label} must be ${maxLength} characters or less`;
  if (!SAFE_NAME.test(name)) return `${label} may only contain letters, numbers, and spaces`;
  const lower = name.toLowerCase();
  if (badwords.some((word) => lower.includes(word))) return `${label} contains inappropriate language`;
  return null;
}

export function validateUsername(name) {
  return validateName(name, "Username", MAX_USERNAME_LENGTH);
}

export function validateGuildName(name) {
  return validateName(name, "Guild name", MAX_GUILD_NAME_LENGTH);
}

export function validateGuildPassword(password) {
  if (typeof password !== "string" || !password) return "Password cannot be empty";
  if (password.length > MAX_GUILD_PASSWORD_LENGTH) return `Password must be ${MAX_GUILD_PASSWORD_LENGTH} characters or less`;
  return null;
}

export function normalizeSearchQuery(query) {
  if (typeof query !== "string") return "";
  return query.replace(/[^\p{L}\p{N} ]/gu, "").trim().slice(0, MAX_SEARCH_LENGTH);
}
