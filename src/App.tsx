import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  GraduationCap, 
  Heart, 
  Music, 
  DollarSign, 
  Clock, 
  Sparkles, 
  Sliders, 
  CheckSquare, 
  Database, 
  FileDown, 
  FileUp, 
  RefreshCw,
  Compass,
  Smile,
  BookOpen,
  ArrowRight,
  Info
} from "lucide-react";

import { 
  SaishaOSState, 
  Ritual, 
  UniversityCourse, 
  CareerMilestone, 
  WellnessEntry, 
  SongDraft, 
  BudgetCategory, 
  ChatMessage, 
  EMPTY_STATE, 
  OnboardingData 
} from "./types";
import ZenithPanel from "./components/ZenithPanel";
import SanctuaryPanel from "./components/SanctuaryPanel";
import StudioPanel from "./components/StudioPanel";
import LedgerPanel from "./components/LedgerPanel";
import AIAssistant from "./components/AIAssistant";
import OnboardingFlow from "./components/OnboardingFlow";
import { supabase, signInWithGoogle, signUpWithEmail, signInWithPassword, signOut } from "./supabase";
import {
  fetchFullState,
  hasRemoteData,
  uploadInitialState,
  checkOnboardingStatus,
  saveOnboardingData,
  syncProfile,
  syncRituals,
  syncCourses,
  syncCareerMilestones,
  syncWellnessHistory,
  syncSongs,
  syncBudget,
  syncBucketList,
  syncChatHistory
} from "./supabaseSync";
import { KeyRound, ShieldAlert, LogOut, Check, HelpCircle, Loader2 } from "lucide-react";

