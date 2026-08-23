import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  User,
  GraduationCap,
  Briefcase,
  Target,
  Clock,
  Heart,
  Settings,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  DollarSign,
  Music,
  Compass,
  Smile,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight
} from "lucide-react";
import { OnboardingData } from "../types";

interface OnboardingFlowProps {
  initialEmail?: string;
  initialName?: string;
  onComplete: (data: OnboardingData) => Promise<void>;
}

const STEPS = [
  { id: 1, title: "About You", subtitle: "Identity & Academics", icon: GraduationCap },
  { id: 2, title: "Career", subtitle: "Aspirations & Skills", icon: Briefcase },
  { id: 3, title: "Goals", subtitle: "Academic, Career & Creative", icon: Target },
  { id: 4, title: "Daily Life", subtitle: "Routines & Rituals", icon: Clock },
  { id: 5, title: "Wellbeing", subtitle: "Optional Sanctuary", icon: Heart },
  { id: 6, title: "Preferences", subtitle: "System Customization", icon: Settings }
];

const SUGGESTED_INTERESTS = [
  "AI Engineering", "Machine Learning", "Data Science", "Full Stack Dev",
  "Product Engineering", "Creative Tech", "Robotics", "Cloud Architecture"
];

const SUGGESTED_SKILLS = [
  "Python & PyTorch", "TypeScript & React", "Next.js", "Large Language Models",
  "PostgreSQL & Vector DBs", "Docker & Kubernetes", "System Architecture", "Git Workflow"
];

const SUGGESTED_RITUALS = [
  { name: "Morning Hydration & Sunlight", timeOfDay: "morning" as const, category: "health" as const },
  { name: "Daily Deep Study / Focus Block", timeOfDay: "afternoon" as const, category: "academic" as const },
  { name: "Physical Movement / Walk", timeOfDay: "afternoon" as const, category: "fitness" as const },
  { name: "Evening Skincare & Self-Care", timeOfDay: "night" as const, category: "health" as const },
  { name: "Night Reflection & Wind-Down", timeOfDay: "night" as const, category: "mind" as const }
];

