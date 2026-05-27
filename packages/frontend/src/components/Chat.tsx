"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble, { LoadingBubble } from "./MessageBubble";
import ChatInput from "./ChatInput";
import TagChips from "./TagChips";
import UpdateBanner from "./UpdateBanner";
import FavoritesDrawer from "./FavoritesDrawer";
import HistoryDrawer from "./HistoryDrawer";
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
      <div className="flex flex-col h-screen bg-slate-900">
        {/* Header */}
        <div className="flex items-center px-4 py-3 bg-slate-800 border-b border-slate-700">
          <div className="flex-1 text-center">
            <h1 className="text-white font-bold text-lg leading-tight">Asistente de Procedimientos</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="text-slate-400 hover:text-white text-sm px-2 py-1"
              title="Historial"
            >
              🕐
            </button>
            <button
              onClick={() => setShowFavorites(true)}
              className="text-slate-400 hover:text-white text-sm px-2 py-1"
              title="Favoritos"
            >
              ★
            </button>
            <button
              onClick={handleToggleTextSize}
              className="text-slate-400 hover:text-white text-sm px-2 py-1"
              title="Tamaño de texto"
            >
              {textSize === "base" ? "A+" : "A-"}
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
                className="text-slate-500 hover:text-yellow-400 text-sm transition-colors"
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
