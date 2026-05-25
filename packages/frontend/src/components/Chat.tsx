"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { sendMessage } from "@/lib/api";
import type { ChatMessage } from "@/lib/api";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hola 👋 Soy el asistente de procedimientos. ¿En qué te puedo ayudar hoy?",
    },
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await sendMessage(message, sessionId);
      if (!sessionId) setSessionId(res.sessionId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, references: res.references },
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

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 text-center">
        <h1 className="text-white font-bold text-lg">Asistente de Procedimientos</h1>
        <p className="text-slate-400 text-sm">Consulta cualquier procedimiento de la empresa</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} references={msg.references} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-slate-700 text-slate-400 rounded-2xl rounded-bl-sm px-4 py-3 text-base">
              Buscando en procedimientos...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
