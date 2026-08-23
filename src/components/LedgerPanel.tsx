import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  DollarSign, 
  Plus, 
  MapPin, 
  Compass, 
  TrendingUp, 
  TrendingDown, 
  Coffee, 
  Target, 
  Sparkles,
  Map,
  CheckCircle,
  HelpCircle,
  CircleCheck,
  CheckCircle2,
  Circle
} from "lucide-react";
import { BudgetCategory } from "../types";

interface LedgerProps {
  savingsGoal: number;
  currentSavings: number;
  categories: BudgetCategory[];
  onUpdateSavings: (savings: number) => void;
  onUpdateCategories: (categories: BudgetCategory[]) => void;
  bucketList?: any[];
  onUpdateBucketList?: (items: any[]) => void;
}

// Highly curated Auckland Transition Bucket list
const INITIAL_BUCKET_LIST = [
  { id: "b1", title: "Study in the UoA Glasshouse Library", completed: false, location: "UoA Campus" },
  { id: "b2", title: "Walk up Mount Eden at sunset", completed: true, location: "Mt Eden" },
  { id: "b3", title: "Perform/check out a song at an Auckland songwriting circle", completed: false, location: "Ponsonby / City Center" },
  { id: "b4", title: "Explore Albert Park with a hot matcha latte", completed: true, location: "City" },
  { id: "b5", title: "Take the ferry to Waiheke Island on a sunny weekend", completed: false, location: "Hauraki Gulf" },
  { id: "b6", title: "Secure an AI Engineer summer internship", completed: false, location: "Auckland Tech Hub" }
];

