"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { AIResponse } from "@/app/page";
import { readSSEStream } from "@/lib/utils/sseReader";

export interface ConversationEntry {
  question: string;
  answer: string;
}

interface FileUploadProps {
  onAnalysisStart: (question: string, file?: { name: string; size: number; type: string }) => void;
  onStreamUpdate: (type: "gemini" | "chatgpt" | "summary", response: AIResponse) => void;
  onStreamDone: () => void;
  onError: (error: string) => void;
  conversationHistory?: ConversationEntry[];
  isFollowUp?: boolean;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: "PDF",
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPG",
  docx: "DOCX",
  txt: "TXT",
};

export default function FileUpload({
  onAnalysisStart,
  onStreamUpdate,
  onStreamDone,
  onError,
  conversationHistory = [],
  isFollowUp = false,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    maxSize: 10485760,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (question.trim() && !isSubmitting) {
        const form = e.currentTarget.closest("form");
        if (form) form.requestSubmit();
      }
    }
  };

  const getFileExtension = (name: string) => {
    return name.split(".").pop()?.toLowerCase() || "";
  };

  const isImageFile = (name: string) => {
    const ext = getFileExtension(name);
    return ["png", "jpg", "jpeg"].includes(ext);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) {
      onError("Please enter a question or prompt");
      return;
    }

    setIsSubmitting(true);

    const fileInfo = file
      ? { name: file.name, size: file.size, type: file.type }
      : undefined;
    onAnalysisStart(question, fileInfo);

    try {
      let response: Response;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("question", question);

        response = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, history: conversationHistory }),
        });
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // Stream mode — read events progressively
        await readSSEStream(response, (event, data) => {
          if (event === "gemini" || event === "chatgpt" || event === "summary") {
            onStreamUpdate(event, data as AIResponse);
          } else if (event === "error") {
            onError((data as { message: string }).message || "Analysis failed");
          }
        });

        onStreamDone();
      } else {
        // JSON error response
        const json = await response.json();
        throw new Error(json.error || "Analysis failed");
      }

      setFile(null);
      setQuestion("");
      setShowFileUpload(false);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Question -- primary input */}
        <div>
          <label htmlFor="question" className="block text-xs font-bold text-[#ec4899] mb-2 uppercase tracking-wider shadow-[0_0_10px_rgba(236,72,153,0.4)] drop-shadow-[0_0_2px_rgba(236,72,153,0.8)]">
            {isFollowUp ? "Follow up" : "Ask anything"}
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isFollowUp ? "Ask a follow-up question..." : "Type your question or prompt here..."}
            className="w-full px-4 py-3.5 rounded-xl bg-white/[0.02] border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 ring-0 text-white/80 placeholder-[#ec4899]/60 resize-none transition-all duration-300 text-sm leading-relaxed"
            rows={isFollowUp ? 2 : 4}
            required
            disabled={isSubmitting}
          />
          <p className="text-[10px] text-white/15 mt-1.5">
            Press <span className="text-white/25">Enter</span> to send, <span className="text-white/25">Shift+Enter</span> for new line
          </p>
        </div>

        {/* Optional file attachment toggle */}
        {!isFollowUp && !showFileUpload && !file && (
          <button
            type="button"
            onClick={() => setShowFileUpload(true)}
            className="flex items-center gap-2 text-xs text-[#ec4899] hover:text-[#ec4899]/80 transition-colors bg-[#ec4899]/10 px-3 py-1.5 rounded-lg border border-[#ec4899]/20 hover:border-[#ec4899]/40 shadow-[0_0_10px_rgba(236,72,153,0.1)]"
            disabled={isSubmitting}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
            Attach a file (optional)
          </button>
        )}

        {/* File Drop Zone */}
        {!isFollowUp && (showFileUpload || file) && (
          <div
            {...getRootProps()}
            className={`glass-card neon-border rounded-2xl p-6 text-center cursor-pointer transition-all duration-500 ${
              isDragActive ? "border-[#ec4899]/50 bg-[#ec4899]/[0.05] shadow-[0_0_30px_rgba(236,72,153,0.2)]" : "border-[#ec4899]/20 shadow-[0_0_15px_rgba(236,72,153,0.1)] hover:shadow-[0_0_25px_rgba(236,72,153,0.2)] hover:border-[#ec4899]/40"
            } ${file ? "border-emerald-500/20 shadow-none" : ""}`}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isImageFile(file.name) ? "bg-pink-500/10 text-pink-400" : "bg-[#00e5ff]/10 text-[#00e5ff]"
                  }`}>
                    {FILE_TYPE_ICONS[getFileExtension(file.name)] || "FILE"}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white truncate max-w-[250px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setShowFileUpload(false);
                  }}
                  className="text-xs text-white/20 hover:text-red-400 transition-colors px-2 py-1"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <svg className="w-5 h-5 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {isDragActive ? (
                  <p className="text-xs text-[#00e5ff]">Drop it here</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-white/30">
                      Drop a file or <span className="text-[#8b5cf6]">browse</span>
                    </p>
                    <div className="flex items-center gap-1.5 justify-center">
                      {["PDF", "PNG", "JPG", "DOCX", "TXT"].map((t) => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] text-white/15 font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFileUpload(false);
                  }}
                  className="text-[10px] text-white/10 hover:text-white/25 transition-colors mt-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!question.trim() || isSubmitting}
          className="btn-premium w-full rounded-xl py-3.5 px-6 font-semibold text-white text-sm disabled:opacity-20 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 spinner" />
              Streaming responses...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              {isFollowUp ? "Ask Follow-up" : file ? "Analyze File with Gemini & GPT-4o" : "Ask Gemini & GPT-4o"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