export default function OnboardingFlow({ initialEmail, initialName, onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Step 1: About You
  const [preferredName, setPreferredName] = useState(initialName || (initialEmail ? initialEmail.split("@")[0] : ""));
  const [university, setUniversity] = useState("");
  const [degree, setDegree] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("Year 1");
  const [courses, setCourses] = useState<Array<{ code: string; name: string; gradeGoal: string }>>([
    { code: "", name: "", gradeGoal: "A" }
  ]);

  // Step 2: Career
  const [careerInterests, setCareerInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [desiredRoles, setDesiredRoles] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [skillsToDevelop, setSkillsToDevelop] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [internshipJobGoals, setInternshipJobGoals] = useState("");
  const [targetCompaniesOrLocations, setTargetCompaniesOrLocations] = useState("");

  // Step 3: Goals
  const [academicGoals, setAcademicGoals] = useState("");
  const [careerGoals, setCareerGoals] = useState("");
  const [creativeGoals, setCreativeGoals] = useState("");
  const [personalGoals, setPersonalGoals] = useState("");
  const [trackFinances, setTrackFinances] = useState(false);
  const [savingsGoal, setSavingsGoal] = useState<number>(5000);
  const [budgetCategories, setBudgetCategories] = useState<Array<{ name: string; budgeted: number }>>([
    { name: "Rent & Utilities", budgeted: 300 },
    { name: "Groceries & Food", budgeted: 120 },
    { name: "Transport & Transit", budgeted: 40 },
    { name: "Personal & Study", budgeted: 50 }
  ]);

  // Step 4: Daily Life
  const [typicalWakeTime, setTypicalWakeTime] = useState("07:30");
  const [typicalSleepTime, setTypicalSleepTime] = useState("23:30");
  const [exerciseHabits, setExerciseHabits] = useState("");
  const [studyPreferences, setStudyPreferences] = useState("");
  const [creativeHabits, setCreativeHabits] = useState("");
  const [selfCareRoutines, setSelfCareRoutines] = useState<string[]>(["Morning hydration", "Evening skincare"]);
  const [consistencyFocus, setConsistencyFocus] = useState("");
  const [selectedRituals, setSelectedRituals] = useState(SUGGESTED_RITUALS);

  // Step 5: Wellbeing (Optional)
  const [enableWellbeing, setEnableWellbeing] = useState(true);
  const [wellbeingGoals, setWellbeingGoals] = useState("");
  const [sleepConsistency, setSleepConsistency] = useState("");
  const [exerciseRoutines, setExerciseRoutines] = useState("");
  const [energyChallenges, setEnergyChallenges] = useState("");
  const [supportPreferences, setSupportPreferences] = useState("");

  // Step 6: Preferences
  const [enabledAreas, setEnabledAreas] = useState({
    academics: true,
    career: true,
    creativity: true,
    finance: true,
    dailyRoutines: true,
    wellbeing: true
  });
  const [priorityFocus, setPriorityFocus] = useState("");

  // Course helpers
  const handleAddCourse = () => {
    setCourses([...courses, { code: "", name: "", gradeGoal: "A" }]);
  };
  const handleRemoveCourse = (index: number) => {
    setCourses(courses.filter((_, i) => i !== index));
  };
  const handleCourseChange = (index: number, field: "code" | "name" | "gradeGoal", value: string) => {
    const updated = [...courses];
    updated[index][field] = value;
    setCourses(updated);
  };

  // Tag togglers
  const toggleInterest = (interest: string) => {
    setCareerInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };
  const addCustomInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInterest.trim() && !careerInterests.includes(customInterest.trim())) {
      setCareerInterests([...careerInterests, customInterest.trim()]);
      setCustomInterest("");
    }
  };

  const toggleSkill = (skill: string) => {
    setSkillsToDevelop(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };
  const addCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSkill.trim() && !skillsToDevelop.includes(customSkill.trim())) {
      setSkillsToDevelop([...skillsToDevelop, customSkill.trim()]);
      setCustomSkill("");
    }
  };

  const addCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (customRole.trim() && !desiredRoles.includes(customRole.trim())) {
      setDesiredRoles([...desiredRoles, customRole.trim()]);
      setCustomRole("");
    }
  };

  // Ritual helper
  const toggleRitual = (r: typeof SUGGESTED_RITUALS[0]) => {
    if (selectedRituals.some(item => item.name === r.name)) {
      setSelectedRituals(selectedRituals.filter(item => item.name !== r.name));
    } else {
      setSelectedRituals([...selectedRituals, r]);
    }
  };

  // Budget helper
  const handleAddBudgetCategory = () => {
    setBudgetCategories([...budgetCategories, { name: "", budgeted: 50 }]);
  };
  const handleRemoveBudgetCategory = (index: number) => {
    setBudgetCategories(budgetCategories.filter((_, i) => i !== index));
  };
  const handleBudgetCategoryChange = (index: number, field: "name" | "budgeted", val: any) => {
    const updated = [...budgetCategories];
    if (field === "name") updated[index].name = val;
    if (field === "budgeted") updated[index].budgeted = Number(val) || 0;
    setBudgetCategories(updated);
  };

  const validateStep = (step: number): boolean => {
    setErrorMsg("");
    if (step === 1) {
      if (!preferredName.trim()) {
        setErrorMsg("Please enter your preferred name.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleFinalSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setSubmitting(true);
    setErrorMsg("");

    const onboardingPayload: OnboardingData = {
      preferredName: preferredName.trim(),
      university: university.trim(),
      degree: degree.trim(),
      yearOfStudy,
      courses: courses.filter(c => c.code.trim() || c.name.trim()),
      careerInterests,
      desiredRoles,
      industries,
      skillsToDevelop,
      internshipJobGoals: internshipJobGoals.trim(),
      targetCompaniesOrLocations: targetCompaniesOrLocations.trim(),
      academicGoals: academicGoals.trim(),
      careerGoals: careerGoals.trim(),
      creativeGoals: creativeGoals.trim(),
      personalGoals: personalGoals.trim(),
      trackFinances,
      savingsGoal: trackFinances ? savingsGoal : 0,
      budgetCategories: trackFinances ? budgetCategories.filter(c => c.name.trim()) : [],
      typicalWakeTime,
      typicalSleepTime,
      exerciseHabits: exerciseHabits.trim(),
      studyPreferences: studyPreferences.trim(),
      creativeHabits: creativeHabits.trim(),
      selfCareRoutines,
      consistencyFocus: consistencyFocus.trim(),
      rituals: selectedRituals,
      enableWellbeing,
      wellbeingGoals: enableWellbeing ? wellbeingGoals.trim() : "",
      sleepConsistency: enableWellbeing ? sleepConsistency.trim() : "",
      exerciseRoutines: enableWellbeing ? exerciseRoutines.trim() : "",
      energyChallenges: enableWellbeing ? energyChallenges.trim() : "",
      supportPreferences: enableWellbeing ? supportPreferences.trim() : "",
      enabledAreas,
      priorityFocus: priorityFocus.trim() || academicGoals.trim() || careerGoals.trim() || "Thriving in university and life"
    };

    try {
      await onComplete(onboardingPayload);
    } catch (err: any) {
      console.error("Onboarding submission failed:", err);
      setErrorMsg(err.message || "Failed to save onboarding data. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 selection:bg-violet-500 selection:text-white">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto w-full space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-mono tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            First-Time Setup Experience
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight">
            Welcome to Saisha OS
          </h1>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Let's personalize your private workspace. Everything you enter here populates your personal cloud vault.
          </p>
        </div>

        {/* Step Progression Bar */}
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-white/10">
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isCurrent = step.id === currentStep;
              const isPast = step.id < currentStep;

              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (step.id < currentStep) setCurrentStep(step.id);
                  }}
                  disabled={step.id > currentStep}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-center transition-all ${
                    isCurrent
                      ? "bg-violet-500/20 border border-violet-500/40 text-violet-200"
                      : isPast
                      ? "bg-white/5 border border-white/10 text-emerald-300 hover:bg-white/10 cursor-pointer"
                      : "opacity-40 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                    isCurrent
                      ? "bg-violet-500/30 text-white"
                      : isPast
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/5 text-gray-400"
                  }`}>
                    {isPast ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[10px] font-medium hidden sm:block truncate w-full">
                    {step.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dynamic Step Container */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 min-h-[420px]">
          <AnimatePresence mode="wait">
            {/* STEP 1: ABOUT YOU */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <h2 className="text-xl font-serif text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-violet-400" />
                    About You
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Your personal and academic foundation for Saisha OS.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Preferred Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Saisha, Deepak, Alex"
                      value={preferredName}
                      onChange={e => setPreferredName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      University / Institution
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. University of Auckland"
                      value={university}
                      onChange={e => setUniversity(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Degree / Program
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BSc Computer Science & Statistics"
                      value={degree}
                      onChange={e => setDegree(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Year of Study
                    </label>
                    <select
                      value={yearOfStudy}
                      onChange={e => setYearOfStudy(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm bg-[#121217] text-white"
                    >
                      <option value="Year 1">Year 1 (Freshman / First Year)</option>
                      <option value="Year 2">Year 2 (Sophomore / Second Year)</option>
                      <option value="Year 3">Year 3 (Penultimate / Third Year)</option>
                      <option value="Year 4+">Year 4+ (Senior / Honours)</option>
                      <option value="Postgraduate">Postgraduate / Masters / PhD</option>
                      <option value="Self-Directed">Self-Directed / Professional</option>
                    </select>
                  </div>
                </div>

                {/* Courses Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Current Subjects & Courses</h3>
                      <p className="text-[11px] text-gray-400">Add the courses you are studying this term.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCourse}
                      className="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/20 hover:bg-violet-500/30 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Course
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {courses.map((course, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/2 border border-white/5">
                        <input
                          type="text"
                          placeholder="Code (e.g. COMPSCI 760)"
                          value={course.code}
                          onChange={e => handleCourseChange(idx, "code", e.target.value)}
                          className="w-36 px-3 py-1.5 text-xs glass-input text-white uppercase font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Course Title (e.g. Machine Learning & Neural Nets)"
                          value={course.name}
                          onChange={e => handleCourseChange(idx, "name", e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs glass-input text-white"
                        />
                        <input
                          type="text"
                          placeholder="Target (e.g. A+)"
                          value={course.gradeGoal}
                          onChange={e => handleCourseChange(idx, "gradeGoal", e.target.value)}
                          className="w-20 px-3 py-1.5 text-xs glass-input text-white font-mono text-center"
                        />
                        {courses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCourse(idx)}
                            className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: CAREER */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <h2 className="text-xl font-serif text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                    Career & Skills Trajectory
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Define your industry interests, desired roles, and target competencies.
                  </p>
                </div>

                {/* Career Interests */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                    Career Interests & Domains
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_INTERESTS.map((interest) => {
                      const selected = careerInterests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            selected
                              ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-200"
                              : "bg-white/2 border-white/10 text-gray-400 hover:border-white/20"
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 inline mr-1" />}
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                  <form onSubmit={addCustomInterest} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add custom interest..."
                      value={customInterest}
                      onChange={e => setCustomInterest(e.target.value)}
                      className="px-3 py-1.5 text-xs glass-input flex-1"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300"
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Skills to Develop */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                    Skills You Want to Develop
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_SKILLS.map((skill) => {
                      const selected = skillsToDevelop.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            selected
                              ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                              : "bg-white/2 border-white/10 text-gray-400 hover:border-white/20"
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 inline mr-1" />}
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                  <form onSubmit={addCustomSkill} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add custom skill (e.g. Rust, PySpark)..."
                      value={customSkill}
                      onChange={e => setCustomSkill(e.target.value)}
                      className="px-3 py-1.5 text-xs glass-input flex-1"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300"
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Internship & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Internship / Job Goal
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Secure Summer 2026 AI Engineer role"
                      value={internshipJobGoals}
                      onChange={e => setInternshipJobGoals(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Target Companies or Locations
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Auckland, Sydney, Remote Tech Hubs"
                      value={targetCompaniesOrLocations}
                      onChange={e => setTargetCompaniesOrLocations(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: GOALS */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <h2 className="text-xl font-serif text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-400" />
                    Holistic Goals & Targets
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Articulate what you are striving towards across academics, creativity, and life.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Academic Goal
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maintain First Class Honours / A GPA"
                      value={academicGoals}
                      onChange={e => setAcademicGoals(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Career Goal
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Build 2 production AI web platforms"
                      value={careerGoals}
                      onChange={e => setCareerGoals(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Creative / Passion Goal
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Write & produce 3 acoustic song drafts"
                      value={creativeGoals}
                      onChange={e => setCreativeGoals(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Personal / Life Goal
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Build consistent morning and sleep routines"
                      value={personalGoals}
                      onChange={e => setPersonalGoals(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>
                </div>

                {/* Financial Tracking Section */}
                <div className="p-4 rounded-2xl bg-white/2 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h4 className="text-sm font-semibold text-white">Enable Financial Compass & Ledger</h4>
                        <p className="text-[11px] text-gray-400">Track savings targets and weekly budget allocations.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTrackFinances(!trackFinances)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        trackFinances ? "bg-emerald-500" : "bg-white/10"
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        trackFinances ? "translate-x-6" : ""
                      }`} />
                    </button>
                  </div>

                  {trackFinances && (
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                          Savings Milestone Goal ($)
                        </label>
                        <input
                          type="number"
                          value={savingsGoal}
                          onChange={e => setSavingsGoal(Number(e.target.value))}
                          className="w-full sm:w-64 px-3 py-2 rounded-xl glass-input text-sm text-white font-mono"
                        />
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                            Weekly Budget Categories
                          </label>
                          <button
                            type="button"
                            onClick={handleAddBudgetCategory}
                            className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add Category
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {budgetCategories.map((cat, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-white/5">
                              <input
                                type="text"
                                value={cat.name}
                                onChange={e => handleBudgetCategoryChange(idx, "name", e.target.value)}
                                placeholder="Category name"
                                className="flex-1 px-2 py-1 text-xs glass-input text-white"
                              />
                              <span className="text-xs font-mono text-gray-400">$</span>
                              <input
                                type="number"
                                value={cat.budgeted}
                                onChange={e => handleBudgetCategoryChange(idx, "budgeted", e.target.value)}
                                className="w-20 px-2 py-1 text-xs glass-input text-white font-mono"
                              />
                              {budgetCategories.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBudgetCategory(idx)}
                                  className="text-gray-500 hover:text-rose-400 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 4: DAILY LIFE & ROUTINES */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <h2 className="text-xl font-serif text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Daily Life & Consistency
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Design the baseline rhythm that keeps you centered and productive.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Target Wake Time
                    </label>
                    <input
                      type="time"
                      value={typicalWakeTime}
                      onChange={e => setTypicalWakeTime(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white bg-[#121217]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Target Sleep Time
                    </label>
                    <input
                      type="time"
                      value={typicalSleepTime}
                      onChange={e => setTypicalSleepTime(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white bg-[#121217]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Study & Focus Preferences
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 90-min morning deep work sessions"
                      value={studyPreferences}
                      onChange={e => setStudyPreferences(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                      Movement / Exercise Routine
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Morning walk + gym 3x weekly"
                      value={exerciseHabits}
                      onChange={e => setExerciseHabits(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                    />
                  </div>
                </div>

                {/* Daily Rituals Calibration */}
                <div className="space-y-3 pt-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Select Your Initial Daily Rituals</h3>
                    <p className="text-[11px] text-gray-400">These will appear on your daily alignment board.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SUGGESTED_RITUALS.map((r, idx) => {
                      const isSelected = selectedRituals.some(item => item.name === r.name);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleRitual(r)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? "bg-amber-400/10 border-amber-400/30 text-amber-200"
                              : "bg-white/2 border-white/5 text-gray-400 hover:border-white/10"
                          }`}
                        >
                          <div>
                            <span className="text-xs font-medium text-white block">{r.name}</span>
                            <span className="text-[10px] font-mono text-gray-400 uppercase">
                              {r.timeOfDay} • {r.category}
                            </span>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                            isSelected ? "bg-amber-400 text-black border-amber-400" : "border-white/20"
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 5: WELLBEING (OPTIONAL) */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-serif text-white flex items-center gap-2">
                        <Heart className="w-5 h-5 text-rose-400" />
                        Sanctuary & Wellbeing (Optional)
                      </h2>
                      <p className="text-xs text-gray-400 mt-1">
                        Track holistic recovery, daily mood, journaling, and stress management.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableWellbeing(!enableWellbeing)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                        enableWellbeing ? "bg-rose-500" : "bg-white/10"
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        enableWellbeing ? "translate-x-6" : ""
                      }`} />
                    </button>
                  </div>
                </div>

                {enableWellbeing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                          Primary Wellbeing Goal
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Reduce academic burnout, sustain energy"
                          value={wellbeingGoals}
                          onChange={e => setWellbeingGoals(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                          Sleep Consistency Target
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 7.5 to 8 hours uninterrupted"
                          value={sleepConsistency}
                          onChange={e => setSleepConsistency(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                          Energy or Routine Challenges
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Mid-afternoon slump, late-night phone use"
                          value={energyChallenges}
                          onChange={e => setEnergyChallenges(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                          Desired AI Support / Reminders
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Gentle reminders to hydrate and pause"
                          value={supportPreferences}
                          onChange={e => setSupportPreferences(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-white"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-white/2 border border-white/5 text-center space-y-2">
                    <Heart className="w-8 h-8 text-gray-500 mx-auto" />
                    <h3 className="text-sm font-semibold text-gray-300">Wellbeing Module Disabled</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      You can always re-enable the Sanctuary workspace anytime in your system settings.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 6: SAISHA OS PREFERENCES */}
            {currentStep === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="border-b border-white/5 pb-4">
                  <h2 className="text-xl font-serif text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-violet-400" />
                    System Customization & Launch
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Choose which core workspace modules to display in your navigation bar.
                  </p>
                </div>

                {/* Priority Focus */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-violet-300 uppercase tracking-wider">
                    Core Priority Focus For This Season
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A+ in Advanced ML, building my AI portfolio, and healthy sleep"
                    value={priorityFocus}
                    onChange={e => setPriorityFocus(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm text-white border-violet-500/30"
                  />
                  <p className="text-[11px] text-gray-500 font-mono">
                    This active focus is permanently pinned to your header and briefed to Saisha AI.
                  </p>
                </div>

                {/* Workspace Modules */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-mono text-gray-300 uppercase tracking-wider block">
                    Active Workspaces
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "academics", label: "The Zenith (Academics & Study)", icon: BookOpen, desc: "Course tracking, assignments, lectures, GPA planner" },
                      { id: "career", label: "Career & Portfolio Hub", icon: Briefcase, desc: "Milestones, skills, internship tracking, projects" },
                      { id: "creativity", label: "Songwriting Studio", icon: Music, desc: "Acoustic lyrics sandbox, chord progressions, song catalog" },
                      { id: "finance", label: "Ledger & Compass", icon: DollarSign, desc: "Financial independence milestones and bucket list" },
                      { id: "dailyRoutines", label: "Daily Rituals & Streaks", icon: Clock, desc: "Morning, afternoon, and night habit alignment" },
                      { id: "wellbeing", label: "The Sanctuary", icon: Heart, desc: "Mindfulness journal, mood, and holistic self-care" }
                    ].map((mod) => {
                      const Icon = mod.icon;
                      const isEnabled = (enabledAreas as any)[mod.id];
                      return (
                        <div
                          key={mod.id}
                          onClick={() => setEnabledAreas({ ...enabledAreas, [mod.id]: !isEnabled })}
                          className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                            isEnabled
                              ? "bg-violet-500/10 border-violet-500/30 text-white"
                              : "bg-white/2 border-white/5 text-gray-500"
                          }`}
                        >
                          <div className={`p-2 rounded-xl shrink-0 ${
                            isEnabled ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-gray-500"
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold block">{mod.label}</span>
                            <span className="text-[11px] text-gray-400 leading-snug block mt-0.5">{mod.desc}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                            isEnabled ? "bg-violet-500 text-white border-violet-500" : "border-white/20"
                          }`}>
                            {isEnabled && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between pt-2">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-violet-600/20"
            >
              Next Step <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-emerald-600 hover:opacity-95 text-white text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer shadow-xl shadow-violet-600/30"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Initializing Saisha OS Cloud Vault...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Launch My Saisha OS
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
