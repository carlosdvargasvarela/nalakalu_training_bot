"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble, { LoadingBubble } from "./MessageBubble";
import ChatInput from "./ChatInput";
import TagChips from "./TagChips";
import UpdateBanner from "./UpdateBanner";
import FavoritesDrawer from "./FavoritesDrawer";
import HistoryDrawer from "./HistoryDrawer";
import { Clock, Star, Type } from "lucide-react";
import {
  sendMessage,
  fetchTags,
  fetchRecentUpdates,
  type ChatMessage,
  type RecentUpdate,
} from "@/lib/api";
import {
  addToHistory,
  addFavorite,
  getTextSize,
  setTextSize,
  isBannerDismissedToday,
  type TextSize,
} from "@/lib/localStorage";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hola 👋 Soy el asistente de procedimientos. ¿En qué te puedo ayudar hoy?",
    },
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [showBanner, setShowBanner] = useState(false);

  const [textSize, setTextSizeState] = useState<TextSize>("base");
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");

  useEffect(() => {
    setTextSizeState(getTextSize());
    fetchTags().then(setTags);
    fetchRecentUpdates().then((updates) => {
      if (updates.length > 0 && !isBannerDismissedToday()) {
        setRecentUpdates(updates);
        setShowBanner(true);
      }
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleToggleTextSize = () => {
    const next: TextSize = textSize === "base" ? "lg" : "base";
    setTextSizeState(next);
    setTextSize(next);
  };

  const handleSend = async (message: string) => {
    addToHistory(message);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await sendMessage(message, sessionId, activeTag ? [activeTag] : undefined);
      if (!sessionId) setSessionId(res.sessionId);

      let answer = res.answer;
      if (res.tagFallback && activeTag) {
        answer += `\n\n*No encontré procedimientos con la etiqueta "${activeTag}"; busqué en todos los documentos.*`;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, references: res.references },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ocurrió un error. Por favor intenta de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteStar = () => {
    const lastAssistant = messages[lastAssistantIdx];
    const lastUser = [...messages].slice(0, lastAssistantIdx).reverse().find((m) => m.role === "user");
    if (!lastAssistant || !lastUser) return;
    addFavorite({
      question: lastUser.content,
      answer: lastAssistant.content,
      tags: activeTag ? [activeTag] : [],
    });
  };

  return (
    <>
      <div className="flex flex-col h-screen bg-app">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-nk-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight whitespace-nowrap">Nalakalu</h1>
            {activeTag && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-medium">
                {activeTag}
                <button
                  onClick={() => setActiveTag(null)}
                  className="hover:text-white leading-none"
                  aria-label={`Quitar filtro ${activeTag}`}
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(true)}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
              aria-label="Historial"
            >
              <Clock size={18} />
            </button>
            <button
              onClick={() => setShowFavorites(true)}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
              aria-label="Favoritos"
            >
              <Star size={18} />
            </button>
            <button
              onClick={handleToggleTextSize}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
              aria-label="Tamaño de texto"
            >
              <Type size={18} />
            </button>
          </div>
        </div>

        {/* Banner de actualización */}
        {showBanner && (
          <UpdateBanner
            updates={recentUpdates}
            onDismiss={() => setShowBanner(false)}
          />
        )}

        {/* Chips de tags */}
        <TagChips tags={tags} activeTag={activeTag} onSelect={setActiveTag} />

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              references={msg.references}
              textLarge={textSize === "lg"}
            />
          ))}
          {loading && <LoadingBubble />}
          {/* Botón de favorito para última respuesta del bot */}
          {!loading && lastAssistantIdx > 0 && (
            <div className="flex justify-start px-1 -mt-2 mb-2">
              <button
                onClick={handleFavoriteStar}
                className="text-muted hover:text-yellow-400 text-sm transition-colors"
                title="Guardar en favoritos"
              >
                ☆ Guardar respuesta
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <ChatInput onSend={handleSend} disabled={loading} />
      </div>

      <FavoritesDrawer
        open={showFavorites}
        onClose={() => setShowFavorites(false)}
        onReask={handleSend}
      />
      <HistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onReask={handleSend}
      />
    </>
  );
}