export default function LedgerPanel({
  savingsGoal,
  currentSavings,
  categories,
  onUpdateSavings,
  onUpdateCategories,
  bucketList: propBucketList,
  onUpdateBucketList
}: LedgerProps) {
  const [activeTab, setActiveTab] = useState<"budget" | "bucket">("budget");
  
  // Local state for Auckland bucket list
  const [localBucketList, setLocalBucketList] = useState(() => {
    const local = localStorage.getItem("saisha_os_bucket");
    return local ? JSON.parse(local) : INITIAL_BUCKET_LIST;
  });

  const bucketList = propBucketList !== undefined ? propBucketList : localBucketList;

  const saveBucketList = (newList: any) => {
    if (onUpdateBucketList) {
      onUpdateBucketList(newList);
    } else {
      setLocalBucketList(newList);
      localStorage.setItem("saisha_os_bucket", JSON.stringify(newList));
    }
  };

  const handleToggleBucket = (id: string) => {
    const updated = bucketList.map((item: any) => item.id === id ? { ...item, completed: !item.completed } : item);
    saveBucketList(updated);
  };

  const [newBucketTitle, setNewBucketTitle] = useState("");
  const [newBucketLoc, setNewBucketLoc] = useState("");

  const handleAddBucketItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketTitle) return;
    const newItem = {
      id: "bucket-" + Date.now(),
      title: newBucketTitle,
      completed: false,
      location: newBucketLoc || "Auckland"
    };
    saveBucketList([...bucketList, newItem]);
    setNewBucketTitle("");
    setNewBucketLoc("");
  };

  // Budget expense logging
  const [expenseAmount, setExpenseAmount] = useState("");
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || "");

  const handleLogExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || !selectedCatId) return;
    const amount = Number(expenseAmount);
    if (isNaN(amount) || amount <= 0) return;

    const updated = categories.map(cat => {
      if (cat.id === selectedCatId) {
        return { ...cat, spent: cat.spent + amount };
      }
      return cat;
    });

    onUpdateCategories(updated);
    setExpenseAmount("");
  };

  const handleResetExpenses = () => {
    if (!confirm("Reset all weekly expenditures back to $0? This is typically done at the beginning of each week.")) return;
    const updated = categories.map(cat => ({ ...cat, spent: 0 }));
    onUpdateCategories(updated);
  };

  const [savingContribution, setSavingContribution] = useState("");

  const handleAddSavings = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(savingContribution);
    if (isNaN(amount) || amount <= 0) return;
    onUpdateSavings(currentSavings + amount);
    setSavingContribution("");
  };

  const savingsPct = Math.round((currentSavings / savingsGoal) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-2xl font-serif text-emerald-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            The Auckland Ledger & Compass
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Tracking your financial independence milestones and plotting your geographical bucket list in New Zealand.
          </p>
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 self-start">
          <button
            onClick={() => setActiveTab("budget")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "budget"
                ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Weekly NZ Budget
            </span>
          </button>
          <button
            onClick={() => setActiveTab("bucket")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "bucket"
                ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <Map className="w-4 h-4" /> Auckland Compass
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "budget" ? (
          <motion.div
            key="budget"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Savings Goal Tracker */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Target className="w-4 h-4" /> Emergency Reserve / Auckland Set-up Goal
                  </span>
                  <h3 className="text-xl font-serif text-white">
                    NZD ${currentSavings.toLocaleString()} of ${savingsGoal.toLocaleString()}
                  </h3>
                </div>

                <form onSubmit={handleAddSavings} className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                  <input
                    type="number"
                    placeholder="Contribute amount..."
                    value={savingContribution}
                    onChange={e => setSavingContribution(e.target.value)}
                    className="px-3 py-1.5 text-xs glass-input w-36"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-200 border border-emerald-400/20 rounded-xl text-xs font-semibold transition-all"
                  >
                    Add Savings
                  </button>
                </form>
              </div>

              {/* Progress Slider */}
              <div className="space-y-2 mt-5">
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>Auckland Readiness Cushion</span>
                  <span>{savingsPct}% achieved</span>
                </div>
                <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(savingsPct, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Auckland Weekly Budget Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category cards */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-serif text-emerald-200/90 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" /> Weekly Costs Monitor (NZD)
                  </h3>
                  <button
                    onClick={handleResetExpenses}
                    className="text-xs font-mono text-emerald-400/80 hover:text-emerald-300 transition-colors"
                  >
                    Reset Weekly Spends
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categories.map(cat => {
                    const spentPct = cat.budgeted > 0 ? Math.round((cat.spent / cat.budgeted) * 100) : 0;
                    const isOver = cat.spent > cat.budgeted;

                    return (
                      <div key={cat.id} className="glass-card rounded-2xl p-4 border border-white/5 space-y-3 relative overflow-hidden">
                        {isOver && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
                        )}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider block">{cat.name}</span>
                            <span className="text-lg font-bold text-white mt-1 block">
                              ${cat.spent} <span className="text-xs text-gray-400 font-normal">/ ${cat.budgeted}</span>
                            </span>
                          </div>
                          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                            isOver 
                              ? "bg-rose-500/10 text-rose-300" 
                              : spentPct > 80 
                                ? "bg-amber-500/10 text-amber-300" 
                                : "bg-emerald-500/10 text-emerald-300"
                          }`}>
                            {spentPct}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOver ? "bg-rose-500" : "bg-emerald-400"
                            }`} 
                            style={{ width: `${Math.min(spentPct, 100)}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Log Expense Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-serif text-emerald-200/90 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-emerald-400" /> Log NZ Transaction
                </h3>

                <form onSubmit={handleLogExpense} className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Amount (NZD)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={expenseAmount}
                        onChange={e => setExpenseAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 text-sm glass-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Category Allocation</label>
                    <select
                      value={selectedCatId}
                      onChange={e => setSelectedCatId(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm glass-input bg-[#121217] text-white"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-200 border border-emerald-400/20 rounded-xl font-medium text-sm hover:from-emerald-500/30 hover:to-teal-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Record Transaction
                  </button>
                </form>

                {/* Auckland Wisdom card */}
                <div className="glass-card rounded-2xl p-4 border border-white/5 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 flex gap-3">
                  <Coffee className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-200">Auckland Budget Wisdom</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                      New Zealand rentals are budgeted weekly rather than monthly. Keep your public transport costs low by capping weekly AT Hop card fares. Perfect for student budgets!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="bucket"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Auckland Compass Bucket list */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Checklist */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-serif text-emerald-200/90 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-emerald-400" /> Auckland Relocation Bucket List
                </h3>

                <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-3">
                  {bucketList.map((item: any) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleBucket(item.id)}
                      className="flex items-start justify-between p-3.5 rounded-2xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-emerald-400/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="mt-0.5 shrink-0">
                          {item.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-500 group-hover:text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <span className={`text-sm font-medium block ${item.completed ? "line-through text-gray-500" : "text-gray-200"}`}>
                            {item.title}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-gray-400 mt-1">
                            <MapPin className="w-3 h-3 text-emerald-400/60" /> {item.location}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md border ${
                        item.completed 
                          ? "border-gray-500/20 text-gray-500 bg-gray-500/5" 
                          : "border-emerald-400/20 text-emerald-300 bg-emerald-400/5"
                      } shrink-0`}>
                        {item.completed ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Bucket Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-serif text-emerald-200/90 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" /> Pin New Experience
                </h3>

                <form onSubmit={handleAddBucketItem} className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Experience Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Walk the Tamaki Drive waterfront"
                      value={newBucketTitle}
                      onChange={e => setNewBucketTitle(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm glass-input"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Geographical Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Mission Bay, Auckland"
                      value={newBucketLoc}
                      onChange={e => setNewBucketLoc(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm glass-input"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-200 border border-emerald-400/20 rounded-xl font-medium text-sm hover:from-emerald-500/30 hover:to-teal-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add to Compass
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
