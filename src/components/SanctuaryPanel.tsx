import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Heart, 
  Sparkles, 
  Droplet, 
  Activity, 
  BookOpen, 
  CheckCircle2, 
  Scissors, 
  Smile, 
  Coffee,
  CloudRain,
  Compass
} from "lucide-react";
import { WellnessEntry } from "../types";

interface SanctuaryProps {
  wellnessHistory: WellnessEntry[];
  onAddWellnessEntry: (entry: WellnessEntry) => void;
}

export default function SanctuaryPanel({ wellnessHistory, onAddWellnessEntry }: SanctuaryProps) {
  const [hairOiled, setHairOiled] = useState(false);
  const [hairDermarolled, setHairDermarolled] = useState(false);
  const [hairSerum, setHairSerum] = useState(false);
  const [hairMassage, setHairMassage] = useState(false);

  const [skinMorning, setSkinMorning] = useState(false);
  const [skinNight, setSkinNight] = useState(false);

  const [moodScore, setMoodScore] = useState(7);
  const [waterCups, setWaterCups] = useState(4);
  const [journalText, setJournalText] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];

  // Check if today is already logged
  const todayEntry = wellnessHistory.find(h => h.date === todayStr);

  const handleSaveToday = () => {
    const entry: WellnessEntry = {
      date: todayStr,
      hairRecovery: {
        oiled: hairOiled,
        dermarolled: hairDermarolled,
        serumApplied: hairSerum,
        massageDone: hairMassage
      },
      skinRoutine: {
        morningDone: skinMorning,
        nightDone: skinNight
      },
      moodScore,
      waterIntakeCups: waterCups,
      journalPrompt: "How did you embrace stillness on your path today?",
      journalText
    };

    onAddWellnessEntry(entry);
    // Display sweet sisterly confirmation
    alert("Your self-care logs are safely tucked into the Saisha OS archives. Remember, baby steps are beautiful!");
  };

  const getMoodLabel = (score: number) => {
    if (score <= 3) return "Overwhelmed & Heavy (Pausing everything is allowed)";
    if (score <= 5) return "Quiet / Low Energy (Gently recovering, no pressure)";
    if (score <= 7) return "Balanced & Peaceful (Stable, breathing in Auckland breezes)";
    if (score <= 9) return "Inspired & Focused (Ready to build, songwriting spark is near)";
    return "Invincible & Elevated (Top-tier AI Creator state!)";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-2xl font-serif text-pink-100 flex items-center gap-2">
          <Heart className="w-6 h-6 text-pink-400" />
          The Sanctuary
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Tending to your body, scalp, skin, and mental wellbeing. This is your safe place—zero shame, pure care.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Logging Card */}
        <div className="xl:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-serif text-lg text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-pink-400" /> Today's Restoration Logs
              </h3>
              <span className="text-xs font-mono text-pink-300 bg-pink-400/10 px-2.5 py-0.5 rounded-full">
                {todayStr} {todayEntry ? "✓ Saved" : "✏ Needs update"}
              </span>
            </div>

            {/* Hair Recovery Tracker */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4.5 h-4.5 text-pink-400" />
                <h4 className="text-sm font-semibold text-pink-200">Hair Restoration Rituals</h4>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">Consistency is our superpower. Hair growth takes months—each massage and drop of oil compounds.</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                <button
                  onClick={() => setHairOiled(!hairOiled)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    hairOiled 
                      ? "bg-pink-400/20 border-pink-400/40 text-pink-100" 
                      : "bg-white/2 border-white/5 text-gray-400 hover:border-white/10"
                  }`}
                >
                  <span className="text-xs font-mono uppercase block">Weekly Oiling</span>
                  <span className="text-[10px] text-pink-300 block mt-1">{hairOiled ? "Completed ✓" : "Tap to complete"}</span>
                </button>

                <button
                  onClick={() => setHairDermarolled(!hairDermarolled)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    hairDermarolled 
                      ? "bg-pink-400/20 border-pink-400/40 text-pink-100" 
                      : "bg-white/2 border-white/5 text-gray-400 hover:border-white/10"
                  }`}
                >
                  <span className="text-xs font-mono uppercase block">Dermarolling</span>
                  <span className="text-[10px] text-pink-300 block mt-1">{hairDermarolled ? "Completed ✓" : "Tap to complete"}</span>
                </button>

                <button
                  onClick={() => setHairSerum(!hairSerum)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    hairSerum 
                      ? "bg-pink-400/20 border-pink-400/40 text-pink-100" 
                      : "bg-white/2 border-white/5 text-gray-400 hover:border-white/10"
                  }`}
                >
                  <span className="text-xs font-mono uppercase block">Growth Serum</span>
                  <span className="text-[10px] text-pink-300 block mt-1">{hairSerum ? "Completed ✓" : "Tap to complete"}</span>
                </button>

                <button
                  onClick={() => setHairMassage(!hairMassage)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    hairMassage 
                      ? "bg-pink-400/20 border-pink-400/40 text-pink-100" 
                      : "bg-white/2 border-white/5 text-gray-400 hover:border-white/10"
                  }`}
                >
                  <span className="text-xs font-mono uppercase block">Scalp Massage</span>
                  <span className="text-[10px] text-pink-300 block mt-1">{hairMassage ? "Completed ✓" : "Tap to complete"}</span>
                </button>
              </div>
            </div>

            {/* Skincare Routine */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Smile className="w-4.5 h-4.5 text-pink-400" />
                <h4 className="text-sm font-semibold text-pink-200">Skin Improvement Routine</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setSkinMorning(!skinMorning)}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    skinMorning 
                      ? "bg-pink-400/10 border-pink-400/30 text-pink-100" 
                      : "bg-white/2 border-white/5 text-gray-400 hover:border-white/10"
                  }`}
                >
                  <div className="text-left">
                    <span className="text-xs font-mono uppercase block">Morning Shield</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Cleanser, Hydrate, SPF 50</span>
                  </div>
                  <span className="text-xs font-mono text-pink-300">{skinMorning ? "Done ✓" : "To do"}</span>
                </button>

                <button
                  onClick={() => setSkinNight(!skinNight)}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    skinNight 
                      ? "bg-pink-400/10 border-pink-400/30 text-pink-100" 
                      : "bg-white/2 border-white/5 text-gray-400 hover:border-white/10"
                  }`}
                >
                  <div className="text-left">
                    <span className="text-xs font-mono uppercase block">Night Repair</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Double Cleansing, Retinol/Moisturize</span>
                  </div>
                  <span className="text-xs font-mono text-pink-300">{skinNight ? "Done ✓" : "To do"}</span>
                </button>
              </div>
            </div>

            {/* Hydration & Mood */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Water Intake */}
              <div className="space-y-3 bg-white/2 p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-pink-200 flex items-center gap-1.5">
                    <Droplet className="w-4 h-4 text-sky-400" /> Hydration Level
                  </span>
                  <span className="text-xs font-mono text-sky-300">{waterCups} / 8 Cups</span>
                </div>
                <div className="flex justify-around items-center gap-1.5 py-1">
                  {[...Array(8)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setWaterCups(i + 1)}
                      className={`w-7 h-9 rounded-md flex items-end justify-center pb-1 transition-all ${
                        i < waterCups 
                          ? "bg-sky-400/30 border border-sky-400/40 text-sky-200 scale-105" 
                          : "bg-white/5 border border-white/5 text-gray-600 hover:border-white/10"
                      }`}
                    >
                      <Droplet className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Scale */}
              <div className="space-y-3 bg-white/2 p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-pink-200 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-pink-400" /> Inner Mood State
                  </span>
                  <span className="text-xs font-mono text-pink-300">Level {moodScore}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={moodScore}
                  onChange={e => setMoodScore(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-400"
                />
                <span className="text-[11px] font-mono text-gray-400 block leading-relaxed italic">
                  {getMoodLabel(moodScore)}
                </span>
              </div>
            </div>

            {/* Ghibli Journal Prompt */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4.5 h-4.5 text-pink-400" />
                <h4 className="text-sm font-semibold text-pink-200">Ghibli Solitude Journal</h4>
              </div>
              <p className="text-xs text-gray-400 italic">"How did you embrace stillness on your path today?"</p>
              <textarea
                placeholder="Let your thoughts flow freely. This diary is completely secure, local, and read-only by you and Saisha Core."
                value={journalText}
                onChange={e => setJournalText(e.target.value)}
                className="w-full h-28 p-4 text-sm glass-input font-sans resize-none"
              />
            </div>

            <button
              onClick={handleSaveToday}
              className="w-full py-3 bg-gradient-to-r from-pink-500/20 to-rose-500/20 text-pink-200 border border-pink-400/20 rounded-2xl font-medium text-sm hover:from-pink-500/30 hover:to-rose-500/30 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Sanctuary Ledger
            </button>
          </div>
        </div>

        {/* History / Ghibli Quote Side-panel */}
        <div className="space-y-6">
          {/* Studio Ghibli Inspired Mindfulness card */}
          <div className="glass-card rounded-3xl p-5 border border-white/5 bg-gradient-to-br from-pink-500/5 to-rose-500/5 space-y-4">
            <h4 className="text-sm font-semibold text-pink-200 flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-300" /> Studio Ghibli Sanctuary
            </h4>
            <blockquote className="text-xs text-gray-300 italic leading-relaxed border-l-2 border-pink-400/40 pl-3">
              "Yet, with a cup of warm tea and the soft New Zealand rain outside, the mind finds its alignment. Your path is not a sprint, Saisha. It is a series of mornings where you simply choose to look forward."
            </blockquote>
            <p className="text-[10px] text-gray-500 font-mono text-right">- Saisha OS Ghibli Soul</p>
          </div>

          {/* History Log */}
          <div className="glass-card rounded-3xl p-5 border border-white/5 space-y-4">
            <h4 className="text-sm font-semibold text-pink-200 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-pink-400" /> Sanctuary History
            </h4>

            {wellnessHistory.length === 0 ? (
              <p className="text-xs text-gray-500 italic pl-1">No previous wellness entries archived yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {wellnessHistory.map((h, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/2 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-gray-400">{h.date}</span>
                      <span className="px-1.5 py-0.5 bg-pink-400/10 text-pink-300 rounded text-[10px] font-mono">
                        Mood: {h.moodScore}/10
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-400">
                      <div>
                        <span className="text-[9px] uppercase text-gray-500 block">Scalp / Hair:</span>
                        <span>
                          {h.hairRecovery.massageDone ? "Massage ✓ " : ""}
                          {h.hairRecovery.oiled ? "Oil ✓ " : ""}
                          {h.hairRecovery.serumApplied ? "Serum ✓" : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-gray-500 block">Skin Routine:</span>
                        <span>
                          AM: {h.skinRoutine.morningDone ? "✓" : "✗"} | PM: {h.skinRoutine.nightDone ? "✓" : "✗"}
                        </span>
                      </div>
                    </div>

                    {h.journalText && (
                      <p className="text-xs text-gray-300 mt-1 pl-2 border-l border-white/10 italic truncate">
                        "{h.journalText}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
