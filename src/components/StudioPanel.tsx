import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Music, 
  Sparkles, 
  Plus, 
  Edit3, 
  Save, 
  Trash, 
  Layers, 
  Heart, 
  Disc, 
  Volume2, 
  Compass,
  FileText
} from "lucide-react";
import { SongDraft } from "../types";

interface StudioProps {
  songs: SongDraft[];
  onUpdateSongs: (songs: SongDraft[]) => void;
}

const CHORD_TEMPLATES = [
  { name: "The Auckland Rain", chords: "Am - F - C - G", feel: "Moody, melancholic, reflective" },
  { name: "Data Solitude", chords: "C - G - Am - F", feel: "Optimistic, narrative, classic" },
  { name: "Midnight Transit", chords: "Dm - G - C - Am", feel: "Jazz-pop, nocturnal, dreamy" },
  { name: "Albert Park Sunset", chords: "F - G - Em - Am", feel: "Warm, nostalgic, epic" },
  { name: "Vector Heartbeat", chords: "Am - Dm - G - C", feel: "Rhythmic, passionate, deep" }
];

export default function StudioPanel({ songs, onUpdateSongs }: StudioProps) {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(songs[0]?.id || null);
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongStatus, setNewSongStatus] = useState<"spark" | "wip" | "completed">("spark");

  const activeSong = songs.find(s => s.id === selectedSongId);

  // Edit fields for active song
  const [editTitle, setEditTitle] = useState(activeSong?.title || "");
  const [editLyrics, setEditLyrics] = useState(activeSong?.lyrics || "");
  const [editKey, setEditKey] = useState(activeSong?.key || "");
  const [editTempo, setEditTempo] = useState(activeSong?.tempo || "");
  const [editChords, setEditChords] = useState(activeSong?.chords || "");
  const [editStatus, setEditStatus] = useState<"spark" | "wip" | "completed">(activeSong?.status || "spark");

  // Sync edits when active song changes
  React.useEffect(() => {
    if (activeSong) {
      setEditTitle(activeSong.title);
      setEditLyrics(activeSong.lyrics);
      setEditKey(activeSong.key || "");
      setEditTempo(activeSong.tempo || "");
      setEditChords(activeSong.chords || "");
      setEditStatus(activeSong.status);
    }
  }, [selectedSongId, activeSong]);

  const handleCreateSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitle) return;
    const newSong: SongDraft = {
      id: "song-" + Date.now(),
      title: newSongTitle,
      status: newSongStatus,
      lyrics: "",
      createdAt: new Date().toISOString().split("T")[0]
    };
    const updated = [newSong, ...songs];
    onUpdateSongs(updated);
    setSelectedSongId(newSong.id);
    setNewSongTitle("");
  };

  const handleSaveActiveSong = () => {
    if (!selectedSongId) return;
    const updated = songs.map(s => {
      if (s.id === selectedSongId) {
        return {
          ...s,
          title: editTitle,
          lyrics: editLyrics,
          key: editKey,
          tempo: editTempo,
          chords: editChords,
          status: editStatus
        };
      }
      return s;
    });
    onUpdateSongs(updated);
    alert(`"${editTitle}" lyric draft updated successfully!`);
  };

  const handleDeleteSong = (id: string) => {
    if (!confirm("Are you sure you want to archive this creative spark? It is an important part of your journey.")) return;
    const updated = songs.filter(s => s.id !== id);
    onUpdateSongs(updated);
    if (selectedSongId === id) {
      setSelectedSongId(updated[0]?.id || null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-2xl font-serif text-violet-100 flex items-center gap-2">
          <Music className="w-6 h-6 text-violet-400" />
          The Songwriting Studio
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Nurturing your songwriting heart. Keep your chords, lyrics, and transient inspirations safe in one workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Sidebar: Songs list & creation */}
        <div className="space-y-5">
          {/* Create Song */}
          <form onSubmit={handleCreateSong} className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
            <h4 className="text-xs font-mono text-violet-300 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Capture New Song
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Title or lyric motif..."
                value={newSongTitle}
                onChange={e => setNewSongTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs glass-input"
                required
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-violet-500/20 text-violet-200 border border-violet-500/20 rounded-xl hover:bg-violet-500/30 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Songs List */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
            <h4 className="text-xs font-mono text-violet-300 uppercase tracking-wider">Song Catalog</h4>
            {songs.length === 0 ? (
              <p className="text-xs text-gray-500 italic pl-1">No songs logged yet. Capture a spark above!</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {songs.map(song => {
                  const isActive = song.id === selectedSongId;
                  const statusColors = song.status === "spark" 
                    ? "text-amber-300 bg-amber-400/5" 
                    : song.status === "wip" 
                      ? "text-violet-300 bg-violet-400/5" 
                      : "text-emerald-300 bg-emerald-400/5";

                  return (
                    <div
                      key={song.id}
                      onClick={() => setSelectedSongId(song.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex justify-between items-center group ${
                        isActive 
                          ? "bg-violet-500/10 border-violet-500/40" 
                          : "bg-white/2 border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="text-sm font-medium text-white block truncate">{song.title}</span>
                        <span className="text-[10px] text-gray-400 block font-mono mt-0.5">{song.createdAt}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded ${statusColors}`}>
                          {song.status}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSong(song.id);
                          }}
                          className="p-1 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Acoustic Chord Helpers */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
            <h4 className="text-xs font-mono text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" /> Aesthetic Chords
            </h4>
            <div className="space-y-2">
              {CHORD_TEMPLATES.map((tpl, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    if (selectedSongId) {
                      setEditChords(tpl.chords);
                    } else {
                      alert("Select or create a song draft first to apply these chords!");
                    }
                  }}
                  className="p-2.5 rounded-xl bg-white/2 border border-white/5 hover:border-violet-500/20 hover:bg-violet-500/2 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-center text-xs font-semibold text-violet-200">
                    <span>{tpl.name}</span>
                    <span className="text-[10px] font-mono text-violet-400 bg-violet-400/5 px-1.5 rounded">Use</span>
                  </div>
                  <span className="text-[11px] font-mono block text-gray-300 mt-1">{tpl.chords}</span>
                  <span className="text-[10px] block text-gray-500 mt-0.5 leading-relaxed">{tpl.feel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lyricist Editing Canvas */}
        <div className="xl:col-span-3">
          {activeSong ? (
            <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="text-2xl font-serif text-white bg-transparent border-b border-transparent hover:border-white/15 focus:border-violet-400 focus:outline-none w-full pb-0.5"
                  />
                  <span className="text-xs text-gray-400 font-mono block mt-1">Song draft saved locally inside OS</span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as any)}
                    className="px-3 py-1.5 text-xs glass-input bg-[#121217] text-white"
                  >
                    <option value="spark">Spark (Idea)</option>
                    <option value="wip">WIP (In progress)</option>
                    <option value="completed">Completed (Masterpiece)</option>
                  </select>

                  <button
                    onClick={handleSaveActiveSong}
                    className="px-4 py-1.5 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/30 hover:to-fuchsia-500/30 text-violet-200 border border-violet-500/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Draft
                  </button>
                </div>
              </div>

              {/* Song metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Musical Key</label>
                  <input
                    type="text"
                    placeholder="e.g. A minor, C major"
                    value={editKey}
                    onChange={e => setEditKey(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs glass-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Tempo (BPM)</label>
                  <input
                    type="text"
                    placeholder="e.g. 84, 120"
                    value={editTempo}
                    onChange={e => setEditTempo(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs glass-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Chord Progression</label>
                  <input
                    type="text"
                    placeholder="e.g. Am - F - C - G"
                    value={editChords}
                    onChange={e => setEditChords(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs glass-input font-mono"
                  />
                </div>
              </div>

              {/* Lyrics text area */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Lyrics Notebook
                  </span>
                  <span className="text-gray-500 font-mono">{editLyrics.length} chars</span>
                </div>
                <textarea
                  placeholder="The rain was falling heavy on Albert Park... write your feelings, lyrics, or songwriting structures here."
                  value={editLyrics}
                  onChange={e => setEditLyrics(e.target.value)}
                  className="w-full h-96 p-5 glass-input font-mono text-sm leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-12 text-center border border-white/10 flex flex-col items-center justify-center space-y-4">
              <Music className="w-12 h-12 text-violet-400/50 animate-pulse" />
              <div>
                <h3 className="text-lg font-serif text-white">Your Songwriting Space</h3>
                <p className="text-sm text-gray-400 max-w-sm mt-1">
                  Create a new song draft or select one from the catalog sidebar to release your creative heartbeat.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
