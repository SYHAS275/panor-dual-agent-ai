"use client";

import { useState, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import type { ConversationEntry } from "@/components/FileUpload";
import ResponseDisplay from "@/components/ResponseDisplay";
import Header from "@/components/Header";
import ParticleBackground from "@/components/ParticleBackground";
import type { User } from "@/components/AuthPage";
import dynamic from "next/dynamic";

const AuthPage = dynamic(
  () => import("@/components/AuthPage"),
  { ssr: false }
);

export interface AIResponse {
  text: string;
  model: string;
  timestamp: string;
}

export interface AnalysisResult {
  file: {
    name: string;
    size: number;
    type: string;
  } | null;
  extractedText: string | null;
  question: string;
  responses: {
    gemini: AIResponse | null;
    chatgpt: AIResponse | null;
    summary: AIResponse | null;
  };
}

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("panorai_session");
    if (session) {
      try {
        setUser(JSON.parse(session));
      } catch {
        localStorage.removeItem("panorai_session");
      }
    }
    setIsCheckingAuth(false);
  }, []);

  const handleAuth = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("panorai_session");
    setUser(null);
  };

  const handleAnalysisStart = (question: string, file?: { name: string; size: number; type: string }) => {
    setIsLoading(true);
    setError(null);
    setResult({
      file: file || null,
      extractedText: null,
      question,
      responses: {
        gemini: null,
        chatgpt: null,
        summary: null,
      },
    });
  };

  const handleStreamUpdate = (type: "gemini" | "chatgpt" | "summary", response: AIResponse) => {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        responses: {
          ...prev.responses,
          [type]: response,
        },
      };
    });
  };

  const handleStreamDone = () => {
    setIsLoading(false);
    setResult((prev) => {
      if (prev && prev.responses.summary) {
        setConversationHistory((hist) => [
          ...hist,
          { question: prev.question, answer: prev.responses.summary!.text },
        ]);
      }
      return prev;
    });
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
    setResult(null);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setIsLoading(false);
    setConversationHistory([]);
  };

  const hasAnyResponse = result && (
    result.responses.gemini || result.responses.chatgpt || result.responses.summary
  );

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
        <div className="text-center">
          <div className="w-12 h-12 spinner mx-auto mb-4" />
          <p className="text-sm text-white/30">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="aurora-bg" />
      <div className="mesh-grid" />
      <ParticleBackground />
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Header user={user} onLogout={handleLogout} />

        <main className="container mx-auto px-6 py-8 max-w-6xl">
          {/* Hero */}
          <div className="text-center mb-8 animate-fade-in-up">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              <span className="gradient-text">Dual AI Analysis</span>
            </h1>
            <p className="text-sm sm:text-base text-white/35 max-w-lg mx-auto leading-relaxed">
              Ask anything or upload a file. Multiple AI models respond independently,
              then we fuse their answers into one best response.
            </p>
            <div className="flex items-center justify-center gap-2.5 mt-5">
              <span className="badge badge-cyan">Gemini Flash</span>
              <span className="text-white/10 text-xs">+</span>
              <span className="badge badge-purple">GPT-4o</span>
              <span className="text-white/10 text-xs">=</span>
              <span className="badge badge-green">Best Answer</span>
            </div>
          </div>

          {/* Upload Section */}
          {!hasAnyResponse && !isLoading && (
            <div className="animate-scale-in stagger-1">
              <FileUpload
                onAnalysisStart={handleAnalysisStart}
                onStreamUpdate={handleStreamUpdate}
                onStreamDone={handleStreamDone}
                onError={handleError}
                conversationHistory={conversationHistory}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="max-w-2xl mx-auto mb-8 animate-fade-in-up">
              <div className="glass-card rounded-2xl p-5 border-red-500/20 border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-red-300/80">{error}</p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors px-3 py-1 rounded-lg border border-white/5 hover:border-white/10"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoading && !hasAnyResponse && (
            <div className="max-w-2xl mx-auto animate-scale-in">
              <div className="glass-card rounded-2xl p-10">
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 spinner mb-6" />
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Analyzing with multiple AI models
                  </h3>
                  <p className="text-sm text-white/30 mb-8">
                    Streaming responses in real-time as each model finishes
                  </p>

                  <div className="w-full max-w-sm space-y-3">
                    {[
                      { label: "Querying Gemini Flash", color: "bg-[#00e5ff]", delay: "0s" },
                      { label: "Querying GPT-4o", color: "bg-[#8b5cf6]", delay: "0.3s" },
                      { label: "Fusing best answer", color: "bg-[#10b981]", delay: "0.6s" },
                    ].map((step) => (
                      <div key={step.label} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02]">
                        <div
                          className={`w-2 h-2 rounded-full ${step.color} animate-pulse`}
                          style={{ animationDelay: step.delay }}
                        />
                        <span className="text-sm text-white/40">{step.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="typing-dots mt-6">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {hasAnyResponse && (
            <div className="animate-fade-in-up">
              <ResponseDisplay result={result!} isStreaming={isLoading} onReset={handleReset} />
            </div>
          )}

          {/* Follow-up input */}
          {hasAnyResponse && !isLoading && (
            <div className="mt-8 animate-fade-in-up">
              <FileUpload
                onAnalysisStart={handleAnalysisStart}
                onStreamUpdate={handleStreamUpdate}
                onStreamDone={handleStreamDone}
                onError={handleError}
                conversationHistory={conversationHistory}
                isFollowUp
              />
            </div>
          )}
        </main>

        <footer className="py-8 text-center border-t border-white/[0.03] mt-12">
          <p className="text-[11px] text-white/15 tracking-wide">
            PANOR<span className="text-[#00e5ff]/30">.</span>AI &mdash; Powered by Gemini &amp; GPT-4o
          </p>
        </footer>
      </div>
    </div>
  );
}
