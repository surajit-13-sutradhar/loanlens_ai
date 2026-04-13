import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "sessions.json");

export interface Session {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: "pending" | "opened" | "submitted";
  createdAt: string;
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");
}

export function getSessions(): Session[] {
  ensureFile();
  return JSON.parse(fs.readFileSync(FILE, "utf-8"));
}

export function getSession(id: string): Session | null {
  return getSessions().find((s) => s.id === id) ?? null;
}

export function createSession(session: Session): void {
  const sessions = getSessions();
  sessions.push(session);
  fs.writeFileSync(FILE, JSON.stringify(sessions, null, 2));
}

export function updateSessionStatus(id: string, status: Session["status"]): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx !== -1) {
    sessions[idx].status = status;
    fs.writeFileSync(FILE, JSON.stringify(sessions, null, 2));
  }
}