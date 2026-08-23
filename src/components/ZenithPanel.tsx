import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  GraduationCap, 
  Briefcase, 
  Plus, 
  CheckCircle2, 
  Circle, 
  BookOpen, 
  Trophy, 
  ChevronRight, 
  PlusCircle, 
  Sparkles,
  Layers,
  Terminal
} from "lucide-react";
import { UniversityCourse, CareerMilestone } from "../types";

interface ZenithProps {
  courses: UniversityCourse[];
  careerMilestones: CareerMilestone[];
  onUpdateCourses: (courses: UniversityCourse[]) => void;
  onUpdateMilestones: (milestones: CareerMilestone[]) => void;
}

export default function ZenithPanel({ 
  courses, 
  careerMilestones, 
  onUpdateCourses, 
  onUpdateMilestones 
}: ZenithProps) {
  const [activeSubTab, setActiveSubTab] = useState<"university" | "career">("university");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseGoal, setNewCourseGoal] = useState("A+");

  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneCategory, setNewMilestoneCategory] = useState<"skill" | "project" | "internship">("skill");
  const [newMilestoneDetails, setNewMilestoneDetails] = useState("");

  const [selectedCourseIdForTask, setSelectedCourseIdForTask] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskWeight, setNewTaskWeight] = useState(10);
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  // Course Actions
  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode || !newCourseName) return;
    const newCourse: UniversityCourse = {
      id: "course-" + Date.now(),
      code: newCourseCode.toUpperCase(),
      name: newCourseName,
      credits: 15,
      gradeGoal: newCourseGoal,
      tasks: []
    };
    onUpdateCourses([...courses, newCourse]);
    setNewCourseCode("");
    setNewCourseName("");
  };

  const handleToggleTask = (courseId: string, taskId: string) => {
    const updated = courses.map(c => {
      if (c.id === courseId) {
        return {
          ...c,
          tasks: c.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
        };
      }
      return c;
    });
    onUpdateCourses(updated);
  };

  const handleAddTask = (e: React.FormEvent, courseId: string) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    const updated = courses.map(c => {
      if (c.id === courseId) {
        return {
          ...c,
          tasks: [
            ...c.tasks,
            {
              id: "task-" + Date.now(),
              title: newTaskTitle,
              weight: Number(newTaskWeight),
              dueDate: newTaskDueDate || new Date().toISOString().split("T")[0],
              completed: false
            }
          ]
        };
      }
      return c;
    });
    onUpdateCourses(updated);
    setNewTaskTitle("");
    setNewTaskWeight(10);
    setNewTaskDueDate("");
    setSelectedCourseIdForTask(null);
  };

  // Milestone Actions
  const handleToggleMilestone = (id: string) => {
    const updated = careerMilestones.map(m => m.id === id ? { ...m, completed: !m.completed } : m);
    onUpdateMilestones(updated);
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle) return;
    const newMilestone: CareerMilestone = {
      id: "milestone-" + Date.now(),
      title: newMilestoneTitle,
      category: newMilestoneCategory,
      completed: false,
      details: newMilestoneDetails
    };
    onUpdateMilestones([...careerMilestones, newMilestone]);
    setNewMilestoneTitle("");
    setNewMilestoneDetails("");
  };

  return (
    <div className="space-y-6">
      {/* Header and Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-2xl font-serif text-amber-100 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-amber-400" />
            The Zenith Workspace
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Tracking your academic journey at the University of Auckland & your ascent to elite AI engineering status.
          </p>
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 self-start">
          <button
            onClick={() => setActiveSubTab("university")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === "university"
                ? "bg-amber-400/20 text-amber-200 border border-amber-400/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> UoA Academics
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab("career")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === "career"
                ? "bg-amber-400/20 text-amber-200 border border-amber-400/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4" /> AI Career & Milestones
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "university" ? (
          <motion.div
            key="university"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Academic Summary Widget */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">Academics</span>
                <span className="text-3xl font-bold font-serif text-white block mt-2">{courses.length}</span>
                <span className="text-xs text-gray-400 mt-1 block">Active Courses this Term</span>
              </div>
              <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />
                <span className="text-xs font-mono text-orange-400 uppercase tracking-wider block">Target Grade</span>
                <span className="text-3xl font-bold font-serif text-white block mt-2">A / A+</span>
                <span className="text-xs text-gray-400 mt-1 block">University GPA Standard</span>
              </div>
              <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl" />
                <span className="text-xs font-mono text-pink-400 uppercase tracking-wider block">Upcoming Deliverables</span>
                <span className="text-3xl font-bold font-serif text-white block mt-2">
                  {courses.reduce((acc, c) => acc + c.tasks.filter(t => !t.completed).length, 0)}
                </span>
                <span className="text-xs text-gray-400 mt-1 block">Tasks remaining</span>
              </div>
            </div>

            {/* Courses List */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-4">
                <h3 className="text-lg font-serif text-amber-200/90 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" /> Current Coursework
                </h3>

                {courses.length === 0 ? (
                  <div className="glass-card rounded-2xl p-8 text-center border border-white/5">
                    <p className="text-gray-400 text-sm">No courses added. Start by adding your University of Auckland courses.</p>
                  </div>
                ) : (
                  courses.map(course => {
                    const completedTasks = course.tasks.filter(t => t.completed).length;
                    const totalTasks = course.tasks.length;
                    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                    return (
                      <div key={course.id} className="glass-card rounded-2xl p-5 border border-white/5 space-y-4 hover:border-amber-400/20 transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-mono px-2 py-0.5 bg-amber-400/10 text-amber-300 rounded-md border border-amber-400/10">
                              {course.code}
                            </span>
                            <h4 className="font-serif text-lg text-white mt-2">{course.name}</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono text-gray-400 block">Goal Grade</span>
                            <span className="text-lg font-bold text-amber-400">{course.gradeGoal}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-400 font-mono">
                            <span>Syllabus Completion</span>
                            <span>{pct}% ({completedTasks}/{totalTasks})</span>
                          </div>
                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        {/* Tasks List */}
                        <div className="space-y-2 mt-2">
                          <h5 className="text-xs font-mono text-gray-400 uppercase tracking-wider">Assignments & Milestones</h5>
                          {course.tasks.length === 0 ? (
                            <p className="text-xs text-gray-500 italic pl-1">No assignments or tests listed yet.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {course.tasks.map(task => (
                                <div 
                                  key={task.id} 
                                  onClick={() => handleToggleTask(course.id, task.id)}
                                  className="flex items-center justify-between p-2 rounded-xl bg-white/2 hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3">
                                    {task.completed ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-gray-500 group-hover:text-amber-400 shrink-0" />
                                    )}
                                    <span className={`text-sm ${task.completed ? "line-through text-gray-500" : "text-gray-300"}`}>
                                      {task.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
                                    <span>{task.weight}% of grade</span>
                                    <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px]">Due: {task.dueDate}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Assignment Trigger */}
                          {selectedCourseIdForTask === course.id ? (
                            <form onSubmit={(e) => handleAddTask(e, course.id)} className="mt-3 p-3 bg-white/3 rounded-xl border border-white/5 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  placeholder="Assignment or Exam Name..."
                                  value={newTaskTitle}
                                  onChange={e => setNewTaskTitle(e.target.value)}
                                  className="px-3 py-1.5 text-xs glass-input md:col-span-1"
                                  required
                                />
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400 font-mono">Weight:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={newTaskWeight}
                                    onChange={e => setNewTaskWeight(Number(e.target.value))}
                                    className="px-2 py-1.5 text-xs glass-input w-16"
                                  />
                                  <span className="text-[10px] text-gray-400 font-mono">%</span>
                                </div>
                                <input
                                  type="date"
                                  value={newTaskDueDate}
                                  onChange={e => setNewTaskDueDate(e.target.value)}
                                  className="px-2 py-1.5 text-xs glass-input"
                                />
                              </div>
                              <div className="flex justify-end gap-2 text-xs">
                                <button 
                                  type="button" 
                                  onClick={() => setSelectedCourseIdForTask(null)}
                                  className="px-2.5 py-1 text-gray-400 hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button 
                                  type="submit" 
                                  className="px-3 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/20 rounded-lg font-medium transition-all"
                                >
                                  Add Task
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={() => setSelectedCourseIdForTask(course.id)}
                              className="mt-2 text-xs font-mono text-amber-400/80 hover:text-amber-300 flex items-center gap-1 pl-1 transition-colors"
                            >
                              <PlusCircle className="w-3.5 h-3.5" /> Add assessment milestone
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Course Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-serif text-amber-200/90 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-amber-400" /> Enlist New Course
                </h3>
                <form onSubmit={handleAddCourse} className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Course Code</label>
                    <input
                      type="text"
                      placeholder="e.g. STATS 782"
                      value={newCourseCode}
                      onChange={e => setNewCourseCode(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm glass-input"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Course Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Statistical Computing"
                      value={newCourseName}
                      onChange={e => setNewCourseName(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm glass-input"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase font-medium">Grade Target</label>
                    <select
                      value={newCourseGoal}
                      onChange={e => setNewCourseGoal(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm glass-input bg-[#121217] text-white"
                    >
                      <option value="A+">A+ (Supreme Standard)</option>
                      <option value="A">A (Excellent Achievement)</option>
                      <option value="A-">A- (Highly Acceptable)</option>
                      <option value="B+">B+ (Balanced State)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-200 border border-amber-400/20 rounded-xl font-medium text-sm hover:from-amber-500/30 hover:to-orange-500/30 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <Plus className="w-4 h-4" /> Enlist in OS
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="career"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* AI Career Tracker Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Milestones Checklist */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-serif text-amber-200/90 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" /> Career Milestones & Skill Accrual
                </h3>

                <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                  {/* Category Filter Indicators */}
                  <div className="flex gap-4 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" /> Skills Builder
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-orange-300">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-400/80" /> AI Projects
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-pink-300">
                      <div className="w-2.5 h-2.5 rounded-full bg-pink-400/80" /> Internship Hunt
                    </div>
                  </div>

                  {careerMilestones.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No milestones set. Define your targets below.</p>
                  ) : (
                    <div className="space-y-2">
                      {careerMilestones.map(m => {
                        const catColor = m.category === "skill" 
                          ? "border-amber-400/20 text-amber-300 bg-amber-400/5" 
                          : m.category === "project" 
                            ? "border-orange-400/20 text-orange-300 bg-orange-400/5" 
                            : "border-pink-400/20 text-pink-300 bg-pink-400/5";

                        return (
                          <div 
                            key={m.id} 
                            onClick={() => handleToggleMilestone(m.id)}
                            className="flex items-start justify-between p-3.5 rounded-2xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-amber-400/10 transition-all cursor-pointer group"
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="mt-0.5 shrink-0">
                                {m.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                ) : (
                                  <Circle className="w-5 h-5 text-gray-500 group-hover:text-amber-400" />
                                )}
                              </div>
                              <div>
                                <span className={`text-sm font-medium block ${m.completed ? "line-through text-gray-500" : "text-gray-200"}`}>
                                  {m.title}
                                </span>
                                {m.details && (
                                  <span className={`text-xs block mt-1 ${m.completed ? "text-gray-600" : "text-gray-400"}`}>
                                    {m.details}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md border ${catColor} shrink-0`}>
                              {m.category}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Career Goal Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-serif text-amber-200/90 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" /> Create Career Target
                </h3>

                <form onSubmit={handleAddMilestone} className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Target Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Fine-tune Llama 3 on custom data"
                      value={newMilestoneTitle}
                      onChange={e => setNewMilestoneTitle(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm glass-input"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Category</label>
                    <select
                      value={newMilestoneCategory}
                      onChange={e => setNewMilestoneCategory(e.target.value as any)}
                      className="w-full px-4 py-2.5 text-sm glass-input bg-[#121217] text-white"
                    >
                      <option value="skill">Core Skill Accrual</option>
                      <option value="project">Portfolio Project</option>
                      <option value="internship">Internship Hunt & Prep</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-gray-400 uppercase">Actionable Details</label>
                    <textarea
                      placeholder="Specify deliverables (e.g. solve 30 SQL cases, launch on GitHub)"
                      value={newMilestoneDetails}
                      onChange={e => setNewMilestoneDetails(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm glass-input h-20 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-amber-200 border border-amber-400/20 rounded-xl font-medium text-sm hover:from-amber-500/30 hover:to-pink-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add to Roadmap
                  </button>
                </form>

                {/* Auckland Tech Wisdom Card */}
                <div className="glass-card rounded-2xl p-4 border border-white/5 bg-gradient-to-br from-amber-500/5 to-pink-500/5 relative">
                  <div className="flex gap-3">
                    <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-200">JARVIS Insight</h4>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Auckland's tech ecosystem values creators who build public solutions. Connect your Data Science R models with simple web-UI wrappers. It will set you apart for Auckland internships.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
