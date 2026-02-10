"use client";

import type { DetectedFace } from "@/lib/hooks/useFaceDetection";

interface AIResponse {
  text: string;
  model: string;
  timestamp: string;
}

interface FaceResultsProps {
  faces: DetectedFace[];
  selectedFaceId: number | null;
  onSelectFace: (id: number) => void;
  identification: {
    gemini: AIResponse | null;
    chatgpt: AIResponse | null;
  };
  isIdentifying: boolean;
}

export default function FaceResults({
  faces,
  selectedFaceId,
  onSelectFace,
  identification,
  isIdentifying,
}: FaceResultsProps) {
  const selectedFace = faces.find((f) => f.id === selectedFaceId);

  return (
    <div className="space-y-4">
      {/* Face count + chips */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#ec4899]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#ec4899]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {faces.length} {faces.length === 1 ? "Face" : "Faces"} Detected
            </p>
            <p className="text-xs text-white/20">Click a face to see details</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {faces.map((face) => (
            <button
              key={face.id}
              onClick={() => onSelectFace(face.id)}
              className={`face-chip ${face.id === selectedFaceId ? "selected" : ""} ${face.isSuhas ? "!border-emerald-500/50 !bg-emerald-500/10" : ""}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  face.isSuhas ? "bg-emerald-400" : face.gender === "male" ? "bg-[#00e5ff]" : "bg-[#ec4899]"
                }`}
              />
              <span className={`text-xs ${face.isSuhas ? "text-emerald-400 font-semibold" : "text-white/70"}`}>
                {face.isSuhas ? "SUHAS R" : face.knownProfile ? face.knownProfile.name : `Face ${face.id + 1}`}
              </span>
              <span className="text-[10px] text-white/30">
                {face.isSuhas && face.suhasConfidence ? `${Math.round(face.suhasConfidence * 100)}% match` : face.knownProfile ? `Age ${face.knownProfile.age}` : `Age ${face.age}`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected face detail */}
      {selectedFace && (
        <div className="glass-card rounded-2xl p-6 neon-border animate-scale-in">
          {/* Known profile card (from Suhas descriptor match or other) */}
          {(selectedFace.knownProfile || selectedFace.isSuhas) ? (
            <>
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedFace.isSuhas ? "bg-gradient-to-br from-emerald-500/20 to-[#00e5ff]/20" : "bg-gradient-to-br from-[#00e5ff]/20 to-[#8b5cf6]/20"}`}>
                  <svg className={`w-6 h-6 ${selectedFace.isSuhas ? "text-emerald-400" : "text-[#00e5ff]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {selectedFace.isSuhas ? "SUHAS R" : selectedFace.knownProfile?.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-emerald-400 font-medium">Identity Confirmed</p>
                    {selectedFace.isSuhas && selectedFace.suhasConfidence && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                        {Math.round(selectedFace.suhasConfidence * 100)}% match
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white/[0.03] rounded-xl p-4 text-center border border-white/[0.05]">
                  <p className="text-2xl font-bold text-white">{selectedFace.knownProfile?.age || selectedFace.age}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Age</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-4 text-center border border-white/[0.05]">
                  <p className="text-2xl font-bold text-white capitalize">{selectedFace.knownProfile?.gender || selectedFace.gender}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Gender</p>
                </div>
              </div>

              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.05] mb-5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Occupation</p>
                <p className="text-sm font-semibold text-white">{selectedFace.knownProfile?.occupation || (selectedFace.isSuhas ? "Software Engineer at ARTPARK" : "Unknown")}</p>
              </div>

              {selectedFace.isSuhas && (
                <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 mb-5">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-emerald-400">Matched via face descriptors (448 training samples)</p>
                  </div>
                </div>
              )}

              <div className="divider-glow mb-5" />

              {/* Expression from face-api */}
              <div className="bg-white/[0.02] rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-white capitalize">{selectedFace.dominantExpression}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Expression</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                    selectedFace.gender === "male"
                      ? "bg-[#00e5ff]/10 text-[#00e5ff]"
                      : "bg-[#ec4899]/10 text-[#ec4899]"
                  }`}
                >
                  #{selectedFace.id + 1}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Face #{selectedFace.id + 1} Details
                  </h3>
                  <p className="text-xs text-white/20">Client-side detection via face-api.js</p>
                </div>
              </div>

              {/* Attributes grid */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white/[0.02] rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-white">{selectedFace.age}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Est. Age</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-white capitalize">{selectedFace.gender}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">
                    Gender ({selectedFace.genderProbability}%)
                  </p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-white capitalize">{selectedFace.dominantExpression}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Expression</p>
                </div>
              </div>

              <div className="divider-glow mb-5" />

              {/* AI Identification */}
              <div>
                <h4 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">
                  AI Name Identification
                </h4>

                <div className="space-y-3">
                  {/* Gemini */}
                  <div className="bg-white/[0.02] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]" />
                      <span className="text-xs font-medium text-[#00e5ff]">Gemini</span>
                      {identification.gemini && (
                        <span className="badge badge-cyan text-[9px]">{identification.gemini.model}</span>
                      )}
                    </div>
                    {identification.gemini ? (
                      <p className="text-sm text-white/60 whitespace-pre-wrap">
                        {identification.gemini.text}
                      </p>
                    ) : isIdentifying ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-[#00e5ff] border-t-transparent animate-spin" />
                        <span className="text-xs text-white/30">Identifying...</span>
                      </div>
                    ) : (
                      <p className="text-xs text-white/20">Not available</p>
                    )}
                  </div>

                  {/* ChatGPT */}
                  <div className="bg-white/[0.02] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                      <span className="text-xs font-medium text-[#8b5cf6]">ChatGPT</span>
                      {identification.chatgpt && (
                        <span className="badge badge-purple text-[9px]">{identification.chatgpt.model}</span>
                      )}
                    </div>
                    {identification.chatgpt ? (
                      <p className="text-sm text-white/60 whitespace-pre-wrap">
                        {identification.chatgpt.text}
                      </p>
                    ) : isIdentifying ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-[#8b5cf6] border-t-transparent animate-spin" />
                        <span className="text-xs text-white/30">Identifying...</span>
                      </div>
                    ) : (
                      <p className="text-xs text-white/20">Not available</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
