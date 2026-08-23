/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Ritual {
  id: string;
  name: string;
  timeOfDay: "morning" | "afternoon" | "night";
  completed: boolean;
  category: "health" | "fitness" | "mind" | "academic" | "creativity";
}

export interface UniversityCourse {
  id: string;
  code: string; // e.g., STATS 101, CS 220
  name: string;
  professor?: string;
  credits: number;
  gradeGoal: string;
  tasks: {
    id: string;
    title: string;
    dueDate: string;
    completed: boolean;
    weight: number; // percentage of grade
  }[];
}

export interface CareerMilestone {
  id: string;
  title: string;
  category: "skill" | "project" | "internship";
  completed: boolean;
  details?: string;
}

export interface WellnessEntry {
  date: string; // YYYY-MM-DD
  hairRecovery: {
    oiled: boolean;
    dermarolled: boolean;
    serumApplied: boolean;
    massageDone: boolean;
  };
  skinRoutine: {
    morningDone: boolean;
    nightDone: boolean;
  };
  moodScore: number; // 1-10
  waterIntakeCups: number;
  journalPrompt: string;
  journalText: string;
}

export interface SongDraft {
  id: string;
  title: string;
  status: "spark" | "wip" | "completed";
  lyrics: string;
  key?: string;
  tempo?: string;
  chords?: string;
  tags?: string[];
  createdAt: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  budgeted: number;
  spent: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "saisha_ai";
  text: string;
  timestamp: string;
}

export interface OnboardingData {
  // 1. About You
  preferredName: string;
  university: string;
  degree: string;
  yearOfStudy: string;
  courses: {
    code: string;
    name: string;
    gradeGoal?: string;
  }[];

  // 2. Career
  careerInterests: string[];
  desiredRoles: string[];
  industries: string[];
  skillsToDevelop: string[];
  internshipJobGoals: string;
  targetCompaniesOrLocations: string;

  // 3. Goals
  academicGoals: string;
  careerGoals: string;
  creativeGoals: string;
  personalGoals: string;
  trackFinances: boolean;
  savingsGoal: number;
  budgetCategories: {
    name: string;
    budgeted: number;
  }[];

  // 4. Daily Life
  typicalWakeTime: string;
  typicalSleepTime: string;
  exerciseHabits: string;
  studyPreferences: string;
  creativeHabits: string;
  selfCareRoutines: string[];
  consistencyFocus: string;
  rituals: {
    name: string;
    timeOfDay: "morning" | "afternoon" | "night";
    category: "health" | "fitness" | "mind" | "academic" | "creativity";
  }[];

  // 5. Wellbeing (Optional)
  enableWellbeing: boolean;
  wellbeingGoals?: string;
  sleepConsistency?: string;
  exerciseRoutines?: string;
  energyChallenges?: string;
  supportPreferences?: string;

  // 6. Saisha OS Preferences
  enabledAreas: {
    academics: boolean;
    career: boolean;
    creativity: boolean;
    finance: boolean;
    dailyRoutines: boolean;
    wellbeing: boolean;
  };
  priorityFocus: string;
}

export interface SaishaOSState {
  user: {
    name: string;
    avatarUrl?: string;
    currentFocus: string;
    university?: string;
    degree?: string;
    yearOfStudy?: string;
  };
  rituals: Ritual[];
  courses: UniversityCourse[];
  careerMilestones: CareerMilestone[];
  wellnessHistory: WellnessEntry[];
  songs: SongDraft[];
  budget: {
    savingsGoal: number;
    currentSavings: number;
    categories: BudgetCategory[];
  };
  chatHistory: ChatMessage[];
  lastSaved: string;
}

export const EMPTY_STATE: SaishaOSState = {
  user: {
    name: "",
    currentFocus: ""
  },
  rituals: [],
  courses: [],
  careerMilestones: [],
  wellnessHistory: [],
  songs: [],
  budget: {
    savingsGoal: 0,
    currentSavings: 0,
    categories: []
  },
  chatHistory: [],
  lastSaved: new Date().toISOString()
};
