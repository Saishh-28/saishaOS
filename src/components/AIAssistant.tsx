import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  RefreshCw, 
  Terminal, 
  Coffee, 
  Heart,
  ChevronDown,
  Compass,
  CheckCircle2
} from "lucide-react";
import { ChatMessage, SaishaOSState } from "../types";
import { supabase } from "../supabase";

interface AIAssistantProps {
  osState: SaishaOSState;
  onUpdateChatHistory: (chatHistory: ChatMessage[]) => void;
  onTasksCreated?: (createdTasks: any[]) => void;
}

const QUICK_SPARKS = [
  "Add a task to update my CV",
  "Add a career task to research AI internships in Auckland",
  "Add a task to finish my STATS 782 assignment",
  "Add three tasks: update CV, research internships, and prepare my portfolio"
];

export default function AIAssistant({ osState, onUpdateChatHistory, onTasksCreated }: AIAssistantProps) {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [osState.chatHistory]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: "msg-" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const updatedHistory = [...osState.chatHistory, userMsg];
    onUpdateChatHistory(updatedHistory);
    setInputText("");
    setLoading(true);

    try {
      // Get current auth session token if available
      let authToken: string | undefined;
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        authToken = sessionData?.session?.access_token;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const supabaseUrl = (((import.meta as any).env?.VITE_SUPABASE_URL) || "").trim();
      const supabaseAnonKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || "").trim();
      if (supabaseUrl) {
        headers["x-supabase-url"] = supabaseUrl;
      }
      if (supabaseAnonKey) {
        headers["x-supabase-anon-key"] = supabaseAnonKey;
      }

      const response = await fetch("/api/saisha/interact", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: updatedHistory,
          osState: osState
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to communicate with Saisha OS Core.");
      }

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: "msg-ai-" + Date.now(),
        sender: "saisha_ai",
        text: data.text || "I am here, Creator. Dialogue processed.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      onUpdateChatHistory([...updatedHistory, aiMsg]);

      // If tasks were created in the database, notify the parent application to update state
      if (data.createdTasks && data.createdTasks.length > 0 && onTasksCreated) {
        onTasksCreated(data.createdTasks);
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: "msg-err-" + Date.now(),
        sender: "saisha_ai",
        text: `Error connecting to core: ${err.message || "Ensure your GEMINI_API_KEY is configured in Settings > Secrets."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      onUpdateChatHistory([...updatedHistory, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (!confirm("Are you sure you want to clear your current dialogue? Your daily state log remains secure.")) return;
    const userName = osState.user.name || "Creator";
    onUpdateChatHistory([
      {
        id: "init-1",
        sender: "saisha_ai",
        text: `Dialogue rebooted. Systems online. How can I facilitate your alignment today, ${userName}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  return (
    <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden h-[600px] flex flex-col justify-between">
      {/* AI Assistant Header */}
      <div className="p-4 bg-white/3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center relative">
            <span className="absolute inset-0 rounded-full bg-amber-400/10 animate-ping" />
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-semibold text-white">Saisha OS Core AI</h3>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-gray-400">Contextual Companion (Active)</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
          title="Clear dialog logs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {osState.chatHistory.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                isUser 
                  ? "bg-violet-500/10 text-violet-300 border border-violet-500/20" 
                  : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
              }`}>
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-1 max-w-[80%]">
                <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isUser 
                    ? "bg-violet-500/10 border border-violet-500/10 text-violet-100 rounded-tr-none" 
                    : "bg-white/3 border border-white/5 text-gray-100 rounded-tl-none font-sans"
                }`}>
                  {/* Clean Markdown render support for bullet points & code formatting */}
                  <div className="whitespace-pre-wrap select-text selection:bg-amber-400/30">
                    {msg.text}
                  </div>
                </div>
                <span className="text-[9px] font-mono text-gray-500 block text-right">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="p-3 bg-white/3 border border-white/5 text-xs text-gray-400 rounded-2xl rounded-tl-none italic flex items-center gap-2">
              <span>JARVIS is compiling your digital state...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggested sparks list */}
      <div className="px-4 py-2 border-t border-white/5 space-y-1.5 bg-white/1">
        <span className="text-[9px] font-mono uppercase tracking-wider text-amber-300/60 block">Context Sparks</span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_SPARKS.map((spark, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(spark)}
              className="text-[10px] bg-white/2 hover:bg-white/5 border border-white/5 hover:border-amber-400/20 px-2.5 py-1 rounded-full text-gray-300 transition-all font-sans"
            >
              {spark}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="p-3 bg-white/2 border-t border-white/5 flex gap-2 items-center"
      >
        <input
          type="text"
          placeholder="Ask JARVIS / speak to your OS core..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-4 py-2.5 text-xs glass-input focus:ring-1 focus:ring-amber-400/30"
          disabled={loading}
        />
        <button
          type="submit"
          className="p-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-200 border border-amber-500/20 rounded-xl hover:from-amber-500/30 hover:to-orange-500/30 transition-all shrink-0"
          disabled={loading}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
