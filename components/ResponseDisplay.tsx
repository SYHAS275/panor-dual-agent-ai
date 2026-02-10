"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/app/page";
import { useTTS, PROVIDER_NAMES, TTSProvider } from "@/lib/hooks/useTTS";

interface ResponseDisplayProps {
  result: AnalysisResult;
  isStreaming: boolean;
  onReset: () => void;
}

function TabLoader({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className={`w-10 h-10 rounded-full border-2 border-transparent animate-spin mb-4`}
        style={{ borderTopColor: color, borderRightColor: color }}
      />
      <p className="text-sm text-white/30">{label}</p>
      <div className="typing-dots mt-3">
        <span /><span /><span />
      </div>
    </div>
  );
}

// Audio playback button component
function AudioButton({
  text,
  tts,
  color
}: {
  text: string;
  tts: ReturnType<typeof useTTS>;
  color: string;
}) {
  const { isPlaying, isLoading, speak, stop, availableProviders, currentProvider } = tts;

  const handleClick = () => {
    if (isLoading) return;
    if (isPlaying) {
      stop();
    } else {
      speak(text);
    }
  };

  const isBusy = isLoading || isPlaying;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isLoading
            ? "bg-white/10 text-white/40 cursor-not-allowed"
            : isPlaying
            ? "bg-white/20 text-white"
            : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
        }`}
        title={isLoading ? "Loading audio..." : isPlaying ? "Stop audio" : "Listen to response"}
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : isPlaying ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
        )}
        {isLoading ? "Loading..." : isPlaying ? "Stop" : "Listen"}
      </button>
      {currentProvider && isPlaying && (
        <span className="text-[10px] text-white/30">
          via {PROVIDER_NAMES[currentProvider]}
        </span>
      )}
    </div>
  );
}

export default function ResponseDisplay({ result, isStreaming, onReset }: ResponseDisplayProps) {
  const [activeTab, setActiveTab] = useState<"best" | "gemini" | "chatgpt">("best");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const tts = useTTS();

  const tabs = [
    { id: "best" as const, label: "Best Answer", badge: "badge-green", icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { id: "gemini" as const, label: "Gemini", badge: "badge-cyan", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
    { id: "chatgpt" as const, label: "ChatGPT", badge: "badge-purple", icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" },
  ];

  const isImageFile = () => {
    if (!result.file) return false;
    const ext = result.file.name.split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg"].includes(ext);
  };

  // Auto-switch to the first available tab if current is still loading
  const geminiReady = !!result.responses.gemini;
  const chatgptReady = !!result.responses.chatgpt;
  const summaryReady = !!result.responses.summary;

  return (
    <div className="space-y-6">
      {/* Info Bar */}
      <div className="glass-card rounded-2xl p-4 animate-fade-in-up">
        <div className="flex flex-wrap items-center gap-4">
          {result.file ? (
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                isImageFile() ? "bg-pink-500/10 text-pink-400" : "bg-[#00e5ff]/10 text-[#00e5ff]"
              }`}>
                {result.file.name.split(".").pop()?.toUpperCase() || "FILE"}
              </div>
              <div>
                <p className="text-sm font-medium text-white/80 truncate max-w-[200px]">{result.file.name}</p>
                <p className="text-xs text-white/20">{(result.file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#8b5cf6]/10">
                <svg className="w-4 h-4 text-[#8b5cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-white/20 uppercase tracking-wider">Text Query</p>
              </div>
            </div>
          )}

          <div className="divider-glow hidden sm:block w-px h-8" />

          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/20 uppercase tracking-wider mb-0.5">Question</p>
            <p className="text-sm text-white/60 truncate">{result.question}</p>
          </div>

          {isStreaming && (
            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full animate-pulse">
              Streaming...
            </span>
          )}

          {/* TTS Toggle */}
          <button
            onClick={() => {
              if (tts.isPlaying) tts.stop();
              setTtsEnabled(!ttsEnabled);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              ttsEnabled
                ? "bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/30"
                : "bg-white/5 text-white/40 border-white/10 hover:text-white/60"
            }`}
            title={ttsEnabled ? "Audio enabled - click to disable" : "Audio disabled - click to enable"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {ttsEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
              )}
            </svg>
            {ttsEnabled ? "Audio On" : "Audio Off"}
          </button>

          {!isStreaming && (
            <button
              onClick={onReset}
              className="text-xs text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all px-4 py-1.5 rounded-lg shadow-sm flex-shrink-0"
            >
              Start New Analysis
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 glass-card rounded-xl w-fit mx-auto animate-fade-in-up stagger-1">
        {tabs.map((tab) => {
          const isReady =
            tab.id === "best" ? summaryReady :
            tab.id === "gemini" ? geminiReady :
            chatgptReady;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-white/[0.06] text-white"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
              {isReady && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
              {!isReady && isStreaming && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Best Answer */}
      {activeTab === "best" && (
        <div className="animate-scale-in">
          <div className="glass-card rounded-2xl p-8 best-answer-glow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Best Combined Answer
                  <span className="badge badge-green text-[10px]">Fused</span>
                </h3>
                {summaryReady && (
                  <p className="text-xs text-white/20">
                    Combined from Gemini &amp; ChatGPT by {result.responses.summary!.model}
                  </p>
                )}
              </div>
            </div>
            <div className="divider-glow mb-6" />
            {summaryReady ? (
              <>
                {ttsEnabled && (
                  <div className="mb-4">
                    <AudioButton text={result.responses.summary!.text} tts={tts} color="#10b981" />
                  </div>
                )}
                <div className="response-text whitespace-pre-wrap text-sm">
                  {result.responses.summary!.text}
                </div>
              </>
            ) : (
              <TabLoader label="Waiting for both models to finish, then fusing..." color="#10b981" />
            )}
          </div>
        </div>
      )}

      {/* Gemini Tab */}
      {activeTab === "gemini" && (
        <div className="animate-scale-in">
          <div className="glass-card rounded-2xl p-8 neon-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00e5ff]/20 to-[#00e5ff]/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#00e5ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Gemini Response
                  {geminiReady && (
                    <span className="badge badge-cyan text-[10px]">{result.responses.gemini!.model}</span>
                  )}
                </h3>
                <p className="text-xs text-white/20">Independent analysis from Google Gemini</p>
              </div>
            </div>
            <div className="divider-glow mb-6" />
            {geminiReady ? (
              <>
                {ttsEnabled && (
                  <div className="mb-4">
                    <AudioButton text={result.responses.gemini!.text} tts={tts} color="#00e5ff" />
                  </div>
                )}
                <div className="response-text whitespace-pre-wrap text-sm">
                  {result.responses.gemini!.text}
                </div>
              </>
            ) : (
              <TabLoader label="Querying Gemini Flash..." color="#00e5ff" />
            )}
          </div>
        </div>
      )}

      {/* ChatGPT Tab */}
      {activeTab === "chatgpt" && (
        <div className="animate-scale-in">
          <div className="glass-card rounded-2xl p-8 neon-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6]/20 to-[#8b5cf6]/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#8b5cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  ChatGPT Response
                  {chatgptReady && (
                    <span className="badge badge-purple text-[10px]">{result.responses.chatgpt!.model}</span>
                  )}
                </h3>
                <p className="text-xs text-white/20">Independent analysis from OpenAI ChatGPT</p>
              </div>
            </div>
            <div className="divider-glow mb-6" />
            {chatgptReady ? (
              <>
                {ttsEnabled && (
                  <div className="mb-4">
                    <AudioButton text={result.responses.chatgpt!.text} tts={tts} color="#8b5cf6" />
                  </div>
                )}
                <div className="response-text whitespace-pre-wrap text-sm">
                  {result.responses.chatgpt!.text}
                </div>
              </>
            ) : (
              <TabLoader label="Querying GPT-4o..." color="#8b5cf6" />
            )}
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="text-center animate-fade-in stagger-3">
        <p className="text-xs text-white/15">
          {isStreaming
            ? "Responses appear in real-time as each model finishes"
            : "Switch tabs to compare individual AI responses against the fused best answer"}
        </p>
      </div>
    </div>
  );
}
