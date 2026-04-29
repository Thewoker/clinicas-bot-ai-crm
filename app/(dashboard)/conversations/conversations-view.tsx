"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, Phone, Send, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ConversationSummary {
  id: string;
  patientPhone: string;
  patientName: string | null;
  lastMessage: string | null;
  updatedAt: string;
  messageCount: number;
}

interface RawBlock {
  type?: string;
  text?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string | RawBlock[];
}

interface ConversationDetail {
  id: string;
  patientPhone: string;
  messages: Message[];
  patient: { id: string; name: string } | null;
  updatedAt: string;
}

function formatPhone(phone: string): string {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

function extractText(content: string | RawBlock[]): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const b of content) {
      if (b.type === "text" && typeof b.text === "string") return b.text;
    }
  }
  return null;
}

export function ConversationsView() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => { sendingRef.current = sending; }, [sending]);

  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    const res = await fetch("/api/conversations");
    if (res.ok) setConversations(await res.json());
    if (!silent) setLoadingList(false);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Poll conversation list every 15s silently, only when tab is visible
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchConversations(true);
    }, 15_000);
    return () => clearInterval(id);
  }, [fetchConversations]);

  // Poll active conversation messages every 5s, only when tab is visible and not sending
  useEffect(() => {
    if (!selectedId) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible" || sendingRef.current) return;
      const res = await fetch(`/api/conversations/${selectedId}`);
      if (!res.ok) return;
      const data: ConversationDetail = await res.json();
      setDetail((prev) => {
        if (!prev || data.messages.length !== prev.messages.length) return data;
        return prev;
      });
    }, 5_000);
    return () => clearInterval(id);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  async function selectConversation(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setDetail(null);
    setSendError(null);
    setLoadingDetail(true);
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) setDetail(await res.json());
    setLoadingDetail(false);
  }

  async function sendMessage() {
    if (!selectedId || !input.trim() || sending) return;
    setSendError(null);
    setSending(true);
    const text = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const res = await fetch(`/api/conversations/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (res.ok) {
      const updated = await res.json();
      setDetail(updated);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, lastMessage: text, updatedAt: new Date().toISOString() }
            : c
        )
      );
    } else {
      const err = await res.json().catch(() => ({}));
      setSendError(err.error ?? "Error al enviar el mensaje");
      setInput(text);
    }
    setSending(false);
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  const visibleMessages = (detail?.messages ?? []).filter(
    (m) => extractText(m.content) !== null
  );

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="-m-6 flex overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Conversation list */}
      <div className="w-72 shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Conversaciones</h1>
            <p className="text-xs text-gray-400">
              {conversations.length} conversación{conversations.length !== 1 ? "es" : ""}
            </p>
          </div>
          <button
            onClick={fetchConversations}
            disabled={loadingList}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sin conversaciones aún</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = selectedId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                    isActive ? "bg-emerald-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-700">
                        {(conv.patientName ?? conv.patientPhone).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isActive ? "text-emerald-700" : "text-gray-800"
                          }`}
                        >
                          {conv.patientName ?? `${formatPhone(conv.patientPhone)}`}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatDistanceToNow(new Date(conv.updatedAt), {
                            locale: es,
                            addSuffix: false,
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {conv.patientName ? `+${conv.patientPhone} · ` : ""}
                        {conv.lastMessage ?? "Sin mensajes"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7 text-emerald-500" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
              Selecciona una conversación
            </h2>
            <p className="text-xs text-gray-400 max-w-xs">
              Elige una de la lista para ver los mensajes e interactuar con el paciente.
            </p>
          </div>
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
          </div>
        ) : detail ? (
          <>
            {/* Header */}
            <div className="px-5 py-3 bg-white border-b border-gray-100 flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-emerald-700">
                  {(detail.patient?.name ?? detail.patientPhone).charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {detail.patient?.name ?? `${formatPhone(detail.patientPhone)}`}
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Phone className="w-3 h-3" />
                  {formatPhone(detail.patientPhone)}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
              {visibleMessages.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-8">Sin mensajes</p>
              ) : (
                visibleMessages.map((msg, idx) => {
                  const text = extractText(msg.content)!;
                  const isUser = msg.role === "user";
                  return (
                    <div key={idx} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[72%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isUser
                            ? "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
                            : "bg-emerald-500 text-white rounded-tr-sm"
                        }`}
                      >
                        {text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0">
              {sendError && (
                <p className="text-xs text-red-500 mb-2">{sendError}</p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400">Error al cargar la conversación</p>
          </div>
        )}
      </div>
    </div>
  );
}
