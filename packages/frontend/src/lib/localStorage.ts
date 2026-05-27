export interface Favorite {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  savedAt: string;
}

export interface HistoryItem {
  question: string;
  askedAt: string;
}

const FAVORITES_KEY = "nalakalu_favorites";
const HISTORY_KEY = "nalakalu_history";
const TEXT_SIZE_KEY = "nalakalu_text_size";
const BANNER_KEY = "nalakalu_banner_dismissed";

export function getFavorites(): Favorite[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addFavorite(item: Omit<Favorite, "id" | "savedAt">): void {
  const favs = getFavorites();
  favs.unshift({
    ...item,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.slice(0, 50)));
}

export function removeFavorite(id: string): void {
  const favs = getFavorites().filter((f) => f.id !== id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

export function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToHistory(question: string): void {
  const history = getHistory().filter((h) => h.question !== question);
  history.unshift({ question, askedAt: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

export type TextSize = "base" | "lg";

export function getTextSize(): TextSize {
  return (localStorage.getItem(TEXT_SIZE_KEY) as TextSize) ?? "base";
}

export function setTextSize(size: TextSize): void {
  localStorage.setItem(TEXT_SIZE_KEY, size);
}

export function isBannerDismissedToday(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return localStorage.getItem(BANNER_KEY) === today;
}

export function dismissBannerToday(): void {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(BANNER_KEY, today);
}
