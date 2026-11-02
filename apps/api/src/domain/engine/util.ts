// Cópia do motor de regras do app (src/data/util.ts). Não edite aqui: altere no app e copie de novo.
// Utilitários puros: ids, datas locais, formatação.

let counter = 0;
let recording: string[] | null = null;
let preset: string[] | null = null;

/** Formato dos ids gerados aqui (o servidor só aceita ids sugeridos neste formato). */
export const ID_PATTERN = /^[a-z]{2,4}_[a-z0-9]{8,32}$/;

export function uid(prefix = 'id'): string {
  const suggested = preset?.shift();
  const id =
    suggested && suggested.startsWith(`${prefix}_`)
      ? suggested
      : `${prefix}_${Date.now().toString(36)}${(counter = (counter + 1) % 1_000_000).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  recording?.push(id);
  return id;
}

/** Executa fn anotando os ids criados (o app envia essa lista ao servidor junto com a operação). */
export function recordIds<T>(fn: () => T): { result: T; ids: string[] } {
  const prev = recording;
  recording = [];
  try {
    const result = fn();
    return { result, ids: recording };
  } finally {
    recording = prev;
  }
}

/** Executa fn usando, na ordem, os ids sugeridos pelo aparelho (servidor). */
export function withIds<T>(ids: string[], fn: () => T): T {
  const prev = preset;
  preset = [...ids];
  try {
    return fn();
  } finally {
    preset = prev;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Data local AAAA-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

export function atTime(key: string, hhmm: string): Date {
  const d = parseDay(key);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function isValidDay(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = parseDay(key);
  return dayKey(d) === key;
}

export function isValidTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatDay(key: string, today = dayKey()): string {
  if (key === today) return 'Hoje';
  if (key === addDays(today, 1)) return 'Amanhã';
  if (key === addDays(today, -1)) return 'Ontem';
  const d = parseDay(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShortDate(key: string): string {
  const d = parseDay(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDay(dayKey(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function money(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const [int, dec] = abs.toFixed(2).split('.');
  return `${sign}R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

export function parseMoney(input: string): number | null {
  const clean = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!clean) return null;
  const v = Number(clean);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

export function pts(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Hash local (FNV-1a 64 em duas metades). Serve apenas para não guardar a senha em
 * texto puro no aparelho no modo local. A API oficial usa bcrypt no servidor.
 */
export function localHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 2246822519) >>> 0;
  }
  return `ff1$${h1.toString(16)}${h2.toString(16)}`;
}

export function randomCode(len = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
