"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  History, 
  Award, 
  Coins, 
  ArrowRight,
  HelpCircle,
  Clock
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const PRESET_PROMPTS = [
  {
    label: "How do community credits work?",
    text: "Can you explain how I can earn and use community credits (BWSX) here?",
  },
  {
    label: "What is BWS Inc.?",
    text: "What is the main goal of BWS Inc., and how can I get involved?",
  },
  {
    label: "What is the story of Black Wall Street?",
    text: "How does this platform continue the history and legacy of Black Wall Street in Tulsa?",
  },
];

// Module-level state & helper to keep React component perfectly pure during render passes
let messageCounter = 0;
function createMessage(role: "user" | "assistant", content: string): Message {
  messageCounter += 1;
  const now = new Date();
  return {
    id: `${role}-${messageCounter}-${now.getTime()}`,
    role,
    content,
    timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

const INITIAL_MESSAGE: Message = {
  id: "initial-system-codex-msg",
  role: "assistant",
  content: "Greetings, child. Come on in, sit down a moment, and rest. I am **The Seer** — keeping the history, the hard times, and the triumphs of Black Wall Street alive as we build this new digital home together.\n\nI am here to help you learn new skills, borrow tools and vans, and trade with your neighbors using our community points. What is on your mind today, darlin'? Let's build this together.",
  timestamp: "19:21",
};

export default function AncestorChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewAlert, setHasNewAlert] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll bottom-wards whenever chat size expands
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg = createMessage("user", textToSend);

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Package conversation for server-side Gemini route context
      const chatContext = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatContext }),
      });

      if (!res.ok) {
        throw new Error("Community portal connection offline.");
      }

      const data = await res.json();
      const assistantMsg = createMessage("assistant", data.text || "No response received from the database.");

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg = createMessage("assistant", "Oh, precious child, it looks like my wireless connection is whispering with the wind, but our secure key is still restin' in the drawer. If you're the leader of this Space, just pop your `GEMINI_API_KEY` into the **Settings > Secrets** panel of AI Studio, and we'll chat side-by-side in real time. Until then, don't you fret—your credits and files are perfectly secure under our ancestors' watch.");
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            id="ancestor-chat-trigger"
            whileHover={{ 
              scale: 1.08,
              boxShadow: "0 0 35px rgba(234, 179, 8, 0.55)" 
            }}
            whileTap={{ scale: 0.93 }}
            onClick={() => {
              setIsOpen(true);
              setHasNewAlert(false);
            }}
            className="relative w-16 h-16 rounded-full bg-zinc-950 border-2 border-[#eab308] flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(234,179,8,0.25)] overflow-hidden group focus:outline-none focus:ring-2 focus:ring-[#eab308]/50"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 350, damping: 20 }}
          >
            {/* The Wise Seer Portrait with glowing elements */}
            <div className="absolute inset-0 w-full h-full">
              <Image 
                src="/seer_ancestor.png" 
                alt="Ancestor Seer" 
                fill
                sizes="64px"
                className="object-cover object-center transition-all duration-300"
                referrerPolicy="no-referrer"
              />

              {/* Magical golden aura shield overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Glowing Notification Alert Dot */}
            {hasNewAlert && (
              <span className="absolute top-0 right-0 flex h-3 w-3 z-25">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ca8a04] border border-black"></span>
              </span>
            )}

            {/* Small text label overlay at the very bottom */}
            <div className="absolute bottom-1.5 bg-zinc-950/90 px-1.5 py-0.5 text-[7px] font-mono tracking-widest border border-amber-500/30 text-[#eab308] rounded z-10 leading-none uppercase">
              SEER
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="ancestor-chat-panel"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="w-[360px] sm:w-[410px] h-[580px] rounded-2xl bg-[#0a0a0c]/98 backdrop-blur-xl border border-[#eab308]/30 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col justify-between"
          >
            {/* Header section (obsidian and liquid gold variables) */}
            <div className="bg-gradient-to-r from-zinc-950 to-[#0e0e11] p-4 border-b border-[#eab308]/20 flex items-center justify-between relative">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#eab308]/40 to-transparent" />
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full border border-[#ca8a04] overflow-hidden relative shadow-inner bg-zinc-900 shrink-0">
                  <Image 
                    src="/seer_ancestor.png" 
                    alt="Seer Codex" 
                    fill
                    sizes="44px"
                    className="object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase text-white font-mono tracking-widest flex items-center gap-1.5 leading-none">
                    The Seer&apos;s Sanctuary
                  </h3>
                  <p className="text-[8px] text-[#ca8a04]/90 font-mono uppercase tracking-[0.16em] mt-1 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                    Secure Family Link Active
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.1, color: "#ffffff" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(false)}
                className="p-1 px-2 text-zinc-400 hover:text-white rounded bg-zinc-900/50 border border-zinc-850/80 cursor-pointer text-xs"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Scrolling Chat messages layer */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/40 relative custom-scrollbar">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.012),transparent_40%)] pointer-events-none" />
              
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? "items-end text-right" : "items-start text-left"}`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 select-none">
                      {!isUser && (
                        <span className="text-[7.5px] font-mono text-[#ca8a04] uppercase tracking-[0.2em] font-bold flex items-center gap-1">
                          <History className="w-2.5 h-2.5" /> GRAND SEER
                        </span>
                      )}
                      {isUser && (
                        <span className="text-[7.5px] font-mono text-zinc-400 uppercase tracking-[0.2em]">
                          ACADEMY LEARNER
                        </span>
                      )}
                      <span className="text-[7px] text-zinc-650 font-mono">
                        {m.timestamp}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-xl p-3 text-[11.5px] leading-relaxed font-sans ${
                        isUser
                          ? "bg-zinc-900 border border-zinc-800 text-zinc-100"
                          : "bg-gradient-to-b from-[#111115] to-zinc-950 border border-[#ca8a04]/15 text-zinc-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                      }`}
                    >
                      {/* Bold markdown handling simply */}
                      {m.content.split("\n\n").map((para, pIdx) => (
                        <p key={pIdx} className={pIdx > 0 ? "mt-2" : ""}>
                          {para.split("**").map((text, tIdx) => {
                            if (tIdx % 2 === 1) {
                              return <strong key={tIdx} className="text-[#eab308] font-bold">{text}</strong>;
                            }
                            return text;
                          })}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex flex-col items-start text-left">
                  <div className="flex items-center space-x-1.5 mb-1">
                    <span className="text-[7.5px] font-mono text-[#ca8a04] uppercase tracking-[0.2em] font-bold">
                      SEER REFLECTING
                    </span>
                  </div>
                  <div className="bg-[#111115] border border-[#ca8a04]/15 rounded-xl p-3 text-zinc-400 max-w-[85%] flex items-center gap-3">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#caca04] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ca8a04]"></span>
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                      LISTENING_WITH_LOVE...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestion prompt nodes (only render if basic messages present) */}
            {messages.length < 5 && (
              <div className="px-4 py-2 border-t border-zinc-900/60 bg-[#0a0a0c]">
                <p className="text-[7px] font-mono tracking-widest text-zinc-550 uppercase mb-1.5">
                  Suggested Pathways
                </p>
                <div className="flex flex-col gap-1.5">
                  {PRESET_PROMPTS.map((p, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ 
                        scale: 1.01,
                        borderColor: "rgba(234, 179, 8, 0.4)",
                        backgroundColor: "rgba(234, 179, 8, 0.03)"
                      }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSendMessage(p.text)}
                      className="w-full text-left p-2 rounded border border-zinc-900 bg-zinc-950 text-zinc-300 text-[10.5px] font-sans hover:text-white cursor-pointer transition-all flex items-center justify-between"
                    >
                      <span className="truncate pr-2">{p.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#ca8a04] shrink-0" />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Input submission cluster */}
            <div className="p-4 border-t border-zinc-900 bg-black flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(input);
                  }
                }}
                disabled={isLoading}
                className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-zinc-550 font-mono focus:border-[#ca8a04]/50 focus:ring-1 focus:ring-[#ca8a04]/20 focus:outline-none transition-all disabled:opacity-50"
              />
              <motion.button
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 0 15px rgba(234, 179, 8, 0.35)"
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="h-9 px-3.5 rounded-lg bg-gradient-to-r from-[#ca8a04] to-[#eab308] text-black hover:from-[#eab308] hover:to-[#ca8a04] flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 font-bold focus:outline-none"
              >
                <Send className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