export default function App() {
  const [osState, setOsState] = useState<SaishaOSState>(() => {
    const local = localStorage.getItem("saisha_os_data");
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error("Failed parsing localStorage data, resetting to empty state", e);
      }
    }
    return EMPTY_STATE;
  });

  // Bucket list state (lifted from LedgerPanel for Supabase synchronization)
  const [bucketList, setBucketList] = useState<any[]>(() => {
    const local = localStorage.getItem("saisha_os_bucket");
    return local ? JSON.parse(local) : [];
  });

  // Supabase Auth and Onboarding States
  const [session, setSession] = useState<any>(null);
  const [isOnboardingChecking, setIsOnboardingChecking] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authStatusMessage, setAuthStatusMessage] = useState("");
  const [authMessageType, setAuthMessageType] = useState<"success" | "error" | "">("");

  // Listen for auth events & auto-restore cache when logged out
  useEffect(() => {
    if (!supabase) {
      console.log("[Auth Lifecycle] Supabase client is not available.");
      return;
    }

    console.log("[Auth Lifecycle] Subscribing to getSession() and onAuthStateChange()...");

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth Lifecycle] Initial getSession() returned:", {
        authenticated: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        expiresAt: session?.expires_at
      });
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log(`[Auth Lifecycle] onAuthStateChange fired! Event: ${_event}`, {
        authenticated: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        expiresAt: session?.expires_at
      });
      setSession(session);
      if (!session) {
        console.log("[Auth Lifecycle] No session detected. Restoring offline local state fallbacks.");
        setHasCompletedOnboarding(false);
        const local = localStorage.getItem("saisha_os_data");
        if (local) {
          try {
            setOsState(JSON.parse(local));
          } catch (e) {
            console.error(e);
          }
        }
        const localBucket = localStorage.getItem("saisha_os_bucket");
        if (localBucket) {
          try {
            setBucketList(JSON.parse(localBucket));
          } catch (e) {
            console.error(e);
          }
        }
      }
    });

    return () => {
      console.log("[Auth Lifecycle] Unsubscribing from onAuthStateChange.");
      subscription.unsubscribe();
    };
  }, []);

  // Sync state & check onboarding status when authenticated session changes
  useEffect(() => {
    if (!session?.user?.id) {
      setIsOnboardingChecking(false);
      return;
    }

    const checkAndSyncUser = async () => {
      setIsOnboardingChecking(true);
      setAuthLoading(true);
      setAuthStatusMessage("Connecting to Saisha OS Cloud Vault...");
      setAuthMessageType("success");

      try {
        console.log("[Onboarding Check] Verifying profile for user:", session.user.id);
        const isOnboarded = await checkOnboardingStatus(session.user.id);
        console.log("[Onboarding Check] Completed status:", isOnboarded);

        if (isOnboarded) {
          setHasCompletedOnboarding(true);
          const { state: remoteState, bucketList: remoteBucket } = await fetchFullState(session.user.id);
          setOsState(remoteState);
          setBucketList(remoteBucket);
          setAuthStatusMessage("Successfully synchronized Saisha OS from Cloud Vault.");
          setAuthMessageType("success");
        } else {
          setHasCompletedOnboarding(false);
          setAuthStatusMessage("First-time setup detected. Welcome to Saisha OS!");
          setAuthMessageType("success");
        }
      } catch (err: any) {
        console.error("Onboarding / Sync check failed:", err);
        setAuthStatusMessage("Cloud connection ready. Offline mode enabled.");
        setAuthMessageType("error");
      } finally {
        setIsOnboardingChecking(false);
        setAuthLoading(false);
      }
    };

    checkAndSyncUser();
  }, [session?.user?.id]);

  const handleCompleteOnboarding = async (data: OnboardingData) => {
    if (!session?.user?.id) throw new Error("No authenticated session found.");
    await saveOnboardingData(session.user.id, data);
    const { state: remoteState, bucketList: remoteBucket } = await fetchFullState(session.user.id);
    setOsState(remoteState);
    setBucketList(remoteBucket);
    setHasCompletedOnboarding(true);
  };

  // Active workspace mode: zenith, sanctuary, studio, ledger
  const [activeMode, setActiveMode] = useState<"zenith" | "sanctuary" | "studio" | "ledger">("zenith");
  
  // Real-time clock for Auckland local time
  const [aucklandTime, setAucklandTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      try {
        const timeStr = new Date().toLocaleTimeString("en-US", {
          timeZone: "Pacific/Auckland",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        });
        setAucklandTime(timeStr);
      } catch (e) {
        setAucklandTime(new Date().toLocaleTimeString());
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cache state in local storage (preserving offline support)
  useEffect(() => {
    localStorage.setItem("saisha_os_data", JSON.stringify(osState));
  }, [osState]);

  useEffect(() => {
    localStorage.setItem("saisha_os_bucket", JSON.stringify(bucketList));
  }, [bucketList]);

  // Syncing Event Handlers (CRUD operations for every workspace)
  const handleUpdateCourses = async (newCourses: UniversityCourse[]) => {
    console.log("[handleUpdateCourses] Triggered. Courses count:", newCourses.length);
    console.log("[handleUpdateCourses] Authentication state:", {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email
    });
    const isCloudSyncEnabled = !!supabase && !!session?.user?.id;
    console.log("[handleUpdateCourses] Cloud sync enabled:", isCloudSyncEnabled);

    setOsState(prev => ({ ...prev, courses: newCourses, lastSaved: new Date().toISOString() }));

    if (session?.user?.id) {
      console.log("[handleUpdateCourses] Initiating syncCourses with user ID:", session.user.id);
      try {
        await syncCourses(session.user.id, newCourses);
        console.log("[handleUpdateCourses] syncCourses call completed successfully.");
      } catch (err) {
        console.error("[handleUpdateCourses] Failed to sync courses to Supabase:", err);
      }
    } else {
      console.log("[handleUpdateCourses] Skipping syncCourses because session or user ID is null.");
    }
  };

  const handleUpdateMilestones = async (newMilestones: CareerMilestone[]) => {
    setOsState(prev => ({ ...prev, careerMilestones: newMilestones, lastSaved: new Date().toISOString() }));
    if (session?.user?.id) {
      try {
        await syncCareerMilestones(session.user.id, newMilestones);
      } catch (err) {
        console.error("Failed to sync career milestones to Supabase:", err);
      }
    }
  };

  const handleAddWellnessEntry = async (entry: WellnessEntry) => {
    const existsIdx = osState.wellnessHistory.findIndex(h => h.date === entry.date);
    let newHistory = [...osState.wellnessHistory];
    if (existsIdx >= 0) {
      newHistory[existsIdx] = entry;
    } else {
      newHistory.push(entry);
    }
    setOsState(prev => ({ ...prev, wellnessHistory: newHistory, lastSaved: new Date().toISOString() }));
    if (session?.user?.id) {
      try {
        await syncWellnessHistory(session.user.id, newHistory);
      } catch (err) {
        console.error("Failed to sync wellness history to Supabase:", err);
      }
    }
  };

  const handleTasksCreated = async (createdTasks: any[]) => {
    console.log("[handleTasksCreated] Tasks created by Gemini core:", createdTasks);
    if (session?.user?.id) {
      try {
        const full = await fetchFullState(session.user.id);
        if (full) {
          setOsState(prev => ({
            ...prev,
            courses: full.state.courses,
            careerMilestones: full.state.careerMilestones,
            lastSaved: new Date().toISOString()
          }));
          return;
        }
      } catch (err) {
        console.error("[handleTasksCreated] State refresh after task creation failed:", err);
      }
    }

    // Optimistic / Local update
    setOsState(prev => {
      let updatedCourses = [...prev.courses];
      let updatedMilestones = [...prev.careerMilestones];

      createdTasks.forEach(task => {
        if (task.type === "assignment") {
          updatedCourses = updatedCourses.map(c => {
            if (c.id === task.course_id) {
              return {
                ...c,
                tasks: [
                  ...c.tasks,
                  {
                    id: task.id,
                    title: task.title,
                    dueDate: task.dueDate || new Date().toISOString().split("T")[0],
                    weight: task.weight || 10,
                    completed: false
                  }
                ]
              };
            }
            return c;
          });
        } else {
          updatedMilestones.push({
            id: task.id,
            title: task.title,
            category: task.category || "skill",
            completed: false,
            details: task.details || ""
          });
        }
      });

      return {
        ...prev,
        courses: updatedCourses,
        careerMilestones: updatedMilestones,
        lastSaved: new Date().toISOString()
      };
    });
  };

  const handleUpdateSongs = async (newSongs: SongDraft[]) => {
    setOsState(prev => ({ ...prev, songs: newSongs, lastSaved: new Date().toISOString() }));
    if (session?.user?.id) {
      try {
        await syncSongs(session.user.id, newSongs);
      } catch (err) {
        console.error("Failed to sync songs to Supabase:", err);
      }
    }
  };

  const handleUpdateSavings = async (newSavings: number) => {
    setOsState(prev => {
      const updated = {
        ...prev,
        budget: { ...prev.budget, currentSavings: newSavings },
        lastSaved: new Date().toISOString()
      };
      if (session?.user?.id) {
        syncBudget(session.user.id, updated.budget.savingsGoal, newSavings, updated.budget.categories).catch(err => {
          console.error("Failed to sync savings budget to Supabase:", err);
        });
      }
      return updated;
    });
  };

  const handleUpdateCategories = async (newCategories: BudgetCategory[]) => {
    setOsState(prev => {
      const updated = {
        ...prev,
        budget: { ...prev.budget, categories: newCategories },
        lastSaved: new Date().toISOString()
      };
      if (session?.user?.id) {
        syncBudget(session.user.id, updated.budget.savingsGoal, updated.budget.currentSavings, newCategories).catch(err => {
          console.error("Failed to sync budget categories to Supabase:", err);
        });
      }
      return updated;
    });
  };

  const handleUpdateChatHistory = async (newChatHistory: ChatMessage[]) => {
    setOsState(prev => ({ ...prev, chatHistory: newChatHistory, lastSaved: new Date().toISOString() }));
    if (session?.user?.id) {
      try {
        await syncChatHistory(session.user.id, newChatHistory);
      } catch (err) {
        console.error("Failed to sync chat history to Supabase:", err);
      }
    }
  };

  const handleUpdateBucketList = async (newBucketList: any[]) => {
    setBucketList(newBucketList);
    if (session?.user?.id) {
      try {
        await syncBucketList(session.user.id, newBucketList);
      } catch (err) {
        console.error("Failed to sync bucket list to Supabase:", err);
      }
    }
  };

  // State Import/Export Management (JARVIS / Notion core data safety)
  const handleExportState = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(osState, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `Saisha_OS_Backup_${new Date().toISOString().split("T")[0]}.json`);
    dlAnchorElem.click();
  };

  const handleImportState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    fileReader.onload = event => {
      try {
        const result = event.target?.result;
        if (typeof result === "string") {
          const parsed = JSON.parse(result);
          // Simple verification
          if (parsed.rituals && parsed.courses && parsed.budget) {
            setOsState(parsed);
            alert("Saisha OS digital state recovered successfully. All parameters restored.");
          } else {
            alert("Selected file does not match Saisha OS blueprint format.");
          }
        }
      } catch (err) {
        alert("Error parsing backup data. Please ensure it's a valid JSON export.");
      }
    };
    fileReader.readAsText(files[0]);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      console.log("[handleEmailLogin] Blocked: empty email or password.");
      return;
    }
    setAuthLoading(true);
    setAuthStatusMessage("");
    setAuthMessageType("");

    console.log("[handleEmailLogin] Form submitted:", {
      email: email.trim(),
      passwordLength: password.length,
      isSignUp
    });

    try {
      if (isSignUp) {
        console.log("[handleEmailLogin] Calling signUpWithEmail...");
        const result = await signUpWithEmail(email, password);
        console.log("[handleEmailLogin] signUpWithEmail returned result:", result);
        setAuthMessageType("success");
        setAuthStatusMessage("Registration successful! Check your email inbox to verify your account or proceed to sign in.");
      } else {
        console.log("[handleEmailLogin] Calling signInWithPassword...");
        const result = await signInWithPassword(email, password);
        console.log("[handleEmailLogin] signInWithPassword finished successfully. Result:", result);

        // Immediate getSession query to check if session is established on the client
        if (supabase) {
          const immediateSessionResult = await supabase.auth.getSession();
          console.log("[handleEmailLogin] Immediate post-login getSession() check:", {
            sessionExists: !!immediateSessionResult.data?.session,
            userId: immediateSessionResult.data?.session?.user?.id,
            email: immediateSessionResult.data?.session?.user?.email,
            error: immediateSessionResult.error
          });
        }

        setAuthMessageType("success");
        setAuthStatusMessage("Successfully signed in!");
      }
    } catch (err: any) {
      console.error("[handleEmailLogin] Authentication process error:", err);
      setAuthMessageType("error");
      const errMsg = err.message || "";
      if (errMsg.toLowerCase().includes("rate limit")) {
        setAuthStatusMessage(
          "Email security rate limit exceeded. Supabase limits authentications to prevent abuse. " +
          "Please wait 1-2 minutes before retrying, or switch to 'Sign In' if you have already created your account."
        );
      } else {
        setAuthStatusMessage(errMsg || `Failed to ${isSignUp ? "sign up" : "sign in"}.`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthStatusMessage("");
    setAuthMessageType("");
    try {
      await handleGoogleLoginWithSupabase();
    } catch (err: any) {
      setAuthMessageType("error");
      setAuthStatusMessage(err.message || "Failed to initialize Google login.");
      setAuthLoading(false);
    }
  };

  const handleGoogleLoginWithSupabase = async () => {
    await signInWithGoogle();
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    setAuthStatusMessage("");
    setAuthMessageType("");
    try {
      await signOut();
      setAuthMessageType("success");
      setAuthStatusMessage("Signed out successfully.");
    } catch (err: any) {
      setAuthMessageType("error");
      setAuthStatusMessage("Error signing out: " + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleToggleRitual = async (id: string) => {
    const updated = osState.rituals.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
    setOsState(prev => ({ ...prev, rituals: updated, lastSaved: new Date().toISOString() }));
    if (session?.user?.id) {
      try {
        await syncRituals(session.user.id, updated);
      } catch (err) {
        console.error("Failed to sync rituals to Supabase:", err);
      }
    }
  };

  const handleUpdateFocus = async (focus: string) => {
    setOsState(prev => ({
      ...prev,
      user: { ...prev.user, currentFocus: focus },
      lastSaved: new Date().toISOString()
    }));
    if (session?.user?.id) {
      try {
        await syncProfile(session.user.id, osState.user.name, focus);
      } catch (err) {
        console.error("Failed to sync profile focus to Supabase:", err);
      }
    }
  };

  // Calculate daily ritual completion percentage
  const totalRituals = osState.rituals.length;
  const completedRituals = osState.rituals.filter(r => r.completed).length;
  const ritualsPct = totalRituals > 0 ? Math.round((completedRituals / totalRituals) * 100) : 0;

  // If user is authenticated and we are still verifying onboarding status
  if (session && isOnboardingChecking) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-violet-500 selection:text-white">
        <div className="glass-panel p-8 rounded-3xl border border-white/10 text-center space-y-4 max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-300">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-lg font-serif text-white">Calibrating Saisha OS</h2>
          <p className="text-xs text-gray-400 font-mono leading-relaxed">
            Synchronizing your profile and cloud workspace from Supabase...
          </p>
        </div>
      </div>
    );
  }

  // If user is authenticated and needs to complete onboarding
  if (session && !hasCompletedOnboarding) {
    return (
      <OnboardingFlow
        initialEmail={session.user?.email}
        initialName={session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || ""}
        onComplete={handleCompleteOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen text-gray-100 selection:bg-orange-500/30 relative overflow-hidden flex flex-col justify-between" style={{ background: "radial-gradient(circle at 0% 0%, #1a1c2c 0%, #0a0a0c 100%)" }}>
      {/* Background Orbs - Frosted Glass design mesh gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#f27d26] rounded-full blur-[120px] opacity-20 pointer-events-none ambient-orb" />
      <div className="absolute bottom-[-5%] right-[5%] w-[400px] h-[400px] bg-[#7c3aed] rounded-full blur-[100px] opacity-15 pointer-events-none ambient-orb" />
      <div className="absolute top-[30%] right-[10%] w-[350px] h-[350px] bg-[#f27d26]/10 rounded-full blur-[110px] pointer-events-none ambient-orb" />

      {/* Primary Top Bar Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#09090b]/40 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400/20 via-orange-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center shadow-lg">
            <Compass className="w-5.5 h-5.5 text-amber-300 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-serif tracking-tight text-white flex items-center gap-2">
              Saisha OS <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-400/10 text-amber-300 rounded border border-amber-400/15">v1.4</span>
            </h1>
            <p className="text-[11px] text-gray-400">Study, Creativity, Self-Care, & Auckland Living Compass</p>
          </div>
        </div>

        {/* Dynamic Auckland Clock & Daily focus */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          {/* NZ Local Time Indicator */}
          <div className="flex items-center gap-2 bg-white/3 border border-white/5 px-3 py-1.5 rounded-xl">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-gray-400">Auckland Time:</span>
            <span className="text-white font-semibold">{aucklandTime || "Calculating..."}</span>
          </div>

          {/* User Account / Sign Out widget */}
          {session ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-300 font-medium text-[11px] max-w-[170px] truncate" title={session.user?.email}>
                {session.user?.email || "Authenticated"}
              </span>
              <button
                onClick={handleLogout}
                disabled={authLoading}
                className="ml-1 text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 px-2 py-0.5 rounded-md font-mono disabled:opacity-50 cursor-pointer"
                title="Sign out of Supabase"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl text-amber-400 text-[11px]">
              <Database className="w-3.5 h-3.5" />
              <span>Local Mode</span>
            </div>
          )}

          {/* Core Backup controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportState}
              className="p-2 bg-white/3 border border-white/5 hover:border-white/10 rounded-xl text-gray-300 hover:text-white transition-all"
              title="Export OS state to JSON backup"
            >
              <FileDown className="w-4 h-4" />
            </button>
            <label
              className="p-2 bg-white/3 border border-white/5 hover:border-white/10 rounded-xl text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Import OS state from JSON backup"
            >
              <FileUp className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImportState} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      {/* Main App Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Modular Dashboards & Workspaces */}
        <div className="lg:col-span-3 space-y-6">
          {/* Welcome Card & Active Daily Focus Input */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-serif text-white">
                  Kia Ora, {osState.user.name || "Creator"}
                </h2>
                <p className="text-xs text-gray-400 mt-1">"The best way to predict your future is to invent it."</p>
              </div>

              {/* Weekly Rituals Summary */}
              <div className="text-right">
                <span className="text-xs font-mono text-gray-400 block">Daily Alignment Rituals</span>
                <span className="text-lg font-bold text-amber-400 block mt-0.5">{ritualsPct}% ({completedRituals}/{totalRituals})</span>
              </div>
            </div>

            {/* Daily Focus Input bar */}
            <div className="mt-5 pt-4 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center gap-3">
              <span className="text-xs font-mono text-amber-300 flex items-center gap-1.5 shrink-0 uppercase tracking-wide">
                <Sparkles className="w-4 h-4 animate-pulse" /> Active Horizon:
              </span>
              <input
                type="text"
                value={osState.user.currentFocus}
                onChange={e => handleUpdateFocus(e.target.value)}
                className="flex-1 bg-transparent border-b border-transparent hover:border-white/10 focus:border-amber-400 focus:outline-none text-sm text-gray-200 pb-0.5 w-full"
                placeholder="What is your absolute focus today?"
              />
            </div>
          </div>

          {/* Modular Mode Selector Bar */}
          <div className="flex p-1 bg-white/2 rounded-2xl border border-white/5 justify-between md:justify-start gap-1">
            <button
              onClick={() => setActiveMode("zenith")}
              className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeMode === "zenith"
                  ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">The Zenith</span>
            </button>

            <button
              onClick={() => setActiveMode("sanctuary")}
              className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeMode === "sanctuary"
                  ? "bg-pink-400/10 text-pink-300 border border-pink-400/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">The Sanctuary</span>
            </button>

            <button
              onClick={() => setActiveMode("studio")}
              className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeMode === "studio"
                  ? "bg-violet-400/10 text-violet-300 border border-violet-400/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Music className="w-4 h-4" />
              <span className="hidden sm:inline">The Studio</span>
            </button>

            <button
              onClick={() => setActiveMode("ledger")}
              className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeMode === "ledger"
                  ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">The Ledger</span>
            </button>
          </div>

          {/* Render Active Panels and Forms */}
          <div className="transition-all">
            {activeMode === "zenith" && (
              <ZenithPanel 
                courses={osState.courses} 
                careerMilestones={osState.careerMilestones}
                onUpdateCourses={handleUpdateCourses}
                onUpdateMilestones={handleUpdateMilestones}
              />
            )}
            {activeMode === "sanctuary" && (
              <SanctuaryPanel 
                wellnessHistory={osState.wellnessHistory}
                onAddWellnessEntry={handleAddWellnessEntry}
              />
            )}
            {activeMode === "studio" && (
              <StudioPanel 
                songs={osState.songs}
                onUpdateSongs={handleUpdateSongs}
              />
            )}
            {activeMode === "ledger" && (
              <LedgerPanel 
                savingsGoal={osState.budget.savingsGoal}
                currentSavings={osState.budget.currentSavings}
                categories={osState.budget.categories}
                onUpdateSavings={handleUpdateSavings}
                onUpdateCategories={handleUpdateCategories}
                bucketList={bucketList}
                onUpdateBucketList={handleUpdateBucketList}
              />
            )}
          </div>
        </div>

        {/* Right Side: Omnipresent Chat Assistant & Daily Rituals Side-rail */}
        <div className="space-y-6">
          {/* Supabase Integration & Authentication Card - ONLY visible when unauthenticated */}
          {!session && (
            <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="font-serif text-sm font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-orange-400" /> Supabase Connection
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-amber-400/10 text-amber-400 border-amber-400/20">
                  Local-First
                </span>
              </div>

              <div className="space-y-3.5">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Log in or register to back up your Saisha OS digital state (rituals, courses, songwriting workspace, and budgets) to your remote Supabase cloud vault.
                </p>

                <form onSubmit={handleEmailLogin} className="space-y-2">
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="saisha@example.com"
                      className="w-full glass-input px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full glass-input px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white py-2 px-3 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {authLoading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Sign Up with Email & Password" : "Sign In with Email & Password")}
                  </button>
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setAuthStatusMessage("");
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors font-mono cursor-pointer"
                    >
                      {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                    </button>
                  </div>
                </form>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-mono text-gray-600 uppercase tracking-wider">or</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full bg-orange-600 hover:bg-orange-500 border border-orange-500 text-xs font-semibold text-white py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg hover:shadow-orange-500/10"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Continue with Google
                </button>
              </div>

              {/* Error or Success Toast Message */}
              {authStatusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-2xl text-[11px] leading-relaxed flex gap-2 border ${
                    authMessageType === "success"
                      ? "bg-emerald-400/10 text-emerald-300 border-emerald-400/15"
                      : "bg-red-400/10 text-red-300 border-red-400/15"
                  }`}
                >
                  {authMessageType === "success" ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <span>{authStatusMessage}</span>
                </motion.div>
              )}
            </div>
          )}

          {/* Daily Rituals checklist card */}
          <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-4">
            <h3 className="font-serif text-sm font-semibold text-white flex items-center gap-2 border-b border-white/5 pb-2">
              <CheckSquare className="w-4 h-4 text-amber-400" /> Daily Rituals Alignment
            </h3>
            <div className="space-y-2">
              {osState.rituals.map(ritual => (
                <div
                  key={ritual.id}
                  onClick={() => handleToggleRitual(ritual.id)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/2 hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer group"
                >
                  <div className="shrink-0">
                    {ritual.completed ? (
                      <div className="w-4.5 h-4.5 rounded bg-amber-400/20 border border-amber-400 flex items-center justify-center">
                        <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                    ) : (
                      <div className="w-4.5 h-4.5 rounded border border-gray-600 group-hover:border-amber-400 transition-colors" />
                    )}
                  </div>
                  <div>
                    <span className={`text-xs ${ritual.completed ? "line-through text-gray-500" : "text-gray-300"}`}>
                      {ritual.name}
                    </span>
                    <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block mt-0.5">
                      {ritual.timeOfDay}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Context Aware AI Assistant */}
          <AIAssistant 
            osState={osState} 
            onUpdateChatHistory={handleUpdateChatHistory}
            onTasksCreated={handleTasksCreated}
          />
        </div>
      </main>

      {/* Footer information */}
      <footer className="relative z-10 border-t border-white/5 bg-[#09090b]/50 py-4 px-6 flex flex-col md:flex-row items-center justify-between text-[11px] text-gray-500 font-mono gap-2">
        <span>Designed with deep care for Saisha's future self.</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Smile className="w-3.5 h-3.5 text-amber-400" /> Auckland 2026 Ready
          </span>
          <span>Last Synchronized: {new Date(osState.lastSaved).toLocaleTimeString()}</span>
        </div>
      </footer>
    </div>
  );
}
