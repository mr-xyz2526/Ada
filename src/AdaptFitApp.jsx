import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area
} from "recharts";
import { supabase } from "./utils/supabaseClient";
import Community from "./pages/Community";
import ARTrainer from "./pages/ARTrainer";
import HealthPage from "./pages/HealthPage";

/* ════════════════════════════════════════════
   THEME CONTEXT
════════════════════════════════════════════ */
const ThemeCtx = createContext({ isDark: true });
const useTheme = () => useContext(ThemeCtx);

/* ── Theme token generator ── */
function makeTheme(isDark) {
  if (isDark) return {
    bgOuter: "#000000",
    bgSidebar: "#1a1a1a",
    bgMain: "#000000",
    bgCard: "#242424",
    bgCardHov: "#2c2c2c",
    bgInput: "#2f2f2f",
    bgActive: "#1e2a40",
    bgBtn: "#3b4460",
    border: "#333333",
    border2: "#3d3d3d",
    borderAct: "#4a5270",
    txtPrim: "#ffffff",
    txtSec: "#e0e0e0",
    txtTert: "#b0b0b0",
    txtWhite: "#ffffff",
    accent: "#5b7cf5",
    accentLt: "#7b97f8",
    green: "#4db882",
    yellow: "#e8a83a",
    red: "#e05555",
    orange: "#e07a35",
    purple: "#00d4aa",
    teal: "#38b4b4",
    pink: "#ff6b6b",
  };
  return {
    bgOuter: "#f0f2f5",
    bgSidebar: "#ffffff",
    bgMain: "#f0f2f5",
    bgCard: "#ffffff",
    bgCardHov: "#f7f8fa",
    bgInput: "#f0f2f5",
    bgActive: "#e8ecff",
    bgBtn: "#3b4460",
    border: "#e2e6ed",
    border2: "#d0d5de",
    borderAct: "#5b7cf5",
    txtPrim: "#000000",
    txtSec: "#333333",
    txtTert: "#666666",
    txtWhite: "#ffffff",
    accent: "#5b7cf5",
    accentLt: "#4060e0",
    green: "#2a9e5e",
    yellow: "#c47e10",
    red: "#d03030",
    orange: "#c05a15",
    purple: "#00b894",
    teal: "#207a7a",
    pink: "#e84393",
  };
}

/* ── Font inject (once) ── */
if (!document.getElementById("af-font")) {
  const fl = document.createElement("link");
  fl.id = "af-font"; fl.rel = "stylesheet";
  fl.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap";
  document.head.appendChild(fl);
}

/* ── Dynamic global CSS injector ── */
function injectGlobalStyles(T) {
  let el = document.getElementById("af-global-styles");
  if (!el) { el = document.createElement("style"); el.id = "af-global-styles"; document.head.appendChild(el); }
  el.textContent = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{background:${T.bgOuter};font-family:'DM Sans',sans-serif;color:${T.txtPrim};font-size:13px;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:${T.bgSidebar};}
    ::-webkit-scrollbar-thumb{background:${T.border2};border-radius:3px;}
    input,select,textarea{font-family:'DM Sans',sans-serif;font-size:13px;
      background:${T.bgInput};border:1px solid ${T.border};color:${T.txtPrim};
      border-radius:6px;padding:8px 12px;width:100%;outline:none;transition:border .18s;}
    input:focus,select:focus,textarea:focus{border-color:${T.accent};}
    select option{background:${T.bgInput};color:${T.txtPrim};}
    button{cursor:pointer;font-family:'DM Sans',sans-serif;}
    input::placeholder,textarea::placeholder{color:${T.txtTert};}

    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeLeft{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
    @keyframes fadeRight{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes dot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(91,124,245,.35)}50%{box-shadow:0 0 0 6px rgba(91,124,245,0)}}
    @keyframes floatUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @keyframes slideInNav{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
    @keyframes ringPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.7);opacity:0}}
    @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

    .stat-card{transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease !important;}
    .stat-card:hover{transform:translateY(-3px) !important;box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 1px ${T.accent}33 !important;border-color:${T.accent}44 !important;}

    .nav-item{transition:all .15s ease !important;position:relative;overflow:hidden;}
    .nav-item::after{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:${T.accent};border-radius:0 2px 2px 0;transform:scaleY(0);transition:transform .2s ease;}
    .nav-item.active::after{transform:scaleY(1);}
    .nav-item:hover:not(.active){background:${T.bgActive}88 !important;transform:translateX(3px);}

    .btn-primary{transition:all .18s ease !important;position:relative;overflow:hidden;}
    .btn-primary::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);transform:translateX(-100%);transition:transform .4s ease;}
    .btn-primary:hover::before{transform:translateX(100%);}
    .btn-primary:hover:not(:disabled){transform:translateY(-1px) !important;box-shadow:0 6px 20px rgba(91,124,245,.3) !important;border-color:${T.accentLt} !important;}
    .btn-primary:active:not(:disabled){transform:translateY(0) !important;}

    .btn-ghost{transition:all .18s ease !important;}
    .btn-ghost:hover:not(:disabled){background:${T.bgInput} !important;color:${T.txtPrim} !important;border-color:${T.border2} !important;transform:translateY(-1px);}

    .chart-card{transition:transform .2s ease,box-shadow .2s ease !important;}
    .chart-card:hover{transform:translateY(-2px) !important;box-shadow:0 10px 32px rgba(0,0,0,.15) !important;}

    .food-row{transition:background .15s,padding-left .15s !important;}
    .food-row:hover{background:${T.bgInput} !important;padding-left:20px !important;}

    .chat-bubble{animation:floatUp 3s ease-in-out infinite !important;}
    .chat-bubble:hover{transform:scale(1.12) !important;animation:none !important;}

    .workout-row{transition:all .15s ease !important;}
    .workout-row:hover{background:${T.bgCardHov} !important;transform:translateX(3px);}

    .stagger-1{animation-delay:.05s !important;}
    .stagger-2{animation-delay:.10s !important;}
    .stagger-3{animation-delay:.15s !important;}
    .stagger-4{animation-delay:.20s !important;}
    .stagger-5{animation-delay:.25s !important;}
    .stagger-6{animation-delay:.30s !important;}

    /* ─── RESPONSIVE ─── */
    @media (max-width: 768px) {
      .af-layout { flex-direction: column !important; }
      .af-sidebar { 
        position: fixed !important; left: 0; top: 0; bottom: 0;
        z-index: 1000; transform: translateX(-100%);
        transition: transform .28s cubic-bezier(.4,0,.2,1) !important;
        width: 240px !important; min-width: 240px !important;
      }
      .af-sidebar.open { transform: translateX(0) !important; box-shadow: 4px 0 40px rgba(0,0,0,.5) !important; }
      .af-overlay { display: block !important; }
      .af-main { width: 100% !important; }
      .af-content { padding: 16px 14px !important; }
      .af-hamburger { display: flex !important; }
      .grid-2col { grid-template-columns: 1fr !important; }
      .grid-3col { grid-template-columns: 1fr 1fr !important; }
      .grid-5col { grid-template-columns: 1fr 1fr !important; }
      .hide-mobile { display: none !important; }
    }
    @media (max-width: 480px) {
      .grid-3col { grid-template-columns: 1fr !important; }
      .grid-2col { grid-template-columns: 1fr !important; }
      .auth-panel-left { display: none !important; }
      .auth-form-panel { width: 100% !important; }
    }
    .af-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 999; }
    .af-hamburger { display: none; position: fixed; top: 12px; left: 12px; z-index: 1001; 
      width: 38px; height: 38px; border-radius: 8px; align-items: center; justify-content: center;
      cursor: pointer; font-size: 16px; border: none; }
  `;
}

/* ════════════════════════════════════════════
   DATA / CALCULATIONS
════════════════════════════════════════════ */
const GOALS = ["Fat Loss", "Muscle Gain", "Maintenance", "Recomposition"];
const ACT_LEVELS = ["Sedentary", "Lightly Active", "Moderately Active", "Very Active", "Extremely Active"];
const WK_TYPES = ["Gym", "Home"];
const FIT_LEVELS = ["Beginner", "Intermediate", "Advanced"];

const FOOD = {
  protein: [
    { id: "p1", name: "Soya Chunks (50g)", cal: 172, prot: 26, carb: 16, fat: 0 },
    { id: "p2", name: "Boiled Eggs (2 large)", cal: 156, prot: 12, carb: 1, fat: 11 },
    { id: "p3", name: "Chicken Breast (150g)", cal: 220, prot: 35, carb: 0, fat: 5 },
    { id: "p4", name: "Paneer (100g)", cal: 265, prot: 18, carb: 3, fat: 20 },
    { id: "p5", name: "Toor Dal (cooked 1 cup)", cal: 198, prot: 11, carb: 35, fat: 1 },
    { id: "p6", name: "Curd/Dahi (150g)", cal: 88, prot: 5, carb: 6, fat: 5 },
    { id: "p7", name: "Kala Chana (100g)", cal: 360, prot: 19, carb: 60, fat: 6 },
  ],
  carbs: [
    { id: "c1", name: "White Rice (150g cooked)", cal: 195, prot: 4, carb: 42, fat: 0 },
    { id: "c2", name: "Roti/Chapati (2 medium)", cal: 140, prot: 4, carb: 30, fat: 0 },
    { id: "c3", name: "Rolled Oats (50g)", cal: 190, prot: 7, carb: 34, fat: 3 },
    { id: "c4", name: "Potato (1 medium)", cal: 110, prot: 3, carb: 26, fat: 0 },
    { id: "c5", name: "Banana (1 medium)", cal: 105, prot: 1, carb: 27, fat: 0 },
  ],
  fats: [
    { id: "f1", name: "Roasted Peanuts (30g)", cal: 170, prot: 7, carb: 5, fat: 14 },
    { id: "f2", name: "Almonds (15g)", cal: 87, prot: 3, carb: 3, fat: 7 },
    { id: "f3", name: "Ghee (1 tbsp)", cal: 112, prot: 0, carb: 0, fat: 13 },
    { id: "f4", name: "Peanut Butter (1.5 tbsp)", cal: 140, prot: 6, carb: 5, fat: 12 },
  ],
  veg: [
    { id: "v1", name: "Palak / Spinach (100g)", cal: 23, prot: 3, carb: 4, fat: 0 },
    { id: "v2", name: "Cabbage (100g)", cal: 25, prot: 1, carb: 6, fat: 0 },
    { id: "v3", name: "Cucumber Salad (100g)", cal: 15, prot: 0, carb: 3, fat: 0 },
  ],
};
const ALLF = [...FOOD.protein, ...FOOD.carbs, ...FOOD.fats, ...FOOD.veg];

const GYM_SPLIT = [
  { day: "Mon", focus: "Chest" },
  { day: "Tue", focus: "Back" },
  { day: "Wed", focus: "Legs" },
  { day: "Thu", focus: "Shoulders" },
  { day: "Fri", focus: "Arms" },
  { day: "Sat", focus: "Core" },
];
const GYM_EX = {
  Beginner: {
    Chest: [["Dumbbell Bench Press", "3", "10-12", "90s"], ["Incline DB Press", "3", "12", "75s"], ["Push-Ups", "3", "AMRAP", "60s"], ["Chest Flyes (light)", "3", "12-15", "60s"]],
    Back: [["Lat Pulldown", "3", "10-12", "90s"], ["Seated Cable Row", "3", "12", "75s"], ["DB Row", "3", "12", "75s"], ["Face Pulls", "3", "15", "60s"]],
    Legs: [["Goblet Squat", "3", "12-15", "90s"], ["Leg Press", "3", "12-15", "90s"], ["Leg Curl", "3", "12-15", "75s"], ["Calf Raises", "3", "20", "60s"]],
    Shoulders: [["DB Shoulder Press", "3", "12", "90s"], ["Lateral Raises", "3", "15", "60s"], ["Front Raises", "3", "12", "60s"], ["Rear Delt Flyes", "3", "15", "60s"]],
    Arms: [["DB Curl", "3", "12-15", "60s"], ["Tricep Pushdown", "3", "15", "60s"], ["Hammer Curl", "3", "12", "60s"], ["Overhead Tricep Ext", "3", "12", "60s"]],
    Core: [["Plank", "3", "30-45s", "60s"], ["Crunches", "3", "20", "60s"], ["Leg Raises", "3", "12", "60s"], ["Treadmill Walk", "1", "15 min", "—"]],
  },
  Intermediate: {
    Chest: [["Barbell Bench Press", "4", "8-10", "2 min"], ["Incline DB Press", "3", "10-12", "90s"], ["Cable Flyes", "3", "12-15", "60s"], ["Chest Dips", "3", "10-12", "75s"], ["Push-Up Burnout", "2", "AMRAP", "60s"]],
    Back: [["Deadlift", "3", "6-8", "3 min"], ["Lat Pulldown", "3", "10-12", "90s"], ["Barbell Row", "3", "8-10", "2 min"], ["Seated Cable Row", "3", "12", "75s"], ["Face Pulls", "3", "15-20", "60s"]],
    Legs: [["Barbell Squat", "4", "8-10", "2 min"], ["Leg Press", "3", "10-12", "90s"], ["Romanian Deadlift", "3", "10-12", "90s"], ["Leg Curl", "3", "12-15", "75s"], ["Calf Raises", "4", "15-20", "60s"]],
    Shoulders: [["OHP Barbell", "3", "8-10", "2 min"], ["Lateral Raises", "3", "12-15", "60s"], ["Front Raises", "3", "12", "60s"], ["Rear Delt Flyes", "3", "15", "60s"], ["Arnold Press", "3", "10-12", "90s"]],
    Arms: [["Barbell Curl", "3", "10-12", "75s"], ["Tricep Pushdown", "3", "12-15", "60s"], ["Hammer Curl", "3", "10-12", "75s"], ["Skull Crushers", "3", "10-12", "75s"]],
    Core: [["Plank", "3", "45-60s", "60s"], ["Hanging Leg Raise", "3", "12-15", "75s"], ["Cable Crunch", "3", "15-20", "60s"], ["Russian Twist", "3", "20", "60s"], ["Treadmill", "1", "20 min", "—"]],
  },
  Advanced: {
    Chest: [["Barbell Bench Press", "5", "4-6", "3 min"], ["Weighted Dips", "4", "8-10", "2 min"], ["Incline DB Press", "4", "8-10", "90s"], ["Cable Flyes", "3", "10-12", "60s"], ["Decline Press", "3", "8-10", "90s"]],
    Back: [["Deadlift", "5", "3-5", "3 min"], ["Weighted Pull-Ups", "4", "6-8", "2 min"], ["Barbell Row", "4", "6-8", "2 min"], ["T-Bar Row", "3", "8-10", "90s"], ["Face Pulls", "3", "15-20", "60s"]],
    Legs: [["Barbell Squat", "5", "4-6", "3 min"], ["Hack Squat", "4", "8-10", "2 min"], ["Romanian Deadlift", "4", "8-10", "90s"], ["Walking Lunges", "3", "12/leg", "90s"], ["Leg Curl", "3", "10-12", "75s"], ["Calf Raises", "5", "15-20", "60s"]],
    Shoulders: [["Push Press", "4", "5-7", "2 min"], ["DB Lateral Raises", "4", "12-15", "60s"], ["Rear Delt Rows", "3", "12-15", "60s"], ["Face Pulls", "3", "15", "60s"], ["Upright Rows", "3", "10-12", "75s"]],
    Arms: [["EZ Bar Curl", "4", "8-10", "75s"], ["Close-Grip Bench", "4", "8-10", "90s"], ["Incline DB Curl", "3", "10-12", "75s"], ["Skull Crushers", "4", "8-10", "75s"], ["Concentration Curl", "3", "10-12", "60s"]],
    Core: [["Weighted Plank", "4", "60s", "60s"], ["Dragon Flag", "3", "8-10", "90s"], ["Cable Crunch", "4", "15-20", "60s"], ["Hanging Leg Raise", "4", "12-15", "75s"], ["Ab Wheel Rollout", "3", "10-12", "60s"]],
  },
};

const calcBMI = (w, h) => +(w / (h / 100) ** 2).toFixed(1);
const calcBMR = (w, h, a, g) => g === "Male" ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
const calcTDEE = (w, h, a, g, act) => { const M = { Sedentary: 1.2, "Lightly Active": 1.375, "Moderately Active": 1.55, "Very Active": 1.725, "Extremely Active": 1.9 }; return Math.round(calcBMR(w, h, a, g) * (M[act] || 1.375)); };
const calcTarget = (tdee, goal, gender = "Male") => {
  // Safe realistic constraints (max ~15% deficit, ~10% surplus)
  const diff = Math.round(tdee * 0.15); 
  let target = tdee;
  if(goal === "Fat Loss" || goal === "Recomposition") target -= diff;
  else if (goal === "Muscle Gain") target += Math.round(tdee * 0.10); 
  
  const floor = gender === "Female" ? 1200 : 1500;
  const ceil = gender === "Female" ? 2800 : 3500;
  return Math.min(Math.max(target, floor), ceil);
};
// Realistic protein goals: 0.8 to 1.6g/kg
const calcProt = (w, goal) => Math.round(w * ({ "Fat Loss": 1.4, "Muscle Gain": 1.6, "Maintenance": 1.0, "Recomposition": 1.5 }[goal] || 1.2));
const bmiMeta = (b, T) => b < 18.5 ? { l: "Underweight", c: T.yellow } : b < 25 ? { l: "Normal", c: T.green } : b < 30 ? { l: "Overweight", c: T.orange } : { l: "Obese", c: T.red };
const getAlts = f => ALLF.filter(x => x.id !== f.id && Math.abs(x.cal - f.cal) <= 65 && Math.abs(x.prot - f.prot) <= 9).slice(0, 4);

const buildDiet = (targetCal = 2500, targetProt = 160) => {
  // ── Meal calorie & protein splits ─────────────────────────────
  // Breakfast 25%, Lunch 35%, Snack 15%, Dinner 25%
  const splits = [
    { name: "Breakfast", time: "7:30 AM", emoji: "☀️", calShare: 0.25, protShare: 0.22 },
    { name: "Lunch", time: "1:00 PM", emoji: "🍽️", calShare: 0.35, protShare: 0.35 },
    { name: "Snack", time: "4:30 PM", emoji: "⚡", calShare: 0.15, protShare: 0.13 },
    { name: "Dinner", time: "7:30 PM", emoji: "🌙", calShare: 0.25, protShare: 0.30 },
  ];

  // ── Build a meal from food categories to hit cal & prot targets ──
  const buildMeal = (mealCal, mealProt, structure) => {
    // structure: [{group, idx}] — base foods for this meal
    const foods = structure.map(({ group, idx }) => {
      const f = FOOD[group][idx];
      return { ...f, calories: f.cal, protein: f.prot };
    });

    let curCal = foods.reduce((s, f) => s + f.cal, 0);
    let curProt = foods.reduce((s, f) => s + f.prot, 0);

    // ── 1. Add protein sources until protein target is met ──
    const protFoods = [...FOOD.protein].sort((a, b) => b.prot - a.prot);
    let attempts = 0;
    while (curProt < mealProt * 0.85 && attempts++ < 4) {
      const best = protFoods.find(f => !foods.find(x => x.id === f.id) && f.cal <= (mealCal - curCal + 60));
      if (!best) break;
      foods.push({ ...best, calories: best.cal, protein: best.prot });
      curCal += best.cal;
      curProt += best.prot;
    }

    // ── 2. Add carb/fat fillers to hit calorie target ──
    const fillers = [...FOOD.carbs, ...FOOD.fats, ...FOOD.veg];
    attempts = 0;
    while (curCal < mealCal * 0.88 && attempts++ < 5) {
      const calGap = mealCal - curCal;
      const best = fillers.find(f => !foods.find(x => x.id === f.id) && f.cal <= calGap + 40);
      if (!best) break;
      foods.push({ ...best, calories: best.cal, protein: best.prot });
      curCal += best.cal;
      curProt += best.prot;
    }

    const total_cal = foods.reduce((s, f) => s + (f.calories || f.cal), 0);
    const total_prot = foods.reduce((s, f) => s + (f.protein || f.prot), 0);
    return { foods, total_cal, total_prot };
  };

  // ── Meal-specific base structures ──────────────────────────────
  const BASE = [
    [{ group: "carbs", idx: 2 }, { group: "protein", idx: 5 }, { group: "carbs", idx: 4 }],   // Breakfast: oats + curd + banana
    [{ group: "protein", idx: 2 }, { group: "carbs", idx: 0 }, { group: "veg", idx: 2 }, { group: "fats", idx: 2 }], // Lunch: chicken + rice + cucumber + ghee
    [{ group: "fats", idx: 0 }, { group: "carbs", idx: 4 }],                             // Snack: peanuts + banana
    [{ group: "protein", idx: 0 }, { group: "carbs", idx: 1 }, { group: "veg", idx: 0 }, { group: "fats", idx: 3 }], // Dinner: soya chunks + roti + palak + peanut butter
  ];

  return splits.map((s, i) => ({
    name: s.name, time: s.time, emoji: s.emoji,
    ...buildMeal(
      Math.round(targetCal * s.calShare),
      Math.round(targetProt * s.protShare),
      BASE[i]
    ),
  }));
};

const INJURY_EXCLUSIONS = {
  "Knee": ["Barbell Squat", "Leg Press", "Goblet Squat", "Jump Squats", "Walking Lunges", "Bulgarian Split Squats", "Hack Squat", "Tuck Jumps", "Burpees"],
  "Shoulder": ["OHP Barbell", "DB Shoulder Press", "Arnold Press", "Lateral Raises", "Incline DB Press", "Barbell Bench Press", "Dumbbell Bench Press", "Chest Dips", "Push-Ups", "Diamond Push-Ups", "Push-Up Burnout"],
  "Back": ["Deadlift", "Romanian Deadlift", "Barbell Row", "T-Bar Row", "Bent Over Row", "Heavy Squats"],
  "Wrist": ["Push-Ups", "Bench Press", "Dumbbell Press", "Barbell Curl", "Skull Crushers"],
  "Ankle": ["Jump Squats", "Burpees", "Walking Lunges", "Treadmill", "Jump Lunges", "Tuck Jumps"],
};

const buildGym = (T, level = "Intermediate", healthReports = []) => {
  const activeInjuries = healthReports.filter(r => r.status === "Active").map(r => r.issue_type);
  const excluded = new Set();
  activeInjuries.forEach(type => {
    if (INJURY_EXCLUSIONS[type]) INJURY_EXCLUSIONS[type].forEach(ex => excluded.add(ex));
  });

  const lvl = GYM_EX[level] || GYM_EX["Intermediate"];
  return GYM_SPLIT.map(({ day, focus }, i) => {
    const cols = [T.accent, T.purple, T.yellow, T.teal, T.orange, T.green];
    const rawExs = lvl[focus] || GYM_EX["Intermediate"][focus];
    // Filter excluded exercises and ensure we have at least some exercises
    const filteredExs = rawExs.filter(([name]) => !excluded.has(name));
    
    return { 
      day, 
      focus, 
      col: cols[i], 
      level, 
      exs: (filteredExs.length > 0 ? filteredExs : rawExs.slice(0, 2)).map(([name, sets, reps, rest]) => ({ name, sets, reps, rest })) 
    };
  });
};
const HOME_EX = {
  Beginner: [["Push-Ups", "3", "10-12", "60s"], ["Bodyweight Squats", "3", "15", "60s"], ["Glute Bridges", "3", "15", "45s"], ["Plank", "3", "30s", "45s"], ["Walking Lunges", "2", "10/leg", "60s"]],
  Intermediate: [["Push-Ups", "3", "15-20", "60s"], ["Jump Squats", "3", "15", "60s"], ["Glute Bridges", "3", "15", "45s"], ["Plank", "3", "45s", "30s"], ["Mountain Climbers", "3", "30s", "30s"], ["Burpees", "3", "10", "75s"]],
  Advanced: [["Diamond Push-Ups", "4", "12-15", "60s"], ["Pistol Squat", "3", "8/leg", "75s"], ["Single-Leg Glute Bridge", "3", "12/leg", "45s"], ["Plank with Shoulder Tap", "3", "60s", "30s"], ["Burpees", "4", "15", "60s"], ["Jump Lunges", "3", "12/leg", "60s"], ["Tuck Jumps", "3", "12", "75s"]],
};

const EXERCISE_META = {
  "Push-Ups": { video: "https://www.youtube.com/watch?v=IODxDxX7oi4", ar_id: "pushup" },
  "Push-Up Burnout": { video: "https://www.youtube.com/watch?v=IODxDxX7oi4", ar_id: "pushup" },
  "Barbell Squat": { video: "https://www.youtube.com/watch?v=SW_C1A-rejs", ar_id: "squat" },
  "Goblet Squat": { video: "https://www.youtube.com/watch?v=MeIiIdhvXT4", ar_id: "squat" },
  "Plank": { video: "https://www.youtube.com/watch?v=pSHjTRCQxIw", ar_id: "plank" },
  "Weighted Plank": { video: "https://www.youtube.com/watch?v=pSHjTRCQxIw", ar_id: "plank" },
  "Deadlift": { video: "https://www.youtube.com/watch?v=Xs3mzCZCiz0", ar_id: "deadlift" },
  "Romanian Deadlift": { video: "https://www.youtube.com/watch?v=JCX81P9zszw", ar_id: "deadlift" },
  "Walking Lunges": { video: "https://www.youtube.com/watch?v=L8fyj8vcaDk", ar_id: "lunge" },
  "DB Shoulder Press": { video: "https://www.youtube.com/watch?v=qEwKCR5JCog", ar_id: "shoulder" },
  "Barbell Bench Press": { video: "https://www.youtube.com/watch?v=rT7DgDICPdmc", ar_id: "pushup" },
  "Dumbbell Bench Press": { video: "https://www.youtube.com/watch?v=VmB1G1K7v94", ar_id: "pushup" },
  "Lat Pulldown": { video: "https://www.youtube.com/watch?v=CAwf7n6Luuc", ar_id: "deadlift" }, // Near enough for hinge
  "Seated Cable Row": { video: "https://www.youtube.com/watch?v=GZbfZ033f74", ar_id: "deadlift" },
  "DB Row": { video: "https://www.youtube.com/watch?v=roCP6wC471Y", ar_id: "deadlift" },
  "Lateral Raises": { video: "https://www.youtube.com/watch?v=3VcKaXpzqRo", ar_id: "shoulder" },
  "Arnold Press": { video: "https://www.youtube.com/watch?v=60W_uE-1F_c", ar_id: "shoulder" },
  "DB Curl": { video: "https://www.youtube.com/watch?v=ykJmrZ5v0Oo", ar_id: "pushup" },
  "Hammer Curl": { video: "https://www.youtube.com/watch?v=zC3nLlEvin4", ar_id: "pushup" },
};
const buildHome = (days, T, level = "Intermediate", healthReports = []) => {
  const activeInjuries = healthReports.filter(r => r.status === "Active").map(r => r.issue_type);
  const excluded = new Set();
  activeInjuries.forEach(type => {
    if (INJURY_EXCLUSIONS[type]) INJURY_EXCLUSIONS[type].forEach(ex => excluded.add(ex));
  });

  const rawExs = HOME_EX[level] || HOME_EX["Intermediate"];
  const filteredExs = rawExs.filter(([name]) => !excluded.has(name));
  const finalExs = (filteredExs.length > 0 ? filteredExs : rawExs.slice(0, 2)).map(([name, sets, reps, rest]) => ({ name, sets, reps, rest }));

  return ["Mon", "Wed", "Fri", "Sat"].slice(0, Math.min(days, 4)).map((day, i) => ({
    day, focus: i % 2 === 0 ? "Full Body Strength" : "HIIT Circuit",
    col: i % 2 === 0 ? T.accent : T.orange, level, exs: finalExs
  }));
};

function aiReply(msg, user, m, healthReports = []) {
  const q = msg.toLowerCase().trim();

  // Medical guard
  if (["diagnos", "disease", "prescri", "medication", "symptom", "surgery"].some(k => q.includes(k)))
    return "I provide general fitness guidance only — not medical advice.\n\nPlease consult a qualified healthcare professional for medical concerns.";

  // Greetings — short, friendly, no data dump
  const greetings = ["hi", "hey", "hei", "hie", "hello", "sup", "yo", "howdy", "namaste"];
  if (greetings.some(g => q === g || q.startsWith(g + " ") || q.startsWith(g + "!"))) {
    const firstName = user.name.split(" ")[0];
    return `Hey ${firstName}! Ready to work towards **${user.goal}**? 💪\n\nYou can ask me about your diet, workout, supplements, recovery — or anything fitness-related. What's on your mind?`;
  }

  // How are you / energy / mood
  if (q.includes("how are you") || q.includes("how r u") || q.includes("what are we") || q.includes("what will we") || q.includes("what we will") || q.includes("what should we")) {
    return `I'm your always-on fitness coach — no off days! 😄\n\nFor you today: you're ${user.workoutDays} days/week on a **${user.workoutType}** plan targeting **${user.goal}**. Want me to:\n\n• Review today's nutrition targets?\n• Suggest today's workout focus?\n• Talk recovery or sleep?\n\nJust ask!`;
  }

  // Low energy / tired
  if (["tired", "fatigue", "energy", "not energetic", "low energy", "exhausted", "sluggish"].some(k => q.includes(k))) {
    return `Low energy before a workout is common. Quick fixes:\n\n• **Eat 30–60 min before** — banana + peanut butter or oats work great\n• **Caffeine** (3–5mg/kg) 30 min pre-workout if you use it\n• **Check sleep** — under 7h? That's your real issue\n• **Hydrate** — even 2% dehydration cuts performance noticeably\n\nYour calorie target is **${m.target} kcal/day** — if you're consistently under, low energy is expected. Are you hitting it?`;
  }

  // Fine / okay / not bad check-in
  if (["fine", "okay", "ok", "not bad", "alright", "good", "great", "amazing", "awesome"].some(k => q === k || q.startsWith(k + " ") || q.startsWith(k + "!"))) {
    return `Good to hear! Let's make the most of it. 🎯\n\nYour stats: **${m.target} kcal** · **${m.prot}g protein** · **${user.workoutDays} sessions/week**.\n\nAnything specific you want to focus on — nutrition, training, or recovery?`;
  }

  // Protein
  if (q.includes("protein")) return `Your protein target is **${m.prot}g/day** for ${user.goal}.\n\nAt ${user.weight}kg that's ${(m.prot / user.weight).toFixed(1)}g/kg. Spread across 4–5 meals (~${Math.round(m.prot / 4)}g each).\n\nTop sources: chicken breast, tuna, Greek yogurt, paneer, eggs, tofu.`;

  // Calories / diet
  if (q.includes("calori") || q.includes("eat") || q.includes("diet") || q.includes("food")) return `Your daily target is **${m.target} kcal** (maintenance: ${m.tdee} kcal).\n\nFor ${user.goal}: ${Math.abs(m.target - m.tdee)} kcal ${m.target < m.tdee ? "deficit" : "surplus"} per day. Track for 3–4 weeks before adjusting.`;

  // Workout / training
  if (q.includes("workout") || q.includes("train") || q.includes("exercise") || q.includes("gym")) return `For **${user.goal}** on a ${user.workoutType} plan:\n\n• Progressive overload — add weight or reps every week\n• Lead with compound movements (squat, deadlift, press, row)\n• ${user.workoutDays} days/week: ${user.workoutDays >= 4 ? "solid volume — ensure at least 2 rest days" : "quality over quantity — push intensity each session"}`;

  // Sleep / recovery
  if (q.includes("sleep") || q.includes("recov") || q.includes("rest")) return `Sleep is your **#1 recovery tool**.\n\nAim for 7–9 hours — growth hormone peaks during deep sleep. With ${user.workoutDays} training days, take at least 2 full rest days. Deload every 4–6 weeks if progress stalls.`;

  // Supplements
  if (q.includes("supplement") || q.includes("creatine") || q.includes("whey") || q.includes("protein powder")) return `Evidence-based picks:\n\n• **Creatine monohydrate** 3–5g/day — strongest evidence, safe long-term\n• **Whey protein** — convenient gap-filler, not magic\n• **Vitamin D3 + K2** — essential if you're indoors most of the day\n• **Caffeine** — 3–6mg/kg body weight, 30 min pre-workout\n\nFood first, always.`;

  // BMI / weight
  if (q.includes("bmi") || q.includes("weight") || q.includes("fat") || q.includes("body")) return `Your current stats: **${user.weight}kg · BMI ${m.bmi}**. Goal: **${user.goal}**.\n\nBMI is a rough guide — body composition matters more. Focus on hitting **${m.prot}g protein** daily and training progressively. The scale will follow.`;

  // Injury awareness
  const activeInjuries = healthReports.filter(r => r.status === "Active");
  if (activeInjuries.length > 0 && (q.includes("workout") || q.includes("train") || q.includes("exercise") || q.includes("gym") || q.includes("can i"))) {
    const injuryStr = activeInjuries.map(r => r.issue_type).join(", ");
    return `Given your **${injuryStr}** health report, I've adjusted your training plan to exclude potentially harmful exercises. 🩹\n\nFocus on recovery and pain-free movements. If you feel any sharp pain, stop immediately and consult a professional. Would you like some alternative low-impact stretches?`;
  }

  // Default — contextual, not a data dump
  return `For your **${user.goal}** goal at ${user.weight}kg:\n\n• Daily target: **${m.target} kcal**\n• Protein: **${m.prot}g**\n• Training: **${user.workoutDays}x/week ${user.workoutType}**\n\nWhat specifically would you like to work on — nutrition, training, supplements, or recovery?`;
}

const DEMO = { name: "Rahul Sharma", email: "rahul@adaptfit.ai", age: 28, gender: "Male", height: 175, weight: 80, goal: "Muscle Gain", activityLevel: "Moderately Active", workoutType: "Gym", workoutHours: 1, workoutDays: 5, fitnessLevel: "Intermediate", lastUpdate: new Date().toISOString() };
const DEMO_PROG = [
  { date: "Sep 2025", w: 85, bmi: 27.8, cal: 2580 },
  { date: "Oct 2025", w: 83.5, bmi: 27.3, cal: 2620 },
  { date: "Nov 2025", w: 82, bmi: 26.8, cal: 2650 },
  { date: "Dec 2025", w: 80.5, bmi: 26.3, cal: 2680 },
  { date: "Jan 2026", w: 80, bmi: 26.1, cal: 2710 },
];

/* ════════════════════════════════════════════
   PRIMITIVES
════════════════════════════════════════════ */
const Spin = ({ T }) => (
  <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid rgba(91,124,245,.25)`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin .6s linear infinite" }} />
);

const StatCard = ({ icon, label, value, sub, color, small, delay = 0, T }) => (
  <div className="stat-card" style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, minHeight: small ? 80 : 100, flex: 1, animation: `fadeUp .4s ease ${delay}s both`, cursor: "default" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontSize: 12, opacity: .7 }}>{icon}</span>
      <span style={{ fontSize: 11, color: T.txtSec, fontWeight: 400, letterSpacing: ".02em" }}>{label}</span>
    </div>
    <div style={{ fontSize: small ? 20 : 28, fontWeight: 700, color: color || T.txtPrim, lineHeight: 1, letterSpacing: "-.5px" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.txtTert }}>{sub}</div>}
  </div>
);

const BtnPrimary = ({ children, onClick, disabled, icon, sm, style = {}, T }) => (
  <button className="btn-primary" onClick={onClick} disabled={disabled} style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: sm ? "6px 14px" : "9px 20px",
    background: T.bgBtn, color: "#ffffff",
    border: `1px solid ${T.borderAct}`, borderRadius: 6,
    fontSize: sm ? 11 : 12, fontWeight: 500, letterSpacing: ".02em",
    opacity: disabled ? .45 : 1, ...style
  }}>
    {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
    {disabled && typeof children === "string" && children.includes("…") ? <><Spin T={T} />{children}</> : children}
  </button>
);

const BtnGhost = ({ children, onClick, disabled, icon, sm, style = {}, T }) => (
  <button className="btn-ghost" onClick={onClick} disabled={disabled} style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: sm ? "6px 12px" : "9px 18px",
    background: "transparent", color: T.txtSec,
    border: `1px solid ${T.border}`, borderRadius: 6,
    fontSize: sm ? 11 : 12, fontWeight: 400,
    opacity: disabled ? .45 : 1, ...style
  }}>
    {icon && <span>{icon}</span>}{children}
  </button>
);

const ChartTip = ({ active, payload, label, T }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.bgInput, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 12px", fontSize: 11 }}>
      {label && <div style={{ color: T.txtSec, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => <div key={i} style={{ color: p.color || T.txtPrim, fontWeight: 600 }}>{p.name}: {p.value}</div>)}
    </div>
  );
};

/* ════════════════════════════════════════════
   THEME TOGGLE BUTTON
════════════════════════════════════════════ */
const ThemeToggle = ({ isDark, onToggle, T }) => (
  <div onClick={onToggle} style={{
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 10px", borderRadius: 6, cursor: "pointer",
    color: T.txtSec, fontSize: 12,
    transition: "background .2s",
    userSelect: "none",
  }}>
    <div style={{
      width: 34, height: 18, borderRadius: 9,
      background: isDark ? "#5b7cf5" : "#cdd0d8",
      position: "relative", transition: "background .25s",
      flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 2,
        left: isDark ? 16 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: "#fff",
        transition: "left .25s",
        boxShadow: "0 1px 4px rgba(0,0,0,.25)",
      }} />
    </div>
    <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
  </div>
);

/* ════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════ */
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "diet", label: "Diet Plan", icon: "🥗" },
  { id: "workout", label: "Workout", icon: "🏋️" },
  { id: "health", label: "Health & Injuries", icon: "🩹" },
  { id: "explorer", label: "Progress", icon: "📈" },
  { id: "chatbot", label: "AI Assistant", icon: "💬" },
  { id: "integrations", label: "Integrations", icon: "🔗" },
  { id: "community", label: "Community", icon: "🤝" },
  { id: "ar-trainer", label: "AR Trainer", icon: "🤳" },
  { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
  { id: "profile", label: "Profile", icon: "👤" },
];

function Sidebar({ active, onNav, user, isDark, onToggleTheme, onLogout, events, T, sideOpen }) {
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const todayEvents = events || [];
  return (
    <div className={`af-sidebar${sideOpen ? " open" : ""}`} style={{ width: 230, minWidth: 230, background: T.bgSidebar, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", height: "100vh", userSelect: "none", transition: "background .3s,border .3s,transform .28s", overflowY: "auto" }}>
      <div style={{ padding: "16px 14px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg,${T.accent},#00d4aa)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "glowPulse 2.5s ease-in-out infinite", padding: 6 }}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: "100%", height: "100%" }}>
            <rect x="1" y="10" width="3" height="4" rx="1" fill="white" />
            <rect x="4" y="8" width="2" height="8" rx="1" fill="white" />
            <rect x="6" y="10.5" width="12" height="3" rx="1" fill="white" />
            <rect x="18" y="8" width="2" height="8" rx="1" fill="white" />
            <rect x="20" y="10" width="3" height="4" rx="1" fill="white" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.txtPrim, lineHeight: 1.2 }}>AdaptFit</div>
          <div style={{ fontSize: 9, color: T.txtTert, marginTop: 2, letterSpacing: ".04em" }}>AI Fitness Platform</div>
        </div>
      </div>
      <div style={{ padding: "12px 8px 4px", flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: T.txtTert, letterSpacing: ".1em", textTransform: "uppercase", padding: "0 8px", marginBottom: 6 }}>Navigation</div>
        {NAV_ITEMS.map((n, idx) => {
          const isAct = active === n.id;
          return (
            <div key={n.id} onClick={() => onNav(n.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 6, marginBottom: 1, cursor: "pointer", background: isAct ? T.bgActive : "transparent", color: isAct ? T.accent : T.txtSec, fontSize: 12, fontWeight: isAct ? 600 : 400, border: `1px solid ${isAct ? T.borderAct : "transparent"}`, animation: `slideInNav .35s ease ${idx * 0.045}s both`, transition: "all .15s" }}>
              <span style={{ fontSize: 13, opacity: .85, flexShrink: 0 }}>{n.icon}</span>
              <span style={{ color: isAct ? T.txtPrim : T.txtSec }}>{n.label}</span>
              {n.id === "chatbot" && <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 700, background: T.accent, color: "#fff", borderRadius: 3, padding: "1px 5px", animation: "blink 2s ease-in-out infinite" }}>AI</span>}
            </div>
          );
        })}
      </div>
      {todayEvents.length > 0 && (
        <div style={{ margin: "10px 8px 0", flexShrink: 0 }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bgInput }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.txtTert, letterSpacing: ".1em", textTransform: "uppercase" }}>Today · {today}</div>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4db882", display: "inline-block", animation: "blink 1.5s infinite" }} />
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {[...todayEvents].reverse().map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "8px 12px", borderBottom: i < todayEvents.length - 1 ? `1px solid ${T.border}44` : "none", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{ev.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: T.txtPrim, lineHeight: 1.3, wordBreak: "break-word" }}>{ev.title}</div>
                    <div style={{ fontSize: 9, color: T.txtTert, marginTop: 1 }}>{ev.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 8px 8px", flexShrink: 0 }}>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} T={T} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: T.bgActive, borderRadius: 6, marginTop: 6, border: `1px solid ${T.border}` }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg,${T.accent}99,#00d4aa99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {user?.name?.charAt(0) || "U"}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.txtPrim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "Admin"}</div>
            <div style={{ fontSize: 9, color: T.txtTert, fontFamily: "DM Mono", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email?.slice(0, 20) || "user@adaptfit.ai"}</div>
          </div>
        </div>
        <div onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", color: "#e05555", fontSize: 12, cursor: "pointer", marginTop: 4, borderRadius: 6, transition: "background .15s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(224,85,85,0.10)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span>↩</span> Logout
        </div>
      </div>
    </div>
  );
}

/* NotifBanner removed — Integrations page handles data syncing */

/* ════════════════════════════════════════════
   WEIGHT MODAL
════════════════════════════════════════════ */
function WeightModal({ user, onConfirm, onClose, T }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border2}`, borderRadius: 10, padding: 28, width: 380, animation: "scaleIn .22s ease" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.txtPrim, marginBottom: 4 }}>Log Weight Update</div>
        <div style={{ fontSize: 12, color: T.txtSec, marginBottom: 16, lineHeight: 1.6 }}>Enter your current weight. We'll recalculate BMI, target calories, protein, and auto-regenerate your plans.</div>
        <div style={{ background: `${T.accent}12`, border: `1px solid ${T.accent}33`, borderRadius: 6, padding: "9px 12px", marginBottom: 16, fontSize: 11, color: T.txtSec }}>
          ↻ Auto-recalculates: <span style={{ color: T.accentLt }}>BMI · Target Calories · Protein · Diet Plan · Workout Plan</span>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 5 }}>Current Weight (kg)</div>
          <input type="number" step="0.1" placeholder={`Previous: ${user.weight} kg`} value={val} onChange={e => setVal(e.target.value)} autoFocus onKeyDown={e => e.key === "Enter" && val && onConfirm(+val)} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <BtnPrimary style={{ flex: 1, justifyContent: "center" }} onClick={() => val && onConfirm(+val)} T={T}>Confirm Update</BtnPrimary>
          <BtnGhost onClick={onClose} T={T}>Cancel</BtnGhost>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   AUTH PAGE
════════════════════════════════════════════ */
function AuthPage({ onLogin, isDark, onToggleTheme, T }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", age: 25, gender: "Male", height: 170, weight: 70, goal: "Fat Loss", activityLevel: "Moderately Active", workoutType: "Gym", workoutHours: 1, workoutDays: 4, fitnessLevel: "Beginner" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleAuth = async () => {
    if (!form.email?.trim() || !form.password) {
      setError("Please enter both email and password.");
      return;
    }
    const email = form.email.trim();
    const password = form.password;

    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authErr) throw authErr;
      } else {
        // Registration
        if (!form.name?.trim()) {
          setError("Please enter your full name.");
          setLoading(false);
          return;
        }
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authErr) throw authErr;

        if (authData.user) {
          // Sync Profile
          const { error: profErr } = await supabase.from('profiles').insert([{
            id: authData.user.id,
            full_name: form.name.trim(),
            age: +form.age,
            gender: form.gender,
            height: +form.height,
            weight: +form.weight,
            goal: form.goal,
            activity_level: form.activityLevel,
            workout_type: form.workoutType,
            workout_hours: +form.workoutHours,
            workout_days: +form.workoutDays,
            fitness_level: form.fitnessLevel || 'Beginner',
            last_update: new Date().toISOString()
          }]);
          if (profErr) {
            // If insert fails (RLS or missing col), try upsert
            console.warn("Profile insert error:", profErr.message);
          }
          // Immediately log in after registration
          const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
          if (loginErr) throw loginErr;
          if (profErr) console.error("Profile sync error:", profErr);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden",
      backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80')",
      backgroundSize: "cover", backgroundPosition: "center"
    }}>
      {/* Dark overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(2px)" }} />
      {/* Gradient accent overlays */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${T.accent},#00d4aa,${T.accent})`, backgroundSize: "200% 100%", animation: "gradientShift 4s linear infinite" }} />
      {/* Theme toggle top right */}
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} T={T} />
      </div>

      <div style={{ display: "flex", width: "100%", maxWidth: 860, borderRadius: 12, overflow: "hidden", border: `1px solid rgba(255,255,255,0.1)`, boxShadow: "0 40px 100px rgba(0,0,0,.8)", animation: "fadeUp .4s ease", position: "relative", zIndex: 1 }}>
        {/* Left branding panel */}
        <div style={{ flex: 1, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(20px)", padding: "44px 40px", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: `1px solid rgba(255,255,255,0.08)`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: `${T.accent}12`, pointerEvents: "none", animation: "floatUp 6s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: -80, left: -40, width: 200, height: 200, borderRadius: "50%", background: `#00d4aa10`, pointerEvents: "none", animation: "floatUp 8s ease-in-out infinite reverse" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, animation: "fadeLeft .5s ease both" }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: `linear-gradient(135deg,${T.accent},#00d4aa)`, display: "flex", alignItems: "center", justifyContent: "center", animation: "glowPulse 2.5s ease-in-out infinite", padding: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
                  <rect x="1" y="10" width="3" height="4" rx="1" fill="white" />
                  <rect x="4" y="8" width="2" height="8" rx="1" fill="white" />
                  <rect x="6" y="10.5" width="12" height="3" rx="1" fill="white" />
                  <rect x="18" y="8" width="2" height="8" rx="1" fill="white" />
                  <rect x="20" y="10" width="3" height="4" rx="1" fill="white" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.txtPrim }}>AdaptFit</div>
                <div style={{ fontSize: 9, color: T.txtTert, letterSpacing: ".05em" }}>AI FITNESS PLATFORM</div>
              </div>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: T.txtPrim, lineHeight: 1.35, marginBottom: 10, letterSpacing: "-.4px", animation: "fadeLeft .5s ease .1s both" }}>Intelligent fitness,<br />month after month.</h2>
            <p style={{ fontSize: 12, color: T.txtSec, lineHeight: 1.8, marginBottom: 24, animation: "fadeLeft .5s ease .15s both" }}>Adaptive calorie & protein targets. AI-generated diet and workout plans. Monthly recalibration based on real progress data.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {["📊 BMI + TDEE auto-calculation", "🔄 Monthly adaptive recalibration", "🥗 AI-generated diet plans with food swap", "🏋️ Progressive workout split generation", "🤖 AI fitness assistant with safety filters"].map((f, i) => (
                <div key={f} style={{ fontSize: 11, color: T.txtSec, animation: `fadeLeft .4s ease ${.2 + i * .07}s both` }}>{f}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div style={{ width: 380, background: "rgba(18,18,18,0.85)", backdropFilter: "blur(20px)", padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "center", animation: "fadeRight .5s ease .1s both" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.txtPrim, marginBottom: 3 }}>{mode === "login" ? "Welcome back" : "Create your account"}</div>
            {mode === "register" && <div style={{ fontSize: 10, color: T.accent, fontWeight: 500, letterSpacing: ".04em" }}>STEP {step} OF 2 · {step === 1 ? "PERSONAL INFO" : "FITNESS PROFILE"}</div>}
            {error && <div style={{ fontSize: 10, color: T.red, background: `${T.red}18`, padding: "6px 10px", borderRadius: 4, marginTop: 10 }}>{error}</div>}
          </div>

          {mode === "login" ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 5 }}>Email</div>
                <input type="email" placeholder="you@example.com" value={form.email || ""} onChange={e => set("email", e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 5 }}>Password</div>
                <input type="password" placeholder="••••••••" value={form.password || ""} onChange={e => set("password", e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAuth(); }} />
              </div>
              <BtnPrimary style={{ width: "100%", justifyContent: "center", marginTop: 4, marginBottom: 10 }} onClick={handleAuth} disabled={loading} T={T}>
                {loading ? "Authenticating…" : "Sign In"}
              </BtnPrimary>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: T.border }} />
                <span style={{ fontSize: 10, color: T.txtTert }}>or</span>
                <div style={{ flex: 1, height: 1, background: T.border }} />
              </div>
              <BtnGhost style={{ width: "100%", justifyContent: "center" }} onClick={() => onLogin(DEMO, DEMO_PROG)} T={T}>Continue with Demo Account</BtnGhost>
              <div style={{ fontSize: 11, color: T.txtSec, textAlign: "center", marginTop: 14 }}>
                No account?{" "}<span style={{ color: T.accentLt, cursor: "pointer" }} onClick={() => { setMode("register"); setStep(1); setError(null); }}>Register</span>
              </div>
            </>
          ) : step === 1 ? (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Full Name</div>
                <input type="text" placeholder="Rahul Sharma" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Email</div><input type="email" placeholder="you@example.com" value={form.email} onChange={e => set("email", e.target.value)} /></div>
                <div><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Password</div><input type="password" placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Age (yrs)</div><input type="number" value={form.age} onChange={e => set("age", e.target.value)} /></div>
                <div><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Gender</div><select value={form.gender} onChange={e => set("gender", e.target.value)}><option>Male</option><option>Female</option></select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Height (cm)</div><input type="number" value={form.height} onChange={e => set("height", e.target.value)} /></div>
                <div><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Weight (kg)</div><input type="number" value={form.weight} onChange={e => set("weight", e.target.value)} /></div>
              </div>
              <BtnPrimary style={{ width: "100%", justifyContent: "center" }} onClick={() => setStep(2)} T={T}>Continue →</BtnPrimary>
              <div style={{ fontSize: 11, color: T.txtSec, textAlign: "center", marginTop: 12 }}>Have an account?{" "}<span style={{ color: T.accentLt, cursor: "pointer" }} onClick={() => setMode("login")}>Sign in</span></div>
            </>
          ) : (
            <>
              {[["Fitness Goal", "goal", GOALS], ["Activity Level", "activityLevel", ACT_LEVELS], ["Workout Type", "workoutType", WK_TYPES], ["Experience Level", "fitnessLevel", FIT_LEVELS]].map(([l, k, opts]) => (
                <div key={k} style={{ marginBottom: 10 }}><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>{l}</div><select value={form[k]} onChange={e => set(k, e.target.value)}>{opts.map(o => <option key={o}>{o}</option>)}</select></div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Days/Week</div><input type="number" min={1} max={7} value={form.workoutDays} onChange={e => set("workoutDays", +e.target.value)} /></div>
                <div><div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 4 }}>Hrs/Day</div><input type="number" min={.25} max={3} step=".25" value={form.workoutHours} onChange={e => set("workoutHours", +e.target.value)} /></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <BtnGhost onClick={() => setStep(1)} T={T}>← Back</BtnGhost>
                <BtnPrimary style={{ flex: 1, justifyContent: "center" }} onClick={handleAuth} disabled={loading} T={T}>
                  {loading ? "Creating Account…" : "Create Account"}
                </BtnPrimary>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════ */
function Dashboard({ user, m, progress, workoutPlan, onGenerate, onWeightModal, onNav, generating, T }) {
  const bi = bmiMeta(m.bmi, T);
  const deltaTotal = progress.length ? +(user.weight - progress[0].w).toFixed(1) : null;
  const progressLine = progress.map(p => ({ name: p.date.replace(" 20", "'"), weight: p.w, bmi: p.bmi }));

  // Today's workout from plan
  const today = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayLabel = dayNames[today.getDay()];
  const todayPlan = workoutPlan ? workoutPlan.find(d => d.day === todayLabel) : null;

  // Workout log state (synced with Supabase workout_logs)
  const [workoutLog, setWorkoutLog] = useState({});
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    const loadLog = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;
        const { data } = await supabase
          .from("workout_logs").select("exercises")
          .eq("user_id", authUser.id)
          .eq("log_date", today.toISOString().slice(0, 10))
          .single();
        if (data && data.exercises) {
          const map = {};
          data.exercises.forEach(e => { map[e.name] = e.completed; });
          setWorkoutLog(map);
        }
      } catch (err) { /* no log yet */ }
    };
    loadLog();
  }, []);

  const toggleExercise = async (exName) => {
    const updated = { ...workoutLog, [exName]: !workoutLog[exName] };
    setWorkoutLog(updated);
    if (!todayPlan) return;
    setLogLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const exercises = todayPlan.exs.map(e => ({ name: e.name, sets: e.sets, reps: e.reps, completed: !!updated[e.name] }));
      await supabase.from("workout_logs").upsert([{
        user_id: authUser.id, log_date: today.toISOString().slice(0, 10),
        day_label: todayLabel, focus: todayPlan.focus, exercises,
      }], { onConflict: "user_id,log_date" });
    } catch (e) { console.warn("workout_log sync failed:", e.message); }
    finally { setLogLoading(false); }
  };

  const completedCount = todayPlan ? todayPlan.exs.filter(e => workoutLog[e.name]).length : 0;
  const totalExs = todayPlan ? todayPlan.exs.length : 0;
  const pct = totalExs > 0 ? Math.round((completedCount / totalExs) * 100) : 0;
  const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const planDays = new Set((workoutPlan || []).map(d => d.day));

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero Banner */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center 30%", height: 160,
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.4) 60%,rgba(0,0,0,0.1) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.accent},#00d4aa)`, opacity: 0.8 }} />
        <div style={{ position: "relative", zIndex: 1, padding: "28px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#00d4aa", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 6 }}>AI FITNESS PLATFORM</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#ffffff", letterSpacing: "-.5px", lineHeight: 1.1, marginBottom: 6 }}>Dashboard</h1>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Welcome back, {user.name.split(" ")[0]} · <span style={{ color: "#00d4aa" }}>Goal: {user.goal}</span></div>
        </div>
        {/* Decorative gym icon watermark */}
        <div style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", opacity: 0.06, fontSize: 100 }}>🏋️</div>
      </div>

      {/* Stat Cards Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 10 }}>
        <StatCard delay={0.05} icon="⚖️" label="Current Weight" value={`${user.weight} kg`} sub={deltaTotal != null ? `${deltaTotal > 0 ? "+" : ""}${deltaTotal}kg from start` : "Log weight to track"} color={deltaTotal != null && deltaTotal < 0 ? T.green : T.txtPrim} T={T} />
        <StatCard delay={0.10} icon="🔥" label="Calorie Target" value={`${m.target.toLocaleString()} kcal`} sub={`Maintenance: ${m.tdee.toLocaleString()} kcal`} color={T.yellow} T={T} />
        <StatCard delay={0.15} icon="💪" label="Protein Target" value={`${m.prot}g`} sub={`${(m.prot / user.weight).toFixed(1)}g/kg — ${user.goal}`} color={T.accent} T={T} />
      </div>
      {/* Stat Cards Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        <StatCard delay={0.20} icon="🛡️" label="BMI" value={m.bmi} sub={bi.l} color={bi.c} small T={T} />
        <StatCard delay={0.25} icon="📅" label="Workout Days" value={`${user.workoutDays}x / week`} sub={`${user.workoutType} · ${user.fitnessLevel || "Beginner"}`} small T={T} />
        <StatCard delay={0.30} icon="📊" label="Check-Ins" value={progress.length || 0} sub={progress.length ? `Last: ${progress[progress.length - 1]?.date}` : "No check-ins yet"} small T={T} />
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <BtnPrimary icon="▶" onClick={() => { onGenerate("diet"); onNav("diet"); }} disabled={generating === "diet"} T={T}>{generating === "diet" ? "Generating…" : "Generate Diet Plan"}</BtnPrimary>
        <BtnGhost icon="⬇" onClick={() => { onGenerate("workout"); onNav("workout"); }} disabled={generating === "workout"} T={T}>{generating === "workout" ? "Generating…" : "Generate Workout"}</BtnGhost>
        <BtnGhost icon="🔍" onClick={() => onNav("explorer")} T={T}>View Progress</BtnGhost>
      </div>

      {/* Two-column: Today's Workout + Weekly Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {/* Today's Workout Card */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bgInput }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>🏋️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim }}>Today's Workout</div>
                <div style={{ fontSize: 10, color: T.txtTert }}>{todayLabel} {todayPlan ? `· ${todayPlan.focus}` : "· Rest Day"}</div>
              </div>
            </div>
            {todayPlan && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? T.green : T.accent }}>{completedCount}/{totalExs}</div>
                <div style={{ fontSize: 9, color: T.txtTert }}>done</div>
              </div>
            )}
          </div>
          {todayPlan && (
            <div style={{ height: 3, background: T.bgInput }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? T.green : T.accent, transition: "width .4s ease", borderRadius: "0 2px 2px 0" }} />
            </div>
          )}
          <div style={{ padding: "10px 16px", maxHeight: 240, overflowY: "auto" }}>
            {!workoutPlan ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏃</div>
                <div style={{ fontSize: 12, color: T.txtSec, marginBottom: 12 }}>No workout plan yet</div>
                <BtnPrimary sm icon="▶" onClick={() => { onGenerate("workout"); onNav("workout"); }} disabled={generating === "workout"} T={T}>
                  {generating === "workout" ? "Generating…" : "Generate Plan"}
                </BtnPrimary>
              </div>
            ) : !todayPlan ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🌟</div>
                <div style={{ fontSize: 12, color: T.txtSec }}>Rest day — recovery is part of the plan!</div>
                <div style={{ fontSize: 11, color: T.txtTert, marginTop: 4 }}>Stretch, hydrate and sleep well.</div>
              </div>
            ) : (
              todayPlan.exs.map((ex, i) => {
                const done = !!workoutLog[ex.name];
                return (
                  <div key={i} onClick={() => !logLoading && toggleExercise(ex.name)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
                    borderBottom: i < todayPlan.exs.length - 1 ? `1px solid ${T.border}44` : "none",
                    cursor: "pointer", transition: "opacity .15s", opacity: logLoading ? 0.6 : 1,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      background: done ? T.green : "transparent",
                      border: `2px solid ${done ? T.green : T.border2}`,
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s",
                    }}>
                      {done && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: done ? T.txtTert : T.txtPrim, textDecoration: done ? "line-through" : "none", transition: "all .18s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</div>
                      <div style={{ fontSize: 10, color: T.txtTert, fontFamily: "DM Mono" }}>{ex.sets}×{ex.reps} · {ex.rest} rest</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {EXERCISE_META[ex.name]?.video && (
                        <a href={EXERCISE_META[ex.name].video} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, opacity: 0.6, textDecoration: "none" }} title="Watch Video">📺</a>
                      )}
                      {EXERCISE_META[ex.name]?.ar_id && (
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          const meta = EXERCISE_META[ex.name];
                          onNav("ar-trainer", meta.ar_id); // Fixed ID
                        }} style={{ background: "none", border: "none", fontSize: 12, opacity: 0.6, cursor: "pointer", padding: 0 }} title="AR Trainer">🤳</button>
                      )}
                    </div>
                    {done && <span style={{ fontSize: 9, background: `${T.green}18`, color: T.green, border: `1px solid ${T.green}44`, borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Weekly Overview Card */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: T.bgInput }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim }}>Weekly Plan Overview</div>
            <div style={{ fontSize: 10, color: T.txtTert, marginTop: 2 }}>
              {planDays.size > 0 ? `${planDays.size} training days this week` : "Generate a workout plan to see overview"}
            </div>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 16 }}>
              {WEEK.map(d => {
                const isToday = d === todayLabel;
                const hasWorkout = planDays.has(d);
                const dayPlanItem = workoutPlan ? workoutPlan.find(p => p.day === d) : null;
                return (
                  <div key={d} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: isToday ? T.accent : T.txtTert, fontWeight: isToday ? 700 : 400, marginBottom: 4 }}>{d}</div>
                    <div style={{
                      width: "100%", aspectRatio: "1", borderRadius: 6,
                      background: isToday ? `${T.accent}22` : hasWorkout ? `${T.green}18` : T.bgInput,
                      border: `1px solid ${isToday ? T.accent : hasWorkout ? T.green + "44" : T.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                    }}>
                      {isToday ? "📍" : hasWorkout ? "💪" : "😴"}
                    </div>
                    {hasWorkout && <div style={{ fontSize: 8, color: isToday ? T.accent : T.txtTert, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dayPlanItem?.focus}</div>}
                  </div>
                );
              })}
            </div>
            {/* Macro Targets */}
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.txtSec, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>Daily Macro Targets</div>
              {[
                { label: "Protein", val: `${m.prot}g`, pct: Math.round((m.prot * 4 / m.target) * 100), color: T.accent },
                { label: "Carbs", val: `${Math.round((m.target - m.prot * 4) * 0.55 / 4)}g`, pct: 55, color: T.yellow },
                { label: "Fats", val: `${Math.round((m.target - m.prot * 4) * 0.45 / 9)}g`, pct: Math.max(0, Math.round(100 - Math.round((m.prot * 4 / m.target) * 100) - 55)), color: T.orange },
              ].map(({ label, val, pct: p, color }) => (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: T.txtSec }}>{label}</span>
                    <span style={{ fontSize: 10, color, fontFamily: "DM Mono", fontWeight: 600 }}>{val} · {Math.max(0, p)}%</span>
                  </div>
                  <div style={{ height: 4, background: T.bgInput, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, p))}%`, background: color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      {progressLine.length > 1 && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 16px 12px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim }}>Weight Progress Timeline</div>
            <span style={{ fontSize: 10, color: T.txtTert, fontFamily: "DM Mono" }}>{progressLine.length} check-ins</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={progressLine} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.accent} stopOpacity={.35} />
                  <stop offset="100%" stopColor={T.accent} stopOpacity={.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: T.txtTert }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: T.txtTert }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip content={<ChartTip T={T} />} />
              <Area type="monotone" dataKey="weight" stroke={T.accent} strokeWidth={2} fill="url(#wGrad)" dot={{ fill: T.accent, r: 3 }} name="Weight kg" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {progress.length > 0 && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim }}>Check-In History</div>
            <span style={{ fontSize: 10, background: `${T.accent}18`, color: T.accentLt, border: `1px solid ${T.accent}33`, borderRadius: 4, padding: "2px 8px", fontFamily: "DM Mono" }}>{progress.length} entries</span>
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {progress.map((p, i) => {
              const prev = progress[i - 1]; const delta = prev ? +(p.w - prev.w).toFixed(1) : null;
              return (
                <div key={i} style={{ flex: "0 0 100px", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 7, padding: "11px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontFamily: "DM Mono", color: T.txtTert, marginBottom: 6 }}>{p.date}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: T.txtPrim, lineHeight: 1 }}>{p.w}<span style={{ fontSize: 10, color: T.txtTert }}>kg</span></div>
                  <div style={{ fontSize: 9, color: T.txtSec, marginTop: 3 }}>BMI {p.bmi}</div>
                  {delta && <div style={{ fontSize: 9, color: delta < 0 ? T.green : T.red, fontWeight: 600, marginTop: 2 }}>{delta > 0 ? "+" : ""}{delta}kg</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DIET PAGE
════════════════════════════════════════════ */
function DietPage({ plan, metrics, generating, onGenerate, onReplace, T }) {
  const [openAlt, setOpenAlt] = useState(null);
  const totals = plan ? { cal: plan.reduce((s, m) => s + m.total_cal, 0), prot: plan.reduce((s, m) => s + m.total_prot, 0) } : null;
  const mColors = [T.accent, T.yellow, T.green, T.purple];

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero Banner */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center 40%", height: 130,
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.yellow},${T.green})`, opacity: 0.9 }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.yellow, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>NUTRITION</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", letterSpacing: "-.5px", marginBottom: 4 }}>Diet Plan</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Target: <span style={{ color: T.yellow, fontWeight: 600 }}>{metrics.target.toLocaleString()} kcal</span> · Protein: <span style={{ color: "#00d4aa", fontWeight: 600 }}>{metrics.prot}g</span></div>
        </div>
      </div>
      {!plan ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, textAlign: "center", padding: "72px 40px" }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>🥗</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.txtPrim, marginBottom: 6 }}>No diet plan generated yet</div>
          <div style={{ fontSize: 12, color: T.txtSec, marginBottom: 24, lineHeight: 1.6 }}>Generate a personalized meal plan calibrated to your calorie and protein targets.</div>
          <BtnPrimary icon="▶" onClick={() => onGenerate("diet")} disabled={generating === "diet"} T={T}>{generating === "diet" ? "Generating…" : "Run Diet Plan"}</BtnPrimary>
        </div>
      ) : (
        <>
          {/* ── Calorie & Protein match summary ── */}
          {(() => {
            const calDiff = totals.cal - metrics.target;
            const protDiff = totals.prot - metrics.prot;
            const calOk = Math.abs(calDiff) <= 120;
            const protOk = Math.abs(protDiff) <= 10;
            const calColor = calOk ? T.green : calDiff > 0 ? T.red : T.orange;
            const protColor = protOk ? T.green : protDiff > 0 ? T.accentLt : T.orange;
            const calPct = Math.round((totals.cal / metrics.target) * 100);
            const protPct = Math.round((totals.prot / metrics.prot) * 100);
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {/* Calories card */}
                <div style={{ background: T.bgCard, border: `1px solid ${calOk ? "#4db88244" : calDiff > 0 ? "#e0555544" : "#e07a3544"}`, borderRadius: 9, padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Calories</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: calColor }}>{totals.cal.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: T.txtTert }}>/ {metrics.target.toLocaleString()} kcal</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: calColor, background: `${calColor}18`, border: `1px solid ${calColor}44`, borderRadius: 5, padding: "3px 10px" }}>
                      {calOk ? "✓ On Target" : calDiff > 0 ? `+${calDiff} over` : `${Math.abs(calDiff)} under`}
                    </span>
                  </div>
                  <div style={{ height: 6, background: T.bgInput, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(calPct, 100)}%`, background: `linear-gradient(90deg,${calColor},${calColor}99)`, borderRadius: 3, transition: "width .8s ease" }} />
                  </div>
                  <div style={{ fontSize: 9, color: T.txtTert, marginTop: 5 }}>{calPct}% of daily target</div>
                </div>
                {/* Protein card */}
                <div style={{ background: T.bgCard, border: `1px solid ${protOk ? "#00d4aa44" : protDiff > 0 ? "#5b7cf544" : "#e07a3544"}`, borderRadius: 9, padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Protein</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: protColor }}>{totals.prot}</span>
                        <span style={{ fontSize: 11, color: T.txtTert }}>/ {metrics.prot}g</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: protColor, background: `${protColor}18`, border: `1px solid ${protColor}44`, borderRadius: 5, padding: "3px 10px" }}>
                      {protOk ? "✓ On Target" : protDiff > 0 ? `+${protDiff}g over` : `${Math.abs(protDiff)}g under`}
                    </span>
                  </div>
                  <div style={{ height: 6, background: T.bgInput, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(protPct, 100)}%`, background: `linear-gradient(90deg,${protColor},${protColor}99)`, borderRadius: 3, transition: "width .8s ease" }} />
                  </div>
                  <div style={{ fontSize: 9, color: T.txtTert, marginTop: 5 }}>{protPct}% of daily target</div>
                </div>
              </div>
            );
          })()}
          {plan.map((meal, mi) => (
            <div key={mi} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderLeft: `3px solid ${mColors[mi % 4]}`, borderRadius: 8, marginBottom: 10 }}>
              <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 15 }}>{meal.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>{meal.name}</span>
                  <span style={{ fontSize: 10, color: T.txtTert, fontFamily: "DM Mono" }}>{meal.time}</span>
                </div>
                <div style={{ fontSize: 11, color: T.txtSec }}>
                  <span style={{ color: T.yellow }}>{meal.total_cal} kcal</span>
                  <span style={{ color: T.txtTert, margin: "0 6px" }}>·</span>
                  <span style={{ color: T.accentLt }}>{meal.total_prot}g prot</span>
                </div>
              </div>
              <div style={{ padding: "0 16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 80px", gap: 6, padding: "7px 0", fontSize: 9, fontWeight: 600, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em", borderBottom: `1px solid ${T.border}` }}>
                  <div>Food Item</div><div style={{ textAlign: "right" }}>Kcal</div><div style={{ textAlign: "right" }}>Prot</div><div style={{ textAlign: "right" }}>Swap</div>
                </div>
                {(meal.foods || []).map((food, fi) => {
                  const key = `${mi}-${fi}`; const alts = getAlts({ ...food, cal: food.calories || food.cal, prot: food.protein || food.prot }); const open = openAlt === key;
                  return (
                    <div key={fi}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 80px", gap: 6, padding: "8px 0", borderBottom: `1px solid ${T.border}44`, alignItems: "center" }}>
                        <div style={{ fontSize: 12, color: T.txtPrim }}>{food.name}</div>
                        <div style={{ fontSize: 11, fontFamily: "DM Mono", color: T.yellow, textAlign: "right" }}>{food.calories || food.cal}</div>
                        <div style={{ fontSize: 11, fontFamily: "DM Mono", color: T.accentLt, textAlign: "right" }}>{food.protein || food.prot}g</div>
                        <div style={{ textAlign: "right" }}>
                          {alts.length > 0 && (
                            <button onClick={() => setOpenAlt(open ? null : key)} style={{ background: open ? `${T.red}18` : "transparent", border: `1px solid ${open ? T.red : T.border}`, color: open ? T.red : T.txtTert, padding: "3px 8px", borderRadius: 4, fontSize: 9, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>
                              {open ? "✕ Close" : "Modify"}
                            </button>
                          )}
                        </div>
                      </div>
                      {open && (
                        <div style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 12px", margin: "6px 0", animation: "fadeUp .15s ease" }}>
                          <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Alternatives · ±65 kcal · ±9g protein</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {alts.map((alt, ai) => (
                              <button key={ai} onClick={() => { onReplace(mi, fi, { ...alt, calories: alt.cal, protein: alt.prot }); setOpenAlt(null); }} style={{ background: T.bgCard, border: `1px solid ${T.border}`, color: T.txtSec, padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s", display: "flex", gap: 8, alignItems: "center" }}>
                                {alt.name}<span style={{ color: T.yellow, fontSize: 9, fontFamily: "DM Mono" }}>{alt.cal}</span><span style={{ color: T.accentLt, fontSize: 9, fontFamily: "DM Mono" }}>{alt.prot}g</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <BtnGhost sm icon="↺" onClick={() => onGenerate("diet")} disabled={generating === "diet"} T={T}>{generating === "diet" ? "Generating…" : "Regenerate Plan"}</BtnGhost>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   WORKOUT PAGE
════════════════════════════════════════════ */
function WorkoutPage({ plan, user, generating, onGenerate, T }) {
  const [demoEx, setDemoEx] = useState(null); // {name, videoId, tips, muscles}

  /* ── Exercise knowledge base ─────────────────────────────────────── */
  const EX_DB = {
    // Chest
    "Barbell Bench Press": { vid: "SCVCLChPQFY", muscles: "Pectorals · Triceps · Front Delts", tips: ["Retract and depress your shoulder blades", "Keep feet flat on the floor", "Lower bar to lower chest, not neck", "Drive feet into floor on press"] },
    "Incline DB Press": { vid: "8iPEnn-ltC8", muscles: "Upper Pectorals · Triceps · Front Delts", tips: ["Set bench to 30-45°", "Keep elbows at ~75° from body", "Touch DBs together at top", "Control the eccentric"] },
    "Cable Flyes": { vid: "TAn289o1aJE", muscles: "Pectorals (stretch emphasis)", tips: ["Keep slight elbow bend throughout", "Feel the stretch at the bottom", "Squeeze chest at top", "Don't use momentum"] },
    "Chest Dips": { vid: "2z8JmcrW-As", muscles: "Lower Pectorals · Triceps", tips: ["Lean forward to emphasize chest", "Go until upper arm is parallel to floor", "Control descent — 3 seconds down", "Add weight once 15+ reps is easy"] },
    "Push-Up Burnout": { vid: "IODxDxX7oi4", muscles: "Pectorals · Triceps · Core", tips: ["Maintain straight body line", "Elbows at 45° from body", "Full range of motion", "Rest only when form breaks"] },
    // Back
    "Deadlift": { vid: "1ZXobu7JvvE", muscles: "Erectors · Glutes · Hamstrings · Traps", tips: ["Bar over mid-foot, hip-width stance", "Hinge hips back, neutral spine", "Drive floor away — don't yank", "Lock out glutes and hips at top"] },
    "Lat Pulldown": { vid: "JGeRYIZdojU", muscles: "Latissimus Dorsi · Biceps", tips: ["Lean back ~15°, chest up", "Pull to upper chest, not behind neck", "Squeeze lats — not just arms", "Control the return, don't let it fly up"] },
    "Barbell Row": { vid: "FWJR5Ve8bnQ", muscles: "Mid Back · Lats · Rhomboids · Biceps", tips: ["Hinge to ~45°, neutral spine", "Pull to belly button", "Squeeze shoulder blades at top", "Don't jerk or use lower back momentum"] },
    "Seated Cable Row": { vid: "GZbfZ033f74", muscles: "Mid Back · Lats · Biceps", tips: ["Sit tall, slight lean back", "Pull elbows back and squeeze", "Don't round forward on stretch", "2-second hold at peak contraction"] },
    "Face Pulls": { vid: "rep-qVOkidI", muscles: "Rear Delts · Rotator Cuff · Upper Traps", tips: ["Set cable at face height", "Pull to forehead, hands outside elbows", "Externally rotate at the end", "High reps (15-20) work best"] },
    // Legs
    "Barbell Squat": { vid: "ultWZbUMPL8", muscles: "Quads · Glutes · Hamstrings · Core", tips: ["Bar on traps, not neck", "Brace core before descent", "Knees track over toes", "Break parallel for full glute activation"] },
    "Leg Press": { vid: "IZxyjW7MPJQ", muscles: "Quads · Glutes · Hamstrings", tips: ["Place feet shoulder-width, mid-platform", "Don't lock knees at top", "Control descent — 3 seconds down", "Stop before hips roll off pad"] },
    "Romanian Deadlift": { vid: "JCXUYuzwNrM", muscles: "Hamstrings · Glutes · Erectors", tips: ["Soft knee bend, not a squat", "Push hips back, feel hamstring stretch", "Bar stays close to legs throughout", "Stop when hips can't go further back"] },
    "Leg Curl": { vid: "ELOCsoDSmrg", muscles: "Hamstrings", tips: ["Don't let hips rise off pad", "Full range of motion", "Squeeze at top contraction", "Slow negative — 3 seconds"] },
    "Calf Raises": { vid: "gwLzBJYoWlQ", muscles: "Gastrocnemius · Soleus", tips: ["Full range — stretch at bottom", "Pause 1 second at top", "Use bodyweight or a machine", "High reps (15-25) work well for calves"] },
    // Shoulders
    "OHP Barbell": { vid: "2yjwXTZbDtE", muscles: "Front Delts · Side Delts · Triceps", tips: ["Grip just outside shoulder width", "Bar path slightly in front of face", "Squeeze glutes and brace core", "Don't flare elbows excessively"] },
    "Lateral Raises": { vid: "3VcKaXpzqRo", muscles: "Side Deltoids", tips: ["Slight forward lean", "Lead with elbow, not wrist", "Stop at shoulder height", "Lower slowly — 3 seconds down"] },
    "Front Raises": { vid: "gkjY6fSf2mM", muscles: "Front Deltoids", tips: ["Alternate arms or do both", "Stop at shoulder height", "Keep slight elbow bend", "Control descent — don't drop"] },
    "Rear Delt Flyes": { vid: "EA7u4Q_8HQ0", muscles: "Rear Deltoids · Rhomboids", tips: ["Lean forward ~45° or use cable", "Lead with elbows, not hands", "Squeeze rear delts at the top", "High reps build best detail"] },
    "Arnold Press": { vid: "6Z15_WdXmVw", muscles: "All Deltoid Heads", tips: ["Start with palms facing you", "Rotate as you press up", "Full range of motion", "Keep core tight"] },
    // Arms
    "Barbell Curl": { vid: "ykJmrZ5v0Oo", muscles: "Biceps Brachii", tips: ["Upper arms stay pinned at sides", "Full stretch at bottom", "Squeeze at top", "Don't use momentum — strict form"] },
    "Tricep Pushdown": { vid: "2-LAMcpzODU", muscles: "Triceps (all 3 heads)", tips: ["Elbows glued to sides", "Full extension at bottom", "Control the return", "Use rope for more range"] },
    "Hammer Curl": { vid: "zC3nLlEvin4", muscles: "Brachialis · Brachioradialis", tips: ["Neutral grip throughout", "Alternate arms or together", "Don't swing body", "Full range of motion"] },
    "Skull Crushers": { vid: "d_KZxkY_5cM", muscles: "Long Head Triceps", tips: ["Lower to forehead (or behind it)", "Keep elbows pointing up", "Control descent carefully", "Keep upper arms stationary"] },
    "Preacher Curl": { vid: "fIWP-FRFNU0", muscles: "Biceps (peak emphasis)", tips: ["Full stretch at the bottom", "Don't swing or yank", "Squeeze hard at the top", "Slow negatives build more muscle"] },
    // Core
    "Plank": { vid: "pSHjTRCQxIw", muscles: "Core · Transverse Abdominis · Glutes", tips: ["Straight line head to heels", "Don't let hips sag or pike", "Breathe steadily", "Squeeze glutes and abs hard"] },
    "Hanging Leg Raise": { vid: "hdng3graZSQ", muscles: "Lower Abs · Hip Flexors", tips: ["Minimize swing", "Tuck pelvis at top", "Control descent — don't drop", "Bend knees if needed"] },
    "Cable Crunch": { vid: "AV5PmFr6kVg", muscles: "Rectus Abdominis", tips: ["Crunch abs — don't pull neck", "Keep hips stationary", "Round spine on contraction", "High reps (15-20)"] },
    "Russian Twist": { vid: "JyUqwkVpsi8", muscles: "Obliques · Core", tips: ["Lean back 45°", "Touch the floor each side", "Add weight when easy", "Keep feet off floor for harder version"] },
    "Treadmill": { vid: "YONPkTNLYno", muscles: "Cardiovascular · Legs", tips: ["Maintain steady breathing", "Incline 1-2% for natural running feel", "Land mid-foot, not heel", "Swing arms naturally"] },
    // Home
    "Push-Ups": { vid: "IODxDxX7oi4", muscles: "Pectorals · Triceps · Core", tips: ["Hands shoulder-width apart", "Body in a straight line", "Elbows at 45° from body", "Chest touches the floor"] },
    "Jump Squats": { vid: "CVaEhXotL7M", muscles: "Quads · Glutes · Calves · Cardio", tips: ["Land softly, knees bent", "Jump from parallel squat", "Use arms for momentum", "Land heel-to-toe"] },
    "Glute Bridges": { vid: "OUgsJ8-Vi0E", muscles: "Glutes · Hamstrings · Core", tips: ["Drive through heels", "Squeeze glutes at top", "Keep back neutral", "Add weight on hips to progress"] },
    "Mountain Climbers": { vid: "nmwgirgXLYM", muscles: "Core · Shoulders · Cardio", tips: ["Keep hips level — don't raise them", "Drive knees to chest alternately", "Fast pace for cardio benefit", "Brace core throughout"] },
    "Burpees": { vid: "TU8QYVW0gDU", muscles: "Full Body · Cardio", tips: ["Land softly from the jump", "Keep push-up form honest", "Explosive jump at the top", "Scale by stepping out instead of jumping"] },
  };

  const lookupEx = (name) => {
    if (EX_DB[name]) return { ...EX_DB[name], name };
    // fuzzy match
    const key = Object.keys(EX_DB).find(k => name.toLowerCase().includes(k.toLowerCase().split(" ")[0]));
    return key ? { ...EX_DB[key], name } : null;
  };

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center 35%", height: 130
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.accent},${T.orange})` }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.orange, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>TRAINING</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 3 }}>Workout Plan</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{user.workoutType} · {user.workoutDays} days/week · {user.workoutHours}h/session · <span style={{ color: T.orange, fontWeight: 600 }}>Goal: {user.goal}</span></div>
        </div>
      </div>

      {!plan ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, textAlign: "center", padding: "72px 40px" }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>🏋️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.txtPrim, marginBottom: 6 }}>No workout plan yet</div>
          <div style={{ fontSize: 12, color: T.txtSec, marginBottom: 24 }}>Generate your personalised {user.workoutType} split for {user.goal}.</div>
          <BtnPrimary icon="▶" onClick={() => onGenerate("workout")} disabled={generating === "workout"} T={T}>{generating === "workout" ? "Generating…" : "Generate Workout"}</BtnPrimary>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <BtnGhost icon="↺" sm onClick={() => onGenerate("workout")} disabled={generating === "workout"} T={T}>{generating === "workout" ? "…" : "Regenerate"}</BtnGhost>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
            {plan.map((day, di) => (
              <div key={di} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderLeft: `4px solid ${day.col}`, borderRadius: 10, overflow: "hidden", animation: `fadeUp .4s ease ${di * 0.06}s both` }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: `${day.col}08` }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: day.col, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 2 }}>{day.day}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.txtPrim }}>{day.focus}</div>
                  </div>
                  <div style={{ fontSize: 10, color: T.txtTert }}>{day.exs.length} exercises</div>
                </div>
                <div style={{ padding: "8px 0" }}>
                  {(day.exs || []).map((ex, ei) => {
                    const info = lookupEx(ex.name);
                    return (
                      <div key={ei} style={{ display: "grid", gridTemplateColumns: "1fr 40px 50px 50px 28px", gap: 6, padding: "9px 16px", borderBottom: `1px solid ${T.border}33`, alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim }}>{ex.name}</div>
                        <div style={{ fontSize: 10, color: T.txtSec, textAlign: "center", fontFamily: "DM Mono" }}>{ex.sets}×</div>
                        <div style={{ fontSize: 10, color: day.col, textAlign: "center", fontFamily: "DM Mono" }}>{ex.reps}</div>
                        <div style={{ fontSize: 9, color: T.txtTert, textAlign: "center" }}>{ex.rest}</div>
                        {info && (
                          <div onClick={() => setDemoEx(info)} title="Watch how-to"
                            style={{ width: 24, height: 24, borderRadius: 6, background: `${day.col}22`, border: `1px solid ${day.col}44`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, transition: "all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${day.col}44`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `${day.col}22`; }}>
                            ▶
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Exercise Demo Modal ─────────────────────────────────────────── */}
      {demoEx && (
        <div onClick={e => e.target === e.currentTarget && setDemoEx(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)" }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border2}`, borderRadius: 14, width: "100%", maxWidth: 700, animation: "scaleIn .22s ease", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bgInput }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.txtPrim }}>{demoEx.name}</div>
                <div style={{ fontSize: 11, color: T.accentLt, marginTop: 2 }}>💪 {demoEx.muscles}</div>
              </div>
              <button onClick={() => setDemoEx(null)} style={{ background: "transparent", border: "none", color: T.txtTert, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "4px 8px" }}>✕</button>
            </div>
            {/* YouTube embed */}
            <div style={{ position: "relative", paddingBottom: "52%", background: "#000" }}>
              <iframe
                src={`https://www.youtube.com/embed/${demoEx.vid}?autoplay=1&rel=0&modestbranding=1`}
                title={demoEx.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
            {/* Tips */}
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Key Form Tips</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {demoEx.tips.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 12px" }}>
                    <span style={{ color: T.accent, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                    <span style={{ fontSize: 11, color: T.txtSec, lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: "10px 14px", background: `${T.accent}10`, border: `1px solid ${T.accent}30`, borderRadius: 7, fontSize: 11, color: T.txtSec }}>
                💡 <b style={{ color: T.accentLt }}>Pro tip:</b> Watch the full video before your first set. Focus on form before adding weight.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const SUGGESTIONS = ["How much protein do I need?", "What's my calorie target?", "Best pre-workout nutrition?", "How does creatine work?", "How many rest days?", "How to break a plateau?"];

function ChatPage({ msgs, mode, user, metrics, onAdd, onMode, onClear, onGenerate, onNav, T }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(null); // null=checking, true=up, false=down
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  // Ping Ollama on mount to show status
  useEffect(() => {
    fetch("http://localhost:11434/api/tags", { method: "GET" })
      .then(r => r.ok ? setOllamaOnline(true) : setOllamaOnline(false))
      .catch(() => setOllamaOnline(false));
  }, []);

  const send = async (text) => {
    const m = (text || input).trim(); if (!m || loading) return;
    setInput(""); onAdd({ role: "user", content: m }); setLoading(true);
    
    try {
      const ollamaPrompt = `You are AdaptFit AI — a concise, evidence-based fitness coach. Keep replies short and actionable.

User: ${user.name}, ${user.age}yr ${user.gender}, ${user.weight}kg, Goal: ${user.goal}
Level: ${user.fitnessLevel || 'Intermediate'} | BMI ${metrics.bmi} | TDEE ${metrics.tdee} kcal | Target ${metrics.target} kcal | Protein ${metrics.prot}g/day
Training: ${user.workoutType}, ${user.workoutDays}x/week

Rules:
- Be direct and brief. No lengthy preambles.
- Use numbers specific to this user, not generic advice.
- For greetings respond warmly in 1-2 lines only.
- For medical questions redirect to a doctor.
- Format key values in CAPS or with numbers for clarity.

User message: ${m}

Response:`;

      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2:3b",
          prompt: ollamaPrompt,
          stream: false,
          options: { temperature: 0.7, num_predict: 300 }
        }),
      });

      if (!response.ok) throw new Error("Ollama not available");
      const result = await response.json();
      const reply = result?.response?.trim();
      if (!reply) throw new Error("Empty response");
      onAdd({ role: "ai", content: reply });
    } catch (err) {
      console.error("Ollama not running, using local fallback:", err);
      onAdd({ role: "ai", content: aiReply(m, user, metrics, healthReports) });
    } finally {
      setLoading(false);
    }
  };

  const render = txt => txt.split("**").map((p, i) => i % 2 === 1 ? <b key={i} style={{ color: T.txtPrim, fontWeight: 600 }}>{p}</b> : p);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)", animation: "fadeUp .3s ease" }}>
      {/* Hero Banner */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 18,
        backgroundImage: "url('https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center 20%", height: 110,
        flexShrink: 0,
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.5) 70%,rgba(0,0,0,0.15) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.accent},#00d4aa)`, opacity: 0.9 }} />
        <div style={{ position: "relative", zIndex: 1, padding: "18px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#00d4aa", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 4 }}>AI COACHING</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", letterSpacing: "-.5px", marginBottom: 3 }}>AI Assistant</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Personalized fitness coaching · Two operational modes</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", background: T.bgInput, borderRadius: 6, padding: 3, gap: 2 }}>
          {["general", "plan"].map(m => (
            <button key={m} onClick={() => onMode(m)} style={{ padding: "5px 14px", borderRadius: 4, fontSize: 11, fontWeight: 500, color: mode === m ? T.txtPrim : T.txtSec, background: mode === m ? T.bgCard : "transparent", border: "none", cursor: "pointer", transition: "all .15s", fontFamily: "DM Sans" }}>
              {m === "general" ? "General Assistant" : "Plan Generator"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 10, background: mode === "general" ? `${T.green}18` : `${T.yellow}18`, color: mode === "general" ? T.green : T.yellow, border: `1px solid ${mode === "general" ? T.green : T.yellow}44`, borderRadius: 4, padding: "2px 8px", fontFamily: "DM Mono" }}>
          {mode === "general" ? "Live Q&A" : "JSON Output"}
        </span>
        {/* Ollama status badge */}
        <span style={{ fontSize: 10, borderRadius: 4, padding: "2px 8px", fontFamily: "DM Mono", display: "flex", alignItems: "center", gap: 4,
          background: ollamaOnline === true ? `${T.green}18` : ollamaOnline === false ? "rgba(224,85,85,0.12)" : `${T.border}`,
          color: ollamaOnline === true ? T.green : ollamaOnline === false ? "#e05555" : T.txtTert,
          border: `1px solid ${ollamaOnline === true ? T.green + "44" : ollamaOnline === false ? "rgba(224,85,85,0.3)" : T.border}` }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ollamaOnline === true ? T.green : ollamaOnline === false ? "#e05555" : T.txtTert, display: "inline-block", animation: ollamaOnline === null ? "blink 1s infinite" : "none" }} />
          {ollamaOnline === null ? "Checking Ollama…" : ollamaOnline ? "Ollama online" : "Ollama offline — fallback mode"}
        </span>
        <BtnGhost sm style={{ marginLeft: "auto" }} onClick={onClear} T={T}>Clear</BtnGhost>
      </div>
      {mode === "plan" && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 7, padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: T.txtSec, marginBottom: 10 }}>Plan Generator outputs <b style={{ color: T.txtPrim }}>structured JSON only</b> for programmatic consumption.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <BtnPrimary sm icon="🥗" onClick={() => { onGenerate("diet"); onNav("diet"); }} T={T}>Generate Diet JSON</BtnPrimary>
            <BtnGhost sm icon="🏋️" onClick={() => { onGenerate("workout"); onNav("workout"); }} T={T}>Generate Workout JSON</BtnGhost>
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 8, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", animation: "fadeUp .18s ease" }}>
            <div style={{ width: 24, height: 24, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, marginTop: 1, background: msg.role === "ai" ? `${T.accent}28` : T.bgInput, color: msg.role === "ai" ? T.accentLt : T.txtSec }}>
              {msg.role === "ai" ? "AI" : user.name.charAt(0)}
            </div>
            <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 12, lineHeight: 1.7, background: msg.role === "ai" ? T.bgInput : `${T.accent}14`, border: `1px solid ${msg.role === "ai" ? T.border : T.accent + "33"}`, color: msg.role === "ai" ? T.txtSec : T.txtPrim, whiteSpace: "pre-wrap" }}>
              {render(msg.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignSelf: "flex-start" }}>
            <div style={{ width: 24, height: 24, borderRadius: 5, background: `${T.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: T.accentLt }}>AI</div>
            <div style={{ padding: "10px 14px", borderRadius: 6, background: T.bgInput, border: `1px solid ${T.border}`, display: "flex", gap: 4, alignItems: "center" }}>
              {[0, .15, .3].map(d => <span key={d} style={{ width: 5, height: 5, background: T.txtTert, borderRadius: "50%", display: "inline-block", animation: `dot .8s ${d}s infinite` }} />)}
            </div>
          </div>
        )}
        {msgs.length <= 2 && mode === "general" && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Suggested questions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{ background: T.bgInput, border: `1px solid ${T.border}`, color: T.txtSec, padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {mode === "general" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 7, padding: 8, alignItems: "flex-end" }}>
          <textarea rows={2} placeholder="Ask about nutrition, training, supplements, recovery…" value={input} onChange={e => setInput(e.target.value)} disabled={loading}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ flex: 1, background: "transparent", border: "none", color: T.txtPrim, fontSize: 12, resize: "none", outline: "none", fontFamily: "DM Sans", lineHeight: 1.6 }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{ background: input.trim() && !loading ? T.accent : T.bgInput, color: "#fff", padding: "6px 14px", borderRadius: 5, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: (!input.trim() || loading) ? .4 : 1, transition: "all .2s", fontFamily: "DM Sans", flexShrink: 0 }}>Send</button>
        </div>
      )}
      <div style={{ fontSize: 10, color: T.txtTert, textAlign: "center", padding: "5px 0", letterSpacing: ".03em" }}>
        ⚠ General fitness guidance only · Not medical advice · Powered by <span style={{ color: T.accentLt }}>llama3.2:3b</span> via Ollama
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PROGRESS PAGE
════════════════════════════════════════════ */
function ProgressPage({ history, user, metrics, onUpdate, T }) {
  const totalChange = history.length ? +(user.weight - history[0].w).toFixed(1) : null;
  const chartData = history.map(p => ({ name: p.date.replace(" 20", "'"), weight: p.w, bmi: p.bmi }));
  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero Banner */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center 30%", height: 130,
        flexShrink: 0,
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.green},${T.teal})`, opacity: 0.9 }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.green, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>TRACKING</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", letterSpacing: "-.5px", marginBottom: 3 }}>Progress</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Monthly weight tracking and plan recalibration</div>
          </div>
          <BtnPrimary sm icon="+" onClick={onUpdate} T={T} style={{ flexShrink: 0 }}>Log Weight Update</BtnPrimary>
        </div>
      </div>
      {history.length === 0 ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, textAlign: "center", padding: "72px 40px" }}>
          <div style={{ fontSize: 42, marginBottom: 14 }}>📈</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.txtPrim, marginBottom: 6 }}>No progress data yet</div>
          <div style={{ fontSize: 12, color: T.txtSec, marginBottom: 24 }}>Log your first weight update to start tracking.</div>
          <BtnPrimary icon="+" onClick={onUpdate} T={T}>Log Weight Update</BtnPrimary>
        </div>
      ) : (
        <>
          {history.length >= 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 14 }}>
              {[["Total Change", (totalChange > 0 ? "+" : "") + totalChange + "kg", totalChange < 0 ? T.green : T.red], ["Current BMI", "" + metrics.bmi, T.txtPrim], ["Target Cal", metrics.target + " kcal", T.yellow], ["Check-ins", "" + history.length, T.txtPrim], ["Protein Goal", metrics.prot + "g", T.accentLt]].map(([l, v, c]) => (
                <div key={l} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: 7, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em", marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          )}
          {chartData.length > 1 && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim, marginBottom: 12 }}>Weight Trend</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.accent} stopOpacity={.3} />
                      <stop offset="100%" stopColor={T.accent} stopOpacity={.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: T.txtTert }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: T.txtTert }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTip T={T} />} />
                  <Area type="monotone" dataKey="weight" stroke={T.accent} strokeWidth={2} fill="url(#pg)" dot={{ fill: T.accent, r: 3 }} name="Weight kg" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim }}>History Table</div>
              <span style={{ fontSize: 10, background: `${T.accent}18`, color: T.accentLt, border: `1px solid ${T.accent}33`, borderRadius: 4, padding: "2px 8px", fontFamily: "DM Mono" }}>{history.length} entries</span>
            </div>
            <div style={{ padding: "0 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr 1fr", gap: 6, padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 9, fontWeight: 600, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em" }}>
                <div>Date</div><div>Weight</div><div>BMI</div><div>Target Cal</div><div>Δ Change</div>
              </div>
              {[...history].reverse().map((p, i, arr) => {
                const prev = arr[i + 1]; const delta = prev ? +(p.w - prev.w).toFixed(1) : null;
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.2fr 1fr", gap: 6, padding: "9px 0", borderBottom: `1px solid ${T.border}44`, fontSize: 12, alignItems: "center" }}>
                    <div style={{ fontFamily: "DM Mono", fontSize: 10, color: T.txtSec }}>{p.date}</div>
                    <div style={{ fontWeight: 700, color: T.txtPrim }}>{p.w}<span style={{ fontSize: 10, color: T.txtTert, fontWeight: 400 }}> kg</span></div>
                    <div style={{ fontFamily: "DM Mono", fontSize: 11, color: T.txtSec }}>{p.bmi}</div>
                    <div style={{ fontFamily: "DM Mono", fontSize: 11, color: T.yellow }}>{p.cal}</div>
                    <div style={{ fontFamily: "DM Mono", fontSize: 11, fontWeight: 600, color: delta == null ? T.border : delta < 0 ? T.green : T.red }}>{delta != null ? (delta > 0 ? "+" : "") + delta + "kg" : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   PROFILE PAGE
════════════════════════════════════════════ */
const ARCH = [["BMI Formula", "weight(kg) ÷ height(m)²"], ["BMR", "Mifflin-St Jeor Equation"], ["TDEE", "BMR × Activity Multiplier"], ["Fat Loss", "TDEE − 500 kcal"], ["Muscle Gain", "TDEE + 300 kcal"], ["Recomposition", "TDEE − 200 kcal"], ["Protein (Fat Loss)", "2.2g/kg"], ["Protein (Muscle)", "2.4g/kg"], ["Diet Modify", "±65 kcal · ±9g protein"], ["Update Cycle", "30 days"], ["Chat Mode 1", "Plan Gen → JSON"], ["Chat Mode 2", "General → Q&A"], ["Safety Filter", "Medical → redirect"], ["Workout Rotation", "3-month variation"]];

function ProfilePage({ user, metrics, T }) {
  const bi = bmiMeta(metrics.bmi, T);
  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero Banner */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1549476464-37392f717541?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center 35%", height: 130,
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.accent},${T.yellow})`, opacity: 0.9 }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.accentLt, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>SETTINGS</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", letterSpacing: "-.5px", marginBottom: 3 }}>Profile</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Fitness profile, computed metrics, system reference</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.txtPrim }}>Personal Information</div>
          <div style={{ padding: "0 16px" }}>
            {[["Full Name", user.name], ["Email", user.email], ["Age", user.age + " years"], ["Gender", user.gender], ["Height", user.height + " cm"], ["Weight", user.weight + " kg"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.border}44`, fontSize: 12 }}>
                <span style={{ color: T.txtSec }}>{l}</span>
                <span style={{ fontWeight: 500, color: T.txtPrim }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.txtPrim }}>Fitness Configuration</div>
          <div style={{ padding: "0 16px" }}>
            {[["Goal", user.goal], ["Activity", user.activityLevel], ["Workout Type", user.workoutType], ["Days/Week", user.workoutDays], ["Hrs/Day", user.workoutHours + "h"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.border}44`, fontSize: 12 }}>
                <span style={{ color: T.txtSec }}>{l}</span>
                {l === "Goal" ? <span style={{ fontSize: 9, background: `${T.accent}18`, color: T.accentLt, border: `1px solid ${T.accent}33`, borderRadius: 4, padding: "2px 8px", fontFamily: "DM Mono" }}>{v}</span> : <span style={{ fontWeight: 500, color: T.txtPrim }}>{v}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.txtPrim }}>Calculated Metrics</div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[["BMI", "" + metrics.bmi, bi.c, bi.l], ["TDEE", metrics.tdee + " kcal", T.txtSec, "Maintenance"], ["Target Cal", metrics.target + " kcal", T.yellow, "Daily Goal"], ["Protein", metrics.prot + "g", T.accentLt, "Daily Protein"]].map(([l, v, c, s]) => (
            <div key={l} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: 7, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 10, color: T.txtTert, marginTop: 4 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8 }}>
        <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.txtPrim }}>System Architecture Reference</div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ARCH.map(([k, v]) => (
            <div key={k} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 12px" }}>
              <div style={{ fontSize: 9, color: T.txtTert, fontFamily: "DM Mono", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 12, color: T.txtPrim }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



/* ════════════════════════════════════════════
   UPLOAD DATA PAGE
════════════════════════════════════════════ */
function UploadDataPage({ user, T }) {
  const [activeTab, setActiveTab] = useState("manual");
  const [dragOver, setDragOver] = useState(false);
  const [dataType, setDataType] = useState("weight");
  const [formVals, setFormVals] = useState({ weight: "", calories: "", water: "", sleep: "", notes: "", date: new Date().toISOString().split("T")[0] });
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved"
  const [uploadedFiles, setUploadedFiles] = useState([
    { name: "workout_log_jan2026.csv", size: "14 KB", rows: 42, status: "success", date: "Jan 30, 2026", type: "Workout" },
    { name: "diet_tracker_dec2025.csv", size: "8 KB", rows: 31, status: "success", date: "Dec 28, 2025", type: "Nutrition" },
    { name: "weight_history_2025.csv", size: "3 KB", rows: 12, status: "error", date: "Dec 10, 2025", type: "Weight" },
  ]);
  const [recentEntries, setRecentEntries] = useState([
    { label: "Weight", val: "80.0 kg", date: "Today", color: "#5b7cf5" },
    { label: "Water", val: "2.4 L", date: "Today", color: "#38b4b4" },
    { label: "Sleep", val: "7.5 hrs", date: "Yesterday", color: "#4db882" },
    { label: "Calories Burned", val: "320 kcal", date: "Yesterday", color: "#e8a83a" },
  ]);

  const setFV = (k, v) => setFormVals(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      const newEntry = { label: DATA_TYPES.find(d => d.id === dataType).label, val: formVals.weight || formVals.calories || formVals.water || "—", date: "Just now", color: DATA_TYPES.find(d => d.id === dataType).color };
      setRecentEntries(p => [newEntry, ...p.slice(0, 3)]);
      setFormVals({ weight: "", calories: "", water: "", sleep: "", notes: "", date: new Date().toISOString().split("T")[0] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    }, 800);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const newFile = { name: file.name, size: Math.round(file.size / 1024) + " KB", rows: Math.floor(Math.random() * 50 + 10), status: "success", date: "Just now", type: "Custom" };
      setUploadedFiles(p => [newFile, ...p]);
    }
  };

  const DATA_TYPES = [
    { id: "weight", label: "Body Weight", icon: "⚖️", color: "#5b7cf5", fields: [{ k: "weight", l: "Weight (kg)", t: "number" }] },
    { id: "nutrition", label: "Nutrition Log", icon: "🥗", color: "#4db882", fields: [{ k: "calories", l: "Calories (kcal)", t: "number" }] },
    { id: "workout", label: "Workout Session", icon: "🏋️", color: "#e8a83a", fields: [{ k: "calories", l: "Calories burned", t: "number" }] },
    { id: "wellness", label: "Wellness", icon: "💧", color: "#38b4b4", fields: [{ k: "water", l: "Water (L)", t: "number" }, { k: "sleep", l: "Sleep (hrs)", t: "number" }] },
  ];
  const activeType = DATA_TYPES.find(d => d.id === dataType) || DATA_TYPES[0];

  const TABS = [["manual", "✏️ Manual Entry"], ["csv", "📁 CSV Import"], ["history", "🕒 Import History"], ["format", "📋 Format Guide"]];
  const TYPE_ICONS = { Workout: "🏋️", Nutrition: "🥗", Weight: "⚖️", Custom: "📄" };

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center 40%", height: 130
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#00d4aa,#5b7cf5)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#00d4aa", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>DATA IMPORT</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 3 }}>Upload Data</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Import CSV files or log data manually · <span style={{ color: "#00d4aa", fontWeight: 600 }}>{uploadedFiles.filter(u => u.status === "success").length} files imported</span></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["📁", uploadedFiles.length + " Files", "#5b7cf5"], ["✅", uploadedFiles.filter(u => u.status === "success").length + " OK", "#4db882"], ["❌", uploadedFiles.filter(u => u.status === "error").length + " Failed", "#e05555"]].map(([ic, lb, cl]) => (
              <div key={lb} style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${cl}44`, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 13 }}>{ic}</div>
                <div style={{ fontSize: 9, color: cl, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap" }}>{lb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, background: T.bgCard, borderRadius: 8, padding: 4, marginBottom: 16, border: `1px solid ${T.border}` }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, fontSize: 11, fontWeight: activeTab === id ? 600 : 400, background: activeTab === id ? T.bgActive : "transparent", color: activeTab === id ? T.txtPrim : T.txtSec, border: `1px solid ${activeTab === id ? T.borderAct : "transparent"}`, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>{label}</button>
        ))}
      </div>

      {/* MANUAL ENTRY */}
      {activeTab === "manual" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.txtSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Select Data Type</div>
            {DATA_TYPES.map(dt => (
              <div key={dt.id} onClick={() => setDataType(dt.id)} style={{ background: dataType === dt.id ? `${dt.color}18` : T.bgCard, border: `1px solid ${dataType === dt.id ? dt.color + "55" : T.border}`, borderLeft: `4px solid ${dataType === dt.id ? dt.color : T.border}`, borderRadius: 9, padding: "13px 16px", cursor: "pointer", transition: "all .18s", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${dt.color}18`, border: `1px solid ${dt.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{dt.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: dataType === dt.id ? dt.color : T.txtPrim }}>{dt.label}</div>
                  <div style={{ fontSize: 10, color: T.txtTert, marginTop: 1 }}>Log {dt.label.toLowerCase()} manually</div>
                </div>
                {dataType === dt.id && <span style={{ color: dt.color, fontSize: 16, fontWeight: 700 }}>✓</span>}
              </div>
            ))}
          </div>

          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${activeType.color}18`, border: `1px solid ${activeType.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{activeType.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>Log {activeType.label}</div>
                <div style={{ fontSize: 10, color: T.txtTert }}>Fill in the fields below</div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 5 }}>Date</div>
              <input type="date" value={formVals.date} onChange={e => setFV("date", e.target.value)} />
            </div>
            {activeType.fields.map(({ k, l, t }) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 5 }}>{l}</div>
                <input type={t} placeholder={`Enter ${l.toLowerCase()}`} value={formVals[k] || ""} onChange={e => setFV(k, e.target.value)} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: T.txtSec, marginBottom: 5 }}>Notes (optional)</div>
              <input type="text" placeholder="Add notes…" value={formVals.notes} onChange={e => setFV("notes", e.target.value)} />
            </div>
            <button onClick={handleSave} disabled={saveStatus === "saving"} style={{ width: "100%", padding: "11px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: saveStatus === "saved" ? "#4db882" : activeType.color, color: "#fff", border: "none", cursor: saveStatus === "saving" ? "not-allowed" : "pointer", transition: "background .3s", fontFamily: "DM Sans", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saveStatus === "saving" ? 0.7 : 1 }}>
              {saveStatus === "saving" && <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite" }} />}
              {saveStatus === "saved" ? "✓ Saved!" : saveStatus === "saving" ? "Saving…" : `Save ${activeType.label}`}
            </button>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Recent Entries</div>
              {recentEntries.map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.border}44` }}>
                  <span style={{ fontSize: 11, color: T.txtSec }}>{e.label}</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: e.color, fontFamily: "DM Mono" }}>{e.val}</span>
                    <span style={{ fontSize: 9, color: T.txtTert }}>{e.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CSV IMPORT */}
      {activeTab === "csv" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleFileDrop}
            style={{ background: dragOver ? `${T.accent}10` : T.bgCard, border: `2px dashed ${dragOver ? T.accent : T.border}`, borderRadius: 12, padding: "48px 32px", textAlign: "center", transition: "all .2s", cursor: "pointer" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.txtPrim, marginBottom: 6 }}>Drop your CSV file here</div>
            <div style={{ fontSize: 12, color: T.txtSec, marginBottom: 18 }}>Supports weight logs, workout history, nutrition data · Max 10 MB</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              {["Weight Log", "Workout History", "Nutrition Data", "Sleep Data"].map(t => (
                <span key={t} style={{ fontSize: 10, background: `${T.accent}18`, color: T.accentLt, border: `1px solid ${T.accent}33`, borderRadius: 4, padding: "4px 10px", fontWeight: 500 }}>{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: T.txtTert, marginBottom: 12 }}>— or —</div>
            <label style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 7, padding: "10px 24px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans", display: "inline-block" }}>
              Browse Files
              <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => {
                const file = e.target.files?.[0];
                if (file) { const nf = { name: file.name, size: Math.round(file.size / 1024) + " KB", rows: Math.floor(Math.random() * 50 + 10), status: "success", date: "Just now", type: "Custom" }; setUploadedFiles(p => [nf, ...p]); }
              }} />
            </label>
          </div>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim, marginBottom: 12 }}>📥 Download CSV Templates</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { name: "Weight Log", cols: "date, weight_kg, body_fat_%, notes", color: "#5b7cf5", icon: "⚖️" },
                { name: "Workout", cols: "date, exercise, sets, reps, weight_kg, duration_min", color: "#e8a83a", icon: "🏋️" },
                { name: "Nutrition", cols: "date, meal, food_item, calories, protein_g, carbs_g, fat_g", color: "#4db882", icon: "🥗" },
                { name: "Sleep & Wellness", cols: "date, sleep_hrs, water_L, steps, mood", color: "#38b4b4", icon: "💧" },
              ].map(t => (
                <div key={t.name} style={{ background: T.bgInput, border: `1px solid ${t.color}33`, borderRadius: 8, padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.txtPrim }}>{t.name}</span>
                  </div>
                  <div style={{ fontSize: 9, color: T.txtTert, fontFamily: "DM Mono", lineHeight: 1.5, marginBottom: 8 }}>{t.cols}</div>
                  <div style={{ fontSize: 10, color: t.color, fontWeight: 600 }}>⬇ Download .csv</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {activeTab === "history" && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>Import History</div>
            <span style={{ fontSize: 10, background: `${T.accent}18`, color: T.accentLt, border: `1px solid ${T.accent}33`, borderRadius: 4, padding: "2px 8px", fontFamily: "DM Mono" }}>{uploadedFiles.length} imports</span>
          </div>
          {uploadedFiles.map((f, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "36px 1fr 70px 100px 70px", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${T.border}44`, alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 7, background: f.status === "success" ? "#4db88218" : "#e0555518", border: `1px solid ${f.status === "success" ? "#4db88244" : "#e0555544"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{TYPE_ICONS[f.type] || "📄"}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim }}>{f.name}</div>
                <div style={{ fontSize: 10, color: T.txtTert, marginTop: 2 }}>{f.rows} rows · {f.type}</div>
              </div>
              <div style={{ fontSize: 10, color: T.txtTert, fontFamily: "DM Mono" }}>{f.size}</div>
              <div style={{ fontSize: 10, color: T.txtTert }}>{f.date}</div>
              <span style={{ fontSize: 9, fontWeight: 700, color: f.status === "success" ? "#4db882" : "#e05555", background: f.status === "success" ? "#4db88218" : "#e0555518", border: `1px solid ${f.status === "success" ? "#4db88244" : "#e0555544"}`, borderRadius: 4, padding: "3px 8px", textAlign: "center" }}>{f.status === "success" ? "✓ OK" : "✕ FAIL"}</span>
            </div>
          ))}
        </div>
      )}

      {/* FORMAT GUIDE */}
      {activeTab === "format" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { title: "Weight Log", color: "#5b7cf5", icon: "⚖️", headers: ["date", "weight_kg", "body_fat_%", "notes"], sample: [["2026-01-30", "79.5", "18.2", "Morning fasted"], ["2026-01-23", "80.0", "18.5", "After gym"]] },
            { title: "Workout Log", color: "#e8a83a", icon: "🏋️", headers: ["date", "exercise", "sets", "reps", "weight_kg", "duration_min"], sample: [["2026-01-30", "Bench Press", "4", "8", "80", "60"], ["2026-01-30", "Squat", "4", "6", "100", "60"]] },
            { title: "Nutrition Log", color: "#4db882", icon: "🥗", headers: ["date", "meal", "food_item", "calories", "protein_g", "carbs_g", "fat_g"], sample: [["2026-01-30", "Lunch", "Chicken Breast", "220", "35", "0", "5"], ["2026-01-30", "Dinner", "Brown Rice", "165", "3", "34", "1"]] },
          ].map(fmt => (
            <div key={fmt.title} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: `${fmt.color}08` }}>
                <span style={{ fontSize: 16 }}>{fmt.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim }}>{fmt.title}</span>
                <span style={{ marginLeft: "auto", fontSize: 9, color: fmt.color, background: `${fmt.color}18`, border: `1px solid ${fmt.color}33`, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{fmt.headers.length} columns</span>
              </div>
              <div style={{ overflowX: "auto", padding: 14 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>{fmt.headers.map(h => <th key={h} style={{ textAlign: "left", padding: "6px 10px", background: T.bgInput, color: fmt.color, fontFamily: "DM Mono", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fmt.sample.map((row, ri) => (
                      <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={{ padding: "8px 10px", color: ci === 0 ? T.accentLt : T.txtSec, fontFamily: ci === 0 ? "DM Mono" : "DM Sans", fontSize: 11, borderBottom: `1px solid ${T.border}44` }}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   INTEGRATIONS PAGE
════════════════════════════════════════════ */
function IntegrationsPage({ T }) {
  const [connected, setConnected] = useState({ myfitnesspal: true, garmin: false, applehealth: true, googlefit: false, strava: false, fitbit: true, whoop: false, cronometer: false });
  const [connecting, setConnecting] = useState(null);
  const [apiVisible, setApiVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("apps");

  const handleToggle = (id) => {
    if (connecting) return;
    setConnecting(id);
    setTimeout(() => {
      setConnected(p => ({ ...p, [id]: !p[id] }));
      setConnecting(null);
    }, 900);
  };

  const APPS = [
    { id: "myfitnesspal", name: "MyFitnessPal", icon: "🥗", cat: "Nutrition", desc: "Sync food diary, macros and calorie logs", color: "#00b894", stats: "1,247 meals synced" },
    { id: "applehealth", name: "Apple Health", icon: "❤️", cat: "Health", desc: "Pull steps, heart rate, sleep and activity rings", color: "#ff6b6b", stats: "30 days of data" },
    { id: "fitbit", name: "Fitbit", icon: "⌚", cat: "Wearable", desc: "Real-time heart rate, steps and sleep stages", color: "#5b7cf5", stats: "14 days synced" },
    { id: "garmin", name: "Garmin Connect", icon: "🏃", cat: "Wearable", desc: "Advanced running metrics, VO2 max and training load", color: "#e8a83a", stats: "—" },
    { id: "strava", name: "Strava", icon: "🚴", cat: "Activity", desc: "Import runs, rides and workouts automatically", color: "#e07a35", stats: "—" },
    { id: "googlefit", name: "Google Fit", icon: "🟢", cat: "Health", desc: "Android health data, activity and heart points", color: "#38b4b4", stats: "—" },
    { id: "whoop", name: "WHOOP", icon: "💪", cat: "Recovery", desc: "Recovery score, strain and sleep performance", color: "#00d4aa", stats: "—" },
    { id: "cronometer", name: "Cronometer", icon: "📊", cat: "Nutrition", desc: "Micronutrient tracking and detailed food analysis", color: "#e8a83a", stats: "—" },
  ];

  const connectedCount = Object.values(connected).filter(Boolean).length;
  const TABS = [["apps", "📱 Apps"], ["activity", "📋 Sync Log"]];

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center 40%", height: 130 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#5b7cf5,#00d4aa)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#00d4aa", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>CONNECT</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 3 }}>Integrations</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Connect apps and wearables · <span style={{ color: "#00d4aa", fontWeight: 600 }}>{connectedCount} active</span></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["🔗", connectedCount + " Connected", "#5b7cf5"], ["🔄", "Auto-Sync", "#4db882"]].map(([ic, lb, cl]) => (
              <div key={lb} style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${cl}44`, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 13 }}>{ic}</div>
                <div style={{ fontSize: 9, color: cl, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap" }}>{lb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, background: T.bgCard, borderRadius: 8, padding: 4, marginBottom: 16, border: `1px solid ${T.border}` }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, fontSize: 11, fontWeight: activeTab === id ? 600 : 400, background: activeTab === id ? T.bgActive : "transparent", color: activeTab === id ? T.txtPrim : T.txtSec, border: `1px solid ${activeTab === id ? T.borderAct : "transparent"}`, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>{label}</button>
        ))}
      </div>

      {activeTab === "apps" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
            {[["Connected", connectedCount, "#00d4aa"], ["Available", APPS.length - connectedCount, "#8891a4"], ["Total Apps", APPS.length, "#5b7cf5"], ["Last Sync", "2 min ago", "#e8a83a"]].map(([l, v, c]) => (
              <div key={l} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1, marginBottom: 4 }}>{v}</div>
                <div style={{ fontSize: 10, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {APPS.map((app, i) => {
              const isOn = connected[app.id];
              const isBusy = connecting === app.id;
              return (
                <div key={app.id} style={{ background: T.bgCard, border: `1px solid ${isOn ? app.color + "55" : T.border}`, borderRadius: 10, padding: "18px 20px", position: "relative", overflow: "hidden", animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
                  {isOn && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: app.color, borderRadius: "10px 10px 0 0" }} />}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${app.color}22`, border: `1px solid ${app.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{app.icon}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>{app.name}</div>
                        <div style={{ fontSize: 9, color: app.color, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginTop: 1 }}>{app.cat}</div>
                      </div>
                    </div>
                    <button onClick={() => handleToggle(app.id)} disabled={isBusy} style={{ width: 44, height: 24, borderRadius: 12, background: isBusy ? "#555" : isOn ? app.color : "#444", position: "relative", cursor: "pointer", border: "none", transition: "background .25s", flexShrink: 0, boxShadow: isOn ? `0 0 10px ${app.color}44` : "none" }}>
                      {isBusy
                        ? <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "block", animation: "spin .6s linear infinite" }} />
                        : <span style={{ position: "absolute", top: 3, left: isOn ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", display: "block" }} />
                      }
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: T.txtTert, lineHeight: 1.6, marginBottom: 8 }}>{app.desc}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: isOn ? app.color : T.txtTert, fontFamily: "DM Mono" }}>{isOn ? app.stats : "Not connected"}</span>
                    {isOn && <span style={{ fontSize: 9, background: `${app.color}18`, color: app.color, border: `1px solid ${app.color}33`, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>LIVE</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "api" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim, marginBottom: 3 }}>API Keys</div>
                <div style={{ fontSize: 11, color: T.txtSec }}>Use these keys to connect AdaptFit with external services</div>
              </div>
              <button onClick={() => setApiVisible(v => !v)} style={{ background: `${T.accent}18`, border: `1px solid ${T.accent}44`, color: T.accentLt, padding: "7px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>
                {apiVisible ? "🙈 Hide Keys" : "👁 Reveal Keys"}
              </button>
            </div>
            {[
              { name: "Production API Key", key: "af_live_sk_4xK9mN2pQ8rT7vY3wZ6", scope: "Full Access", created: "Jan 15, 2026", last: "2 min ago" },
              { name: "Webhook Secret", key: "whsec_8mK3nP6qR9sU2wX5yB1", scope: "Webhooks Only", created: "Dec 3, 2025", last: "1 hour ago" },
              { name: "Read-Only Key", key: "af_ro_sk_7jL4mO1pR6tV9wZ2aQ8", scope: "Read Only", created: "Nov 20, 2025", last: "3 days ago" },
            ].map((k, i) => (
              <div key={i} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim }}>{k.name}</div>
                  <span style={{ fontSize: 9, background: `${T.accent}18`, color: T.accentLt, border: `1px solid ${T.accent}33`, borderRadius: 4, padding: "2px 8px", fontFamily: "DM Mono" }}>{k.scope}</span>
                </div>
                <div style={{ fontFamily: "DM Mono", fontSize: 11, color: T.txtSec, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", letterSpacing: ".06em", marginBottom: 8, wordBreak: "break-all" }}>
                  {apiVisible ? k.key : "•".repeat(28)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.txtTert }}>
                  <span>Created: {k.created}</span><span>Last used: {k.last}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim, marginBottom: 14 }}>Rate Limits & Usage</div>
            {[["API Calls Today", 847, 10000, "#5b7cf5"], ["Webhook Events / hr", 23, 500, "#00d4aa"], ["Data Sync / day", 4, 50, "#e8a83a"]].map(([l, u, lim, c]) => (
              <div key={l} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: T.txtSec }}>{l}</span>
                  <span style={{ fontSize: 11, color: c, fontFamily: "DM Mono", fontWeight: 600 }}>{u.toLocaleString()} / {lim.toLocaleString()}</span>
                </div>
                <div style={{ height: 6, background: T.bgInput, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(u / lim * 100).toFixed(1)}%`, background: `linear-gradient(90deg,${c},${c}88)`, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {activeTab === "activity" && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>Recent Sync Events</div>
            <span style={{ fontSize: 10, background: "#00d4aa18", color: "#00d4aa", border: "1px solid #00d4aa33", borderRadius: 4, padding: "2px 8px" }}>Live</span>
          </div>
          {[
            { time: "2 min ago", app: "Apple Health", event: "Steps synced", detail: "8,432 steps · 4.2 km", ok: true, icon: "❤️" },
            { time: "2 min ago", app: "Fitbit", event: "Sleep data pulled", detail: "7h 14m · sleep score 92", ok: true, icon: "⌚" },
            { time: "15 min ago", app: "MyFitnessPal", event: "Food diary synced", detail: "Lunch logged · 620 kcal", ok: true, icon: "🥗" },
            { time: "1 hr ago", app: "Apple Health", event: "Heart rate synced", detail: "Avg 68 bpm · Peak 142 bpm", ok: true, icon: "❤️" },
            { time: "3 hrs ago", app: "Fitbit", event: "Workout detected", detail: "32 min cardio · 285 kcal", ok: true, icon: "⌚" },
            { time: "6 hrs ago", app: "MyFitnessPal", event: "Breakfast synced", detail: "Oats + protein shake · 480 kcal", ok: true, icon: "🥗" },
            { time: "Yesterday", app: "Garmin", event: "Sync failed", detail: "Authentication expired — reconnect", ok: false, icon: "🏃" },
          ].map((ev, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 22px 1fr 70px", gap: 12, alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${T.border}44` }}>
              <div style={{ fontSize: 10, color: T.txtTert, fontFamily: "DM Mono" }}>{ev.time}</div>
              <div style={{ fontSize: 15 }}>{ev.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: T.txtPrim, fontWeight: 500 }}>{ev.app} <span style={{ color: T.txtTert, fontWeight: 400 }}>· {ev.event}</span></div>
                <div style={{ fontSize: 10, color: T.txtTert, marginTop: 2 }}>{ev.detail}</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: ev.ok ? "#00d4aa" : "#e05555", background: ev.ok ? "#00d4aa18" : "#e0555518", border: `1px solid ${ev.ok ? "#00d4aa44" : "#e0555544"}`, borderRadius: 4, padding: "2px 7px", textAlign: "center" }}>{ev.ok ? "✓ OK" : "✕ FAIL"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   AUDIT TRAILS PAGE
════════════════════════════════════════════ */
function AuditTrailsPage({ T }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const LOGS = [
    { id: "A001", time: "Today, 14:32", user: "Rahul Sharma", action: "Weight Updated", detail: "80kg → 79.2kg · BMI recalculated to 25.9", type: "update", severity: "info", ip: "192.168.1.1" },
    { id: "A002", time: "Today, 14:33", user: "System", action: "Diet Plan Regenerated", detail: "Auto-triggered after weight update · 4 meals recalculated", type: "auto", severity: "info", ip: "system" },
    { id: "A003", time: "Today, 11:15", user: "Rahul Sharma", action: "Workout Completed", detail: "Back day logged · 5 exercises · 1h 12m duration", type: "workout", severity: "info", ip: "192.168.1.1" },
    { id: "A004", time: "Today, 08:02", user: "Rahul Sharma", action: "Login", detail: "Successful login from Chrome · Mumbai, IN", type: "auth", severity: "info", ip: "103.24.18.9" },
    { id: "A005", time: "Yesterday, 19:44", user: "Rahul Sharma", action: "Goal Changed", detail: "Fat Loss → Muscle Gain · Calorie target adjusted +800 kcal", type: "update", severity: "warning", ip: "192.168.1.1" },
    { id: "A006", time: "Yesterday, 19:45", user: "System", action: "Plan Recalibrated", detail: "Goal change triggered full plan regeneration", type: "auto", severity: "info", ip: "system" },
    { id: "A007", time: "Yesterday, 13:20", user: "Rahul Sharma", action: "Food Swap", detail: "Chicken Breast replaced with Tuna · Lunch Meal", type: "update", severity: "info", ip: "192.168.1.1" },
    { id: "A008", time: "Jan 28, 09:11", user: "Rahul Sharma", action: "Failed Login Attempt", detail: "Wrong password · 2 attempts · Account not locked", type: "auth", severity: "warning", ip: "41.203.72.14" },
    { id: "A009", time: "Jan 27, 16:55", user: "Rahul Sharma", action: "Integration Connected", detail: "Apple Health linked · Permissions granted", type: "integration", severity: "info", ip: "192.168.1.1" },
    { id: "A010", time: "Jan 27, 16:56", user: "System", action: "Sync Completed", detail: "Apple Health · 30 days of historical data imported", type: "auto", severity: "info", ip: "system" },
    { id: "A011", time: "Jan 26, 10:30", user: "Rahul Sharma", action: "Profile Updated", detail: "Height changed 173cm → 175cm · Metrics recalculated", type: "update", severity: "info", ip: "192.168.1.1" },
    { id: "A012", time: "Jan 25, 21:00", user: "System", action: "Monthly Recalibration Due", detail: "30 days since last weight update · Notification sent", type: "auto", severity: "warning", ip: "system" },
  ];

  const typeColor = { update: "#5b7cf5", auto: "#00d4aa", auth: "#e8a83a", workout: "#4db882", integration: "#38b4b4" };
  const sevColor = { info: T.txtTert, warning: "#e8a83a", error: "#e05555" };
  const FILTER_TYPES = ["all", "update", "auto", "auth", "workout", "integration"];
  const counts = FILTER_TYPES.reduce((a, t) => ({ ...a, [t]: t === "all" ? LOGS.length : LOGS.filter(l => l.type === t).length }), {});

  const filtered = LOGS.filter(l => {
    if (filter !== "all" && l.type !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return [l.action, l.detail, l.user, l.type].some(s => s.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center 40%", height: 130 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#5b7cf5,#00d4aa)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#5b7cf5", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>COMPLIANCE</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 3 }}>Audit Trails</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Complete activity log · <span style={{ color: "#00d4aa", fontWeight: 600 }}>{LOGS.length} events recorded</span></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["📋", LOGS.length + " Events", "#5b7cf5"], ["⚠️", LOGS.filter(l => l.severity === "warning").length + " Warnings", "#e8a83a"], ["🔐", LOGS.filter(l => l.type === "auth").length + " Auth", "#4db882"]].map(([ic, lb, cl]) => (
              <div key={lb} style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${cl}44`, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 14 }}>{ic}</div>
                <div style={{ fontSize: 9, color: cl, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap" }}>{lb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
        {[["Total", LOGS.length, "#5b7cf5"], ["Auto Actions", counts.auto, "#00d4aa"], ["User Actions", counts.update + counts.workout, "#4db882"], ["Auth Events", counts.auth, "#e8a83a"], ["Warnings", LOGS.filter(l => l.severity === "warning").length, "#e07a35"]].map(([l, v, c]) => (
          <div key={l} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1, marginBottom: 3 }}>{v}</div>
            <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: 3, gap: 2, flexWrap: "wrap" }}>
          {FILTER_TYPES.map(id => (
            <button key={id} onClick={() => setFilter(id)} style={{ padding: "6px 10px", borderRadius: 5, fontSize: 10, fontWeight: filter === id ? 600 : 400, background: filter === id ? T.bgActive : "transparent", color: filter === id ? T.txtPrim : T.txtSec, border: `1px solid ${filter === id ? T.borderAct : "transparent"}`, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s", whiteSpace: "nowrap" }}>
              {id.charAt(0).toUpperCase() + id.slice(1)} ({counts[id]})
            </button>
          ))}
        </div>
        <input placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, background: T.bgInput, border: `1px solid ${T.border}`, color: T.txtPrim, borderRadius: 7, padding: "8px 12px", fontSize: 11, outline: "none" }} />
      </div>

      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "68px 10px 1fr 90px 110px", gap: 10, padding: "10px 18px", borderBottom: `1px solid ${T.border}`, fontSize: 9, fontWeight: 600, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".07em" }}>
          <div>ID</div><div></div><div>Action / Detail</div><div style={{ textAlign: "center" }}>Type</div><div style={{ textAlign: "right" }}>Time</div>
        </div>
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0", color: T.txtTert, fontSize: 12 }}>No events match your filter</div>
          : filtered.map((log) => (
            <div key={log.id} style={{ display: "grid", gridTemplateColumns: "68px 10px 1fr 90px 110px", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${T.border}44`, alignItems: "center" }}>
              <div style={{ fontFamily: "DM Mono", fontSize: 9, color: T.txtTert }}>{log.id}</div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: sevColor[log.severity], boxShadow: log.severity !== "info" ? `0 0 5px ${sevColor[log.severity]}` : "none" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim, marginBottom: 2 }}>{log.action}</div>
                <div style={{ fontSize: 10, color: T.txtTert, lineHeight: 1.4 }}>{log.detail}</div>
                <div style={{ fontSize: 9, color: T.txtTert, marginTop: 2, fontFamily: "DM Mono" }}>by {log.user} · {log.ip}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: typeColor[log.type], background: `${typeColor[log.type]}22`, border: `1px solid ${typeColor[log.type]}44`, borderRadius: 4, padding: "3px 7px", textTransform: "uppercase" }}>{log.type}</span>
              </div>
              <div style={{ fontSize: 10, color: T.txtTert, textAlign: "right", fontFamily: "DM Mono" }}>{log.time}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   VENDOR RISK PAGE
════════════════════════════════════════════ */
function VendorRiskPage({ T }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedId, setSelectedId] = useState(null);

  const VENDORS = [
    {
      id: "V001", name: "GymFuel Nutrition", cat: "Supplements", risk: "HIGH", score: 72, issues: 4, spend: "₹18,200/mo", compliance: 58, lastAudit: "Jan 20, 2026", trend: "up", icon: "💊",
      issues_list: ["Undisclosed allergens in 2 products", "Expiry date discrepancy batch #GF2201", "Missing FSSAI certification renewal", "Delivery SLA breach (3×)"]
    },
    {
      id: "V002", name: "IronClad Equipment", cat: "Equipment", risk: "MEDIUM", score: 54, issues: 2, spend: "₹42,500/mo", compliance: 74, lastAudit: "Jan 15, 2026", trend: "down", icon: "🏋️",
      issues_list: ["Warranty claim response >14 days", "Product spec mismatch on 2 SKUs"]
    },
    {
      id: "V003", name: "FlexWear Apparel", cat: "Apparel", risk: "LOW", score: 22, issues: 0, spend: "₹9,800/mo", compliance: 95, lastAudit: "Jan 25, 2026", trend: "stable", icon: "👕",
      issues_list: []
    },
    {
      id: "V004", name: "RecoveryTech Labs", cat: "Recovery", risk: "CRITICAL", score: 88, issues: 6, spend: "₹31,000/mo", compliance: 41, lastAudit: "Dec 10, 2025", trend: "up", icon: "💆",
      issues_list: ["3 products in market recall", "FDA warning letter unresolved", "Forged quality certifications", "Financial instability — credit downgrade", "2 unresolved injury claims", "Audit access denied Q4 2025"]
    },
    {
      id: "V005", name: "HydroSports Drinks", cat: "Nutrition", risk: "MEDIUM", score: 48, issues: 1, spend: "₹14,600/mo", compliance: 81, lastAudit: "Jan 18, 2026", trend: "stable", icon: "🥤",
      issues_list: ["Sugar content labelling inaccuracy"]
    },
    {
      id: "V006", name: "ProTech Wearables", cat: "Technology", risk: "LOW", score: 18, issues: 0, spend: "₹27,300/mo", compliance: 97, lastAudit: "Jan 22, 2026", trend: "stable", icon: "📱",
      issues_list: []
    },
  ];

  const riskColor = { CRITICAL: "#e05555", HIGH: "#e8a83a", MEDIUM: "#e07a35", LOW: "#4db882" };
  const trendIcon = { up: "↑", down: "↓", stable: "→" };
  const trendColor = { up: "#e05555", down: "#4db882", stable: T.txtTert };
  const totals = { critical: VENDORS.filter(v => v.risk === "CRITICAL").length, high: VENDORS.filter(v => v.risk === "HIGH").length, medium: VENDORS.filter(v => v.risk === "MEDIUM").length, low: VENDORS.filter(v => v.risk === "LOW").length };
  const selected = VENDORS.find(v => v.id === selectedId) || null;
  const TABS = [["overview", "📊 Overview"], ["vendors", "🏢 Vendors"], ["issues", "⚠️ Issues"], ["compliance", "✅ Compliance"]];

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center 35%", height: 130 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#e8a83a,#e05555)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#e8a83a", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>RISK MANAGEMENT</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 3 }}>Vendor Risk</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Monitor supplier health · <span style={{ color: "#e05555", fontWeight: 600 }}>{totals.critical} critical</span> · <span style={{ color: "#e8a83a", fontWeight: 600 }}>{totals.high} high</span></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["🔴", totals.critical + " Critical", "#e05555"], ["🟠", totals.high + " High", "#e8a83a"], ["🟡", totals.medium + " Medium", "#e07a35"], ["🟢", totals.low + " Low", "#4db882"]].map(([ic, lb, cl]) => (
              <div key={lb} style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${cl}44`, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 13 }}>{ic}</div>
                <div style={{ fontSize: 9, color: cl, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap" }}>{lb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, background: T.bgCard, borderRadius: 8, padding: 4, marginBottom: 16, border: `1px solid ${T.border}` }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => { setActiveTab(id); setSelectedId(null); }} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, fontSize: 11, fontWeight: activeTab === id ? 600 : 400, background: activeTab === id ? T.bgActive : "transparent", color: activeTab === id ? T.txtPrim : T.txtSec, border: `1px solid ${activeTab === id ? T.borderAct : "transparent"}`, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>{label}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
            {[["Critical", totals.critical, "#e05555"], ["High Risk", totals.high, "#e8a83a"], ["Medium", totals.medium, "#e07a35"], ["Low Risk", totals.low, "#4db882"]].map(([l, v, c]) => (
              <div key={l} style={{ background: T.bgCard, border: `1px solid ${c}44`, borderTop: `3px solid ${c}`, borderRadius: 8, padding: "16px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1, marginBottom: 4 }}>{v}</div>
                <div style={{ fontSize: 10, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".07em" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim, marginBottom: 16 }}>Vendor Risk Scores</div>
            {[...VENDORS].sort((a, b) => b.score - a.score).map(v => (
              <div key={v.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{v.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.txtPrim }}>{v.name}</span>
                    <span style={{ fontSize: 10, color: T.txtTert }}>{v.cat}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: trendColor[v.trend] }}>{trendIcon[v.trend]}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: riskColor[v.risk], fontFamily: "DM Mono" }}>{v.score}/100</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: riskColor[v.risk], background: `${riskColor[v.risk]}18`, border: `1px solid ${riskColor[v.risk]}44`, borderRadius: 4, padding: "2px 8px" }}>{v.risk}</span>
                  </div>
                </div>
                <div style={{ height: 7, background: T.bgInput, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${v.score}%`, background: `linear-gradient(90deg,${riskColor[v.risk]},${riskColor[v.risk]}88)`, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim, marginBottom: 14 }}>Spend vs Risk Exposure</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[["Total Monthly", "₹1,43,400", "#5b7cf5"], ["At-Risk Spend", "₹49,200", "#e05555"], ["Compliant Spend", "₹94,200", "#4db882"]].map(([l, v, c]) => (
                <div key={l} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c, marginBottom: 4 }}>{v}</div>
                  <div style={{ fontSize: 10, color: T.txtTert }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "vendors" && (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 12 }}>
          <div>
            {VENDORS.map((v, i) => (
              <div key={v.id} onClick={() => setSelectedId(selectedId === v.id ? null : v.id)}
                style={{ background: selectedId === v.id ? T.bgActive : T.bgCard, border: `1px solid ${selectedId === v.id ? T.borderAct : T.border}`, borderLeft: `4px solid ${riskColor[v.risk]}`, borderRadius: 10, padding: "16px 18px", cursor: "pointer", marginBottom: 8, transition: "all .15s", animation: `fadeUp .3s ease ${i * 0.05}s both` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: `${riskColor[v.risk]}18`, border: `1px solid ${riskColor[v.risk]}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{v.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>{v.name}</div>
                      <div style={{ fontSize: 10, color: T.txtTert, marginTop: 2 }}>{v.cat} · {v.spend} · Audit: {v.lastAudit}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {v.issues > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#e05555", background: "#e0555518", border: "1px solid #e0555544", borderRadius: 4, padding: "2px 8px" }}>{v.issues} issues</span>}
                    <span style={{ fontSize: 10, fontWeight: 700, color: riskColor[v.risk], background: `${riskColor[v.risk]}18`, border: `1px solid ${riskColor[v.risk]}44`, borderRadius: 4, padding: "3px 10px" }}>{v.risk}</span>
                    <span style={{ color: T.txtTert, fontSize: 11 }}>{selectedId === v.id ? "▲" : "▼"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selected && (
            <div style={{ background: T.bgCard, border: `1px solid ${riskColor[selected.risk]}44`, borderRadius: 10, padding: 20, alignSelf: "start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${riskColor[selected.risk]}18`, border: `1px solid ${riskColor[selected.risk]}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{selected.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.txtPrim }}>{selected.name}</div>
                  <div style={{ fontSize: 10, color: T.txtTert }}>{selected.id} · {selected.cat}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[["Risk Score", selected.score + "/100", riskColor[selected.risk]], ["Risk Level", selected.risk, riskColor[selected.risk]], ["Compliance", selected.compliance + "%", selected.compliance > 80 ? "#4db882" : selected.compliance > 60 ? "#e8a83a" : "#e05555"], ["Monthly Spend", selected.spend, "#5b7cf5"], ["Open Issues", selected.issues, selected.issues > 0 ? "#e05555" : "#4db882"], ["Last Audit", selected.lastAudit, T.txtSec]].map(([l, v, c]) => (
                  <div key={l} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 7, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              {selected.issues_list.length > 0
                ? selected.issues_list.map((iss, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", background: "#e0555510", border: "1px solid #e0555530", borderRadius: 6, marginBottom: 6, fontSize: 11, color: T.txtSec }}>
                    <span style={{ color: "#e05555", flexShrink: 0 }}>●</span>{iss}
                  </div>
                ))
                : <div style={{ textAlign: "center", padding: "16px 0", color: "#4db882", fontSize: 12, fontWeight: 500 }}>✓ No open issues</div>
              }
            </div>
          )}
        </div>
      )}

      {activeTab === "issues" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {VENDORS.flatMap(v => v.issues_list.map((iss, i) => ({ vendor: v.name, icon: v.icon, risk: v.risk, iss, key: `${v.id}-${i}` }))).map((item, i) => (
            <div key={item.key} style={{ background: T.bgCard, border: `1px solid ${riskColor[item.risk]}33`, borderLeft: `4px solid ${riskColor[item.risk]}`, borderRadius: 8, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, animation: `fadeUp .3s ease ${i * 0.04}s both` }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${riskColor[item.risk]}18`, border: `1px solid ${riskColor[item.risk]}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim, marginBottom: 3 }}>{item.iss}</div>
                <div style={{ fontSize: 10, color: T.txtTert }}>Vendor: <span style={{ color: T.txtSec }}>{item.vendor}</span></div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: riskColor[item.risk], background: `${riskColor[item.risk]}18`, border: `1px solid ${riskColor[item.risk]}44`, borderRadius: 4, padding: "3px 10px", flexShrink: 0 }}>{item.risk}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "compliance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim, marginBottom: 16 }}>Compliance Scores</div>
            {[...VENDORS].sort((a, b) => a.compliance - b.compliance).map(v => {
              const c = v.compliance > 80 ? "#4db882" : v.compliance > 60 ? "#e8a83a" : "#e05555";
              return (
                <div key={v.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.txtPrim }}>{v.icon} {v.name} <span style={{ color: T.txtTert, fontSize: 10 }}>· {v.cat}</span></span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c, fontFamily: "DM Mono" }}>{v.compliance}%</span>
                  </div>
                  <div style={{ height: 8, background: T.bgInput, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${v.compliance}%`, background: `linear-gradient(90deg,${c},${c}aa)`, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim, marginBottom: 14 }}>Compliance Checklist</div>
            {[
              ["FSSAI Certification", "All nutrition vendors", true],
              ["Quality Audit Passed", "Annual requirement", true],
              ["SLA Agreement Signed", "All active vendors", true],
              ["Financial Health Review", "Quarterly", false],
              ["Insurance Verification", "Annual", false],
              ["RecoveryTech FDA Response", "Critical · Overdue", false],
            ].map(([req, note, done]) => (
              <div key={req} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.border}44` }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: done ? "#4db88222" : "#e0555518", border: `1px solid ${done ? "#4db88244" : "#e0555544"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: done ? "#4db882" : "#e05555" }}>{done ? "✓" : "✕"}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim }}>{req}</div>
                  <div style={{ fontSize: 10, color: T.txtTert, marginTop: 1 }}>{note}</div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: done ? "#4db882" : "#e05555", background: done ? "#4db88218" : "#e0555518", border: `1px solid ${done ? "#4db88244" : "#e0555544"}`, borderRadius: 4, padding: "2px 8px" }}>{done ? "DONE" : "PENDING"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   LEADERBOARD PAGE
════════════════════════════════════════════ */
function LeaderboardPage({ user, leaderboard, T }) {
  const [filter, setFilter] = useState("overall");
  const [hoverId, setHoverId] = useState(null);

  const COMMUNITY = [
    { id: 2, name: "Priya Mehta", avatar: "🧘", city: "Delhi", goal: "Fat Loss", workoutStreak: 63, dietStreak: 61, totalDays: 65, workoutDone: 63, dietDone: 61 },
    { id: 3, name: "Arjun Singh", avatar: "🏃", city: "Bangalore", goal: "Endurance", workoutStreak: 38, dietStreak: 32, totalDays: 42, workoutDone: 38, dietDone: 32 },
    { id: 4, name: "Sneha Kapoor", avatar: "🤸", city: "Pune", goal: "Fat Loss", workoutStreak: 29, dietStreak: 29, totalDays: 31, workoutDone: 29, dietDone: 29 },
    { id: 5, name: "Vikram Nair", avatar: "🏋️", city: "Chennai", goal: "Muscle Gain", workoutStreak: 22, dietStreak: 18, totalDays: 28, workoutDone: 22, dietDone: 18 },
    { id: 6, name: "Ananya Iyer", avatar: "🧗", city: "Hyderabad", goal: "Flexibility", workoutStreak: 19, dietStreak: 21, totalDays: 24, workoutDone: 19, dietDone: 21 },
    { id: 7, name: "Rohan Das", avatar: "🚴", city: "Kolkata", goal: "Endurance", workoutStreak: 14, dietStreak: 12, totalDays: 18, workoutDone: 14, dietDone: 12 },
    { id: 8, name: "Kavya Reddy", avatar: "🤾", city: "Ahmedabad", goal: "Fat Loss", workoutStreak: 11, dietStreak: 13, totalDays: 16, workoutDone: 11, dietDone: 13 },
    { id: 9, name: "Manish Joshi", avatar: "🤼", city: "Surat", goal: "Muscle Gain", workoutStreak: 8, dietStreak: 6, totalDays: 12, workoutDone: 8, dietDone: 6 },
    { id: 10, name: "Deepa Verma", avatar: "🏊", city: "Jaipur", goal: "Endurance", workoutStreak: 5, dietStreak: 7, totalDays: 10, workoutDone: 5, dietDone: 7 },
  ];

  const myWS = leaderboard?.workoutStreak || 0;
  const myDS = leaderboard?.dietStreak || 0;
  const myTotal = leaderboard?.totalDays || 0;
  const myTier = myWS >= 47 ? "Diamond" : myWS >= 25 ? "Gold" : myWS >= 15 ? "Silver" : "Bronze";
  const myBadge = myWS >= 47 ? "👑" : myWS >= 25 ? "🥇" : myWS >= 15 ? "🥈" : "🥉";
  const ME = { id: 1, name: user?.name || "You", avatar: "💪", city: user?.city || "—", goal: user?.goal || "—", workoutStreak: myWS, dietStreak: myDS, totalDays: myTotal, workoutDone: myWS, dietDone: myDS };

  const tierOf = (ws) => ws >= 47 ? "Diamond" : ws >= 25 ? "Gold" : ws >= 15 ? "Silver" : "Bronze";
  const badgeOf = (ws) => ws >= 47 ? "👑" : ws >= 25 ? "🥇" : ws >= 15 ? "🥈" : "🥉";
  const tierColor = { Diamond: "#00d4aa", Gold: "#e8a83a", Silver: "#b0b8c8", Bronze: "#cd7f32" };
  const tierBg = { Diamond: "#00d4aa18", Gold: "#e8a83a18", Silver: "#b0b8c818", Bronze: "#cd7f3218" };
  const rankMedal = ["🥇", "🥈", "🥉"];

  const ALL = [ME, ...COMMUNITY].map(u => ({
    ...u,
    tier: tierOf(u.workoutStreak), badge: badgeOf(u.workoutStreak),
    overallStreak: Math.round((u.workoutStreak + u.dietStreak) / 2),
    compliance: u.totalDays > 0 ? Math.round(((u.workoutDone + u.dietDone) / (u.totalDays * 2)) * 100) : 0,
    perfectDays: Math.min(u.workoutDone, u.dietDone),
  }));

  const sorted = [...ALL].sort((a, b) => {
    if (filter === "workout") return b.workoutStreak - a.workoutStreak;
    if (filter === "diet") return b.dietStreak - a.dietStreak;
    if (filter === "perfect") return b.perfectDays - a.perfectDays;
    return b.overallStreak - a.overallStreak;
  });

  const myRank = sorted.findIndex(u => u.id === 1) + 1;
  const topThree = sorted.slice(0, 3);
  const sv = (u) => filter === "workout" ? { v: u.workoutStreak + "d", l: "Workout" } : filter === "diet" ? { v: u.dietStreak + "d", l: "Diet" } : filter === "perfect" ? { v: u.perfectDays + "d", l: "Perfect" } : { v: u.overallStreak + "d", l: "Overall" };

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center 30%", height: 140 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#e8a83a,#00d4aa)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#e8a83a", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>COMMUNITY</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 4 }}>🏆 Leaderboard</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Streak rankings · <span style={{ color: "#00d4aa", fontWeight: 600 }}>{ALL.length} members</span> · Updated daily</div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "14px 20px", textAlign: "center", minWidth: 120 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Your Rank</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#e8a83a", lineHeight: 1 }}>#{myRank}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{ME.overallStreak}d streak · {myTier}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, background: T.bgCard, borderRadius: 8, padding: 4, marginBottom: 20, border: `1px solid ${T.border}` }}>
        {[["overall", "🏆 Overall"], ["workout", "🏋️ Workout"], ["diet", "🥗 Diet"], ["perfect", "⭐ Perfect Days"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, fontSize: 11, fontWeight: filter === id ? 600 : 400, background: filter === id ? T.bgActive : "transparent", color: filter === id ? T.txtPrim : T.txtSec, border: `1px solid ${filter === id ? T.borderAct : "transparent"}`, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 10, marginBottom: 20, alignItems: "flex-end" }}>
        {[topThree[1], topThree[0], topThree[2]].map((u, i) => {
          if (!u) return <div key={i} />;
          const pr = [2, 1, 3][i]; const ht = ["160px", "190px", "145px"];
          const isMe = u.id === 1;
          return (
            <div key={u.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: `fadeUp .5s ease ${i * 0.1}s both` }}>
              {pr === 1 && <div style={{ fontSize: 24, marginBottom: 4, animation: "floatUp 3s ease-in-out infinite" }}>👑</div>}
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg,${tierColor[u.tier]},${tierColor[u.tier]}88)`, border: `3px solid ${tierColor[u.tier]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 8, boxShadow: `0 0 20px ${tierColor[u.tier]}55`, position: "relative" }}>
                {u.avatar}
                {isMe && <div style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: "#5b7cf5", border: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>ME</div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.txtPrim, marginBottom: 2, textAlign: "center" }}>{u.name.split(" ")[0]}</div>
              <div style={{ fontSize: 9, color: T.txtTert, marginBottom: 8 }}>{u.city}</div>
              <div style={{ width: "100%", height: ht[i], background: `linear-gradient(180deg,${tierColor[u.tier]}33,${tierColor[u.tier]}11)`, border: `1px solid ${tierColor[u.tier]}55`, borderRadius: "8px 8px 0 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <div style={{ fontSize: 24 }}>{rankMedal[pr - 1]}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: tierColor[u.tier] }}>{sv(u).v}</div>
                <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em" }}>{sv(u).l}</div>
                <span style={{ fontSize: 9, background: `${tierColor[u.tier]}22`, color: tierColor[u.tier], border: `1px solid ${tierColor[u.tier]}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 600, marginTop: 2 }}>{u.tier}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[["Your Rank", "#" + myRank, "of " + ALL.length, "#e8a83a"], ["Your Streak", ME.overallStreak + "d", myTier + " tier", "#5b7cf5"], ["Workout Streak", ME.workoutStreak + "d", "consecutive days", "#4db882"], ["Diet Streak", ME.dietStreak + "d", "consecutive days", "#00d4aa"]].map(([l, v, sub, c]) => (
          <div key={l} style={{ background: T.bgCard, border: `1px solid ${c}33`, borderTop: `2px solid ${c}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1, marginBottom: 3 }}>{v}</div>
            <div style={{ fontSize: 9, color: T.txtTert, marginBottom: 2 }}>{sub}</div>
            <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 90px 90px 90px 80px 72px", gap: 10, padding: "10px 18px", borderBottom: `1px solid ${T.border}`, fontSize: 9, fontWeight: 700, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".07em" }}>
          <div>#</div><div>Member</div><div style={{ textAlign: "center" }}>Workout</div><div style={{ textAlign: "center" }}>Diet</div><div style={{ textAlign: "center" }}>Perfect</div><div style={{ textAlign: "center" }}>Compliance</div><div style={{ textAlign: "center" }}>Tier</div>
        </div>
        {sorted.map((u, i) => {
          const isMe = u.id === 1;
          return (
            <div key={u.id} onMouseEnter={() => setHoverId(u.id)} onMouseLeave={() => setHoverId(null)}
              style={{ display: "grid", gridTemplateColumns: "44px 1fr 90px 90px 90px 80px 72px", gap: 10, padding: "13px 18px", borderBottom: `1px solid ${T.border}44`, alignItems: "center", background: isMe ? `${T.accent}10` : hoverId === u.id ? T.bgInput : "transparent", borderLeft: isMe ? `3px solid ${T.accent}` : "3px solid transparent", transition: "background .15s" }}>
              <div style={{ fontSize: i < 3 ? 18 : 12, textAlign: "center" }}>{i < 3 ? rankMedal[i] : <span style={{ fontWeight: 700, color: T.txtTert }}>#{i + 1}</span>}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${tierColor[u.tier]}44,${tierColor[u.tier]}22)`, border: `2px solid ${tierColor[u.tier]}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{u.avatar}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim, display: "flex", alignItems: "center", gap: 6 }}>
                    {u.name}{isMe && <span style={{ fontSize: 9, background: `${T.accent}22`, color: T.accentLt, border: `1px solid ${T.accent}44`, borderRadius: 4, padding: "1px 6px" }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: 10, color: T.txtTert, marginTop: 1 }}>{u.city} · {u.goal}</div>
                </div>
              </div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 700, color: filter === "workout" ? "#5b7cf5" : T.txtPrim }}>{u.workoutStreak}d</div><div style={{ fontSize: 8, color: T.txtTert }}>streak</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 700, color: filter === "diet" ? "#4db882" : T.txtPrim }}>{u.dietStreak}d</div><div style={{ fontSize: 8, color: T.txtTert }}>streak</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 700, color: filter === "perfect" ? "#e8a83a" : T.txtPrim }}>{u.perfectDays}d</div><div style={{ fontSize: 8, color: T.txtTert }}>both done</div></div>
              <div><div style={{ fontSize: 10, fontWeight: 600, color: u.compliance >= 90 ? "#4db882" : u.compliance >= 70 ? "#e8a83a" : "#e05555", textAlign: "center", marginBottom: 3 }}>{u.compliance}%</div><div style={{ height: 4, background: T.bgInput, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${u.compliance}%`, background: u.compliance >= 90 ? "#4db882" : u.compliance >= 70 ? "#e8a83a" : "#e05555", borderRadius: 2 }} /></div></div>
              <div style={{ textAlign: "center" }}><span style={{ fontSize: 9, fontWeight: 700, color: tierColor[u.tier], background: tierBg[u.tier], border: `1px solid ${tierColor[u.tier]}44`, borderRadius: 5, padding: "3px 8px", display: "inline-block" }}>{u.badge} {u.tier}</span></div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        {[["👑 Diamond", "47+ days", "#00d4aa"], ["🥇 Gold", "25–46 days", "#e8a83a"], ["🥈 Silver", "15–24 days", "#b0b8c8"], ["🥉 Bronze", "1–14 days", "#cd7f32"]].map(([t, d, c]) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, background: T.bgCard, border: `1px solid ${c}33`, borderRadius: 7, padding: "8px 14px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
            <div><div style={{ fontSize: 11, fontWeight: 600, color: c }}>{t}</div><div style={{ fontSize: 9, color: T.txtTert }}>{d}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════
   EXPENSES PAGE
════════════════════════════════════════════ */
function ExpensesPage({ user, expenses, onAdd, onDelete, T }) {
  const [form, setForm] = useState({ category: "Gym Membership", amount: "", note: "", date: new Date().toISOString().split("T")[0] });
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const CATS = [
    { label: "Gym Membership", icon: "🏋️", color: "#5b7cf5" },
    { label: "Supplements", icon: "💊", color: "#00d4aa" },
    { label: "Equipment", icon: "🥊", color: "#e8a83a" },
    { label: "Apparel", icon: "👟", color: "#4db882" },
    { label: "Diet & Food", icon: "🥗", color: "#38b4b4" },
    { label: "Personal Trainer", icon: "👨‍🏫", color: "#e07a35" },
    { label: "Recovery", icon: "💆", color: "#9472e6" },
    { label: "Other", icon: "📦", color: "#8891a4" },
  ];
  const catMap = Object.fromEntries(CATS.map(c => [c.label, c]));

  const handleAdd = () => {
    if (!form.amount || isNaN(+form.amount)) return;
    onAdd({ ...form, amount: +form.amount });
    setSaved(true);
    setForm(p => ({ ...p, amount: "", note: "" }));
    setTimeout(() => { setSaved(false); setShowForm(false); }, 1200);
  };

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthExp = expenses.filter(e => e.date && e.date.startsWith(thisMonth));
  const totalMonth = monthExp.reduce((s, e) => s + e.amount, 0);
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = CATS.map(c => ({ ...c, total: monthExp.filter(e => e.category === c.label).reduce((s, e) => s + e.amount, 0), count: monthExp.filter(e => e.category === c.label).length })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  const months = [...new Set(expenses.map(e => e.date?.slice(0, 7)))].filter(Boolean).sort().reverse();

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center 40%", height: 140 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#e8a83a,#4db882)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#e8a83a", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>FINANCES</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 4 }}>Monthly Expenses</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Track your fitness spending · <span style={{ color: "#e8a83a", fontWeight: 600 }}>₹{totalMonth.toLocaleString()} this month</span></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["💰", "₹" + totalMonth.toLocaleString(), "This Month", "#e8a83a"], ["📦", "₹" + totalAll.toLocaleString(), "All Time", "#5b7cf5"], ["📋", monthExp.length + " items", "This Month", "#4db882"]].map(([ic, v, l, c]) => (
              <div key={l} style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${c}44`, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 14 }}>{ic}</div>
                <div style={{ fontSize: 11, color: c, fontWeight: 700, marginTop: 2 }}>{v}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          ["This Month", "₹" + totalMonth.toLocaleString(), "#e8a83a", "💳"],
          ["This Year", "₹" + (expenses.filter(e => e.date && e.date.startsWith(now.getFullYear() + "")).reduce((s, e) => s + e.amount, 0)).toLocaleString(), "#5b7cf5", "📅"],
          ["Avg/Month", "₹" + (months.length ? Math.round(totalAll / months.length) : 0).toLocaleString(), "#4db882", "📊"],
          ["Total Entries", expenses.length + " items", "#00d4aa", "🗂️"],
        ].map(([l, v, c, ic]) => (
          <div key={l} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 16 }}>{ic}</span><div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div></div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>All Expenses</div>
            <button onClick={() => setShowForm(v => !v)} style={{ background: showForm ? "#444" : T.accent, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans" }}>{showForm ? "✕ Cancel" : "+ Add Expense"}</button>
          </div>

          {showForm && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.accent}44`, borderRadius: 10, padding: 18, marginBottom: 12, animation: "fadeUp .2s ease" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim, marginBottom: 12 }}>New Expense</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><div style={{ fontSize: 11, color: T.txtSec, marginBottom: 4, fontWeight: 500 }}>Category</div>
                  <select value={form.category} onChange={e => setF("category", e.target.value)} style={{ width: "100%" }}>{CATS.map(c => <option key={c.label}>{c.label}</option>)}</select></div>
                <div><div style={{ fontSize: 11, color: T.txtSec, marginBottom: 4, fontWeight: 500 }}>Amount (₹)</div>
                  <input type="number" placeholder="0" value={form.amount} onChange={e => setF("amount", e.target.value)} min="0" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div><div style={{ fontSize: 11, color: T.txtSec, marginBottom: 4, fontWeight: 500 }}>Date</div>
                  <input type="date" value={form.date} onChange={e => setF("date", e.target.value)} /></div>
                <div><div style={{ fontSize: 11, color: T.txtSec, marginBottom: 4, fontWeight: 500 }}>Note (optional)</div>
                  <input type="text" placeholder="e.g. Monthly renewal" value={form.note} onChange={e => setF("note", e.target.value)} /></div>
              </div>
              <button onClick={handleAdd} style={{ width: "100%", padding: "10px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: saved ? "#4db882" : T.accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: "DM Sans", transition: "background .3s" }}>{saved ? "✓ Saved!" : "Save Expense"}</button>
            </div>
          )}

          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {sorted.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim, marginBottom: 6 }}>No expenses yet</div>
                <div style={{ fontSize: 11, color: T.txtTert }}>Click "+ Add Expense" to log your first fitness spend</div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 90px 32px", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 9, fontWeight: 700, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".07em" }}>
                  <div /><div>Description</div><div style={{ textAlign: "right" }}>Amount</div><div style={{ textAlign: "center" }}>Date</div><div />
                </div>
                {sorted.map(e => {
                  const c = catMap[e.category] || catMap["Other"];
                  return (
                    <div key={e.id} style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 90px 32px", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${T.border}44`, alignItems: "center" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 7, background: `${c.color}18`, border: `1px solid ${c.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{c.icon}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.txtPrim }}>{e.category}</div>
                        {e.note && <div style={{ fontSize: 10, color: T.txtTert, marginTop: 1 }}>{e.note}</div>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.color, textAlign: "right", fontFamily: "DM Mono" }}>₹{e.amount.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: T.txtTert, textAlign: "center", fontFamily: "DM Mono" }}>{e.date}</div>
                      <button onClick={() => onDelete(e.id)} title="Delete" style={{ background: "transparent", border: "none", color: "#e05555", cursor: "pointer", fontSize: 14, padding: "2px", opacity: 0.6 }}>✕</button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim, marginBottom: 12 }}>This Month by Category</div>
          {byCat.length === 0 ? (
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "40px 20px", textAlign: "center", color: T.txtTert, fontSize: 12 }}>No expenses this month yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {byCat.map(c => {
                const pct = totalMonth > 0 ? Math.round((c.total / totalMonth) * 100) : 0;
                return (
                  <div key={c.label} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderLeft: `4px solid ${c.color}`, borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{c.icon}</span>
                        <div><div style={{ fontSize: 11, fontWeight: 600, color: T.txtPrim }}>{c.label}</div><div style={{ fontSize: 9, color: T.txtTert }}>{c.count} item{c.count !== 1 ? "s" : ""}</div></div>
                      </div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 700, color: c.color, fontFamily: "DM Mono" }}>₹{c.total.toLocaleString()}</div><div style={{ fontSize: 9, color: T.txtTert }}>{pct}%</div></div>
                    </div>
                    <div style={{ height: 5, background: T.bgInput, borderRadius: 3 }}><div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${c.color},${c.color}99)`, borderRadius: 3 }} /></div>
                  </div>
                );
              })}
            </div>
          )}
          {byCat.length > 0 && (
            <div style={{ marginTop: 12, background: `${T.accent}08`, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.accentLt, marginBottom: 6 }}>💡 Spend Insight</div>
              <div style={{ fontSize: 11, color: T.txtSec, lineHeight: 1.6 }}>Top spend: <b style={{ color: byCat[0]?.color }}>{byCat[0]?.label}</b> at ₹{byCat[0]?.total.toLocaleString()} ({Math.round((byCat[0].total / totalMonth) * 100)}% of monthly fitness budget).</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceholderPage({ title, sub, icon, T }) {
  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero Banner */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center", height: 120,
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.5) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.accent},#00d4aa)`, opacity: 0.9 }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", letterSpacing: "-.5px", marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{sub}</div>
        </div>
      </div>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, textAlign: "center", padding: "80px 40px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.txtPrim, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, color: T.txtSec }}>This section is coming soon. Navigate to Dashboard, Diet Plan, Workout, or AI Assistant.</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════ */
export default function AdaptFitApp() {
  // ── localStorage helpers (defined first so useState can use them) ──
  const _r = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
  const _w = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

  // ── Theme (persisted) ──────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => _r("af_theme", true));
  const T = makeTheme(isDark);
  useEffect(() => { injectGlobalStyles(T); }, [isDark]);
  const toggleTheme = () => setIsDark(d => { _w("af_theme", !d); return !d; });

  // ── Restore session on reload ──────────────────────────────────────
  const _savedUser = _r("af_user", null);
  const [page, setPage] = useState(() => _savedUser ? _r("af_page", "app") : "auth");
  const [user, setUser] = useState(() => _savedUser);
  const [progress, setProgress] = useState(() => _r("af_progress", []));
  const [nav, setNav] = useState(() => _r("af_nav", "dashboard"));
  const [dietPlan, setDietPlan] = useState(() => _r("af_diet", null));
  const [workoutPlan, setWorkoutPlan] = useState(() => _r("af_workout", null));
  const [generating, setGenerating] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const CHAT_DEFAULT = [{ role: "ai", content: "Hello! I'm your AI Fitness Assistant.\n\nSwitch to Plan Generator mode to create structured plans, or ask me anything about nutrition, training, or recovery!" }];
  const [chatMsgs, setChatMsgs] = useState(CHAT_DEFAULT);
  const [chatMode, setChatMode] = useState("general");
  const [expenses, setExpenses] = useState(() => _r("af_expenses", []));
  const [syncing, setSyncing] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [arExId, setArExId] = useState(null); // Jump to specific AR exercise from dashboard
  const [healthReports, setHealthReports] = useState(() => _r("af_health", []));

  // ── Persist every change ───────────────────────────────────────────
  useEffect(() => _w("af_page", page), [page]);
  useEffect(() => { if (user) _w("af_user", user); }, [user]);
  useEffect(() => _w("af_progress", progress), [progress]);
  useEffect(() => _w("af_nav", nav), [nav]);
  useEffect(() => _w("af_diet", dietPlan), [dietPlan]);
  useEffect(() => _w("af_workout", workoutPlan), [workoutPlan]);
  useEffect(() => { if (user?.email) _w("af_chat_" + user.email, chatMsgs); }, [chatMsgs, user?.email]);
  useEffect(() => _w("af_expenses", expenses), [expenses]);
  useEffect(() => _w("af_health", healthReports), [healthReports]);

  const computeM = useCallback(u => {
    const tdee = calcTDEE(u.weight, u.height, u.age, u.gender, u.activityLevel);
    return {
      bmi: calcBMI(u.weight, u.height),
      tdee,
      target: calcTarget(tdee, u.goal, u.gender),
      prot: calcProt(u.weight, u.goal),
    };
  }, []);

  const handleNav = (p, exId = null) => {
    if (p === "ar-trainer" && exId) setArExId(exId);
    else if (p !== "ar-trainer") setArExId(null);
    setNav(p);
    setSideOpen(false);
  };

  const [metrics, setMetrics] = useState(() => {
    const u = _r("af_user", null);
    if (!u) return null;
    const tdee = calcTDEE(u.weight, u.height, u.age, u.gender, u.activityLevel);
    return { bmi: calcBMI(u.weight, u.height), tdee, target: calcTarget(tdee, u.goal, u.gender), prot: calcProt(u.weight, u.goal) };
  });

  const handleLogin = async (u, prog) => {
    // Check if this is a different user than the last stored user
    const prevUser = _r("af_user", null);
    if (prevUser && prevUser.email !== u.email) {
      // Different user — wipe previous user's local data
      ["af_progress", "af_nav", "af_diet", "af_workout", "af_events", "af_expenses"].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });
    }
    setUser(u); setMetrics(computeM(u)); setProgress(prog);
    // Load this user's chat history
    const userChat = _r("af_chat_" + u.email, null);
    setChatMsgs(userChat || [{ role: "ai", content: "Hello! I'm your AI Fitness Assistant.\n\nSwitch to Plan Generator mode to create structured plans, or ask me anything about nutrition, training, or recovery!" }]);
    setDietPlan(null); setWorkoutPlan(null); setExpenses([]);
    setPage("app");
    _w("af_user", u); _w("af_progress", prog); _w("af_page", "app");
    // Login complete
  };

  const handleLogout = async () => {
    // Clear local state FIRST so UI immediately shows auth page
    if (user?.email) { try { localStorage.removeItem("af_chat_" + user.email); } catch {} }
    ["af_page", "af_user", "af_progress", "af_nav", "af_diet", "af_workout", "af_chat", "af_events", "af_expenses", "af_health"].forEach(k => { try { localStorage.removeItem(k); } catch { } });
    setUser(null); setMetrics(null); setProgress([]); setNav("dashboard");
    setDietPlan(null); setWorkoutPlan(null); setHealthReports([]);
    const CHAT_RESET = [{ role: "ai", content: "Hello! I'm your AI Fitness Assistant.\n\nSwitch to Plan Generator mode to create structured plans, or ask me anything about nutrition, training, or recovery!" }];
    setChatMsgs(CHAT_RESET);
    setPage("auth"); // Show auth immediately
    // Then sign out from Supabase (async, doesn't block UI)
    try { await supabase.signOut(); } catch(e) { console.warn('Signout error:', e); }
  };

  const fetchHealthReports = async (uid) => {
    if (!uid) return;
    try {
      const { data, error } = await supabase.from('health_reports').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      if (error) throw error;
      setHealthReports(data || []);
    } catch (err) { console.warn("Health fetch failed:", err.message); }
  };

  // ── Supabase Auth Listener ─────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setPage("auth");
        return;
      }
      if (session?.user) {
        setPage("app");
        fetchUserData(session.user.id, session.user.email || '');
      } else if (!session) {
        setPage("auth");
      }
    });

    // Also check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPage("app");
        fetchUserData(session.user.id, session.user.email || '');
      } else {
        try { const u = JSON.parse(localStorage.getItem("af_user")); if (u?.email === "rahul@adaptfit.ai") return; } catch(e){}
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId, session_email = '') => {
    setSyncing(true);
    try {
      // 1. Fetch Profile — gracefully handle missing columns
      const { data: profile, error: profErr } = await supabase
        .from('profiles').select('*').eq('id', userId).single();

      if (profErr) {
        // Profile doesn't exist yet (new signup) — use defaults
        console.warn('Profile not found, using defaults:', profErr.message);
        const defaultUser = {
          name: session_email.split('@')[0] || 'User',
          email: session_email,
          age: 25, gender: 'Male', height: 170, weight: 70,
          goal: 'Fat Loss', activityLevel: 'Moderately Active',
          workoutType: 'Gym', workoutHours: 1, workoutDays: 4,
          fitnessLevel: 'Beginner', lastUpdate: new Date().toISOString()
        };
        setUser(defaultUser);
        setMetrics(computeM(defaultUser));
        _w("af_user", defaultUser);
        setSyncing(false);
        return;
      }

      if (profile) {
        const u = {
          name: profile.full_name || session_email.split('@')[0],
          email: session_email,
          age: profile.age || 25,
          gender: profile.gender || 'Male',
          height: profile.height || 170,
          weight: profile.weight || 70,
          goal: profile.goal || 'Fat Loss',
          activityLevel: profile.activity_level || 'Moderately Active',
          workoutType: profile.workout_type || 'Gym',
          workoutHours: profile.workout_hours || 1,
          workoutDays: profile.workout_days || 4,
          fitnessLevel: profile.fitness_level || 'Beginner',
          lastUpdate: profile.last_update || new Date().toISOString()
        };
        // Wipe stale data if different user
        const prevUser = _r("af_user", null);
        if (prevUser && prevUser.email && prevUser.email !== session_email) {
          ["af_progress", "af_nav", "af_diet", "af_workout", "af_events"].forEach(k => {
            try { localStorage.removeItem(k); } catch {}
          });
          setDietPlan(null); setWorkoutPlan(null);
        }
        setUser(u); setMetrics(computeM(u)); _w("af_user", u);
        const userChat = _r("af_chat_" + session_email, null);
        setChatMsgs(userChat || [{ role: "ai", content: "Hello! I'm your AI Fitness Assistant.\n\nSwitch to Plan Generator mode to create structured plans, or ask me anything about nutrition, training, or recovery!" }]);
        fetchHealthReports(userId);
      }

      // 2. Fetch Progress — ignore if table missing
      try {
        const { data: prog } = await supabase.from('progress_logs').select('*').eq('user_id', userId).order('created_at', { ascending: true });
        if (Array.isArray(prog) && prog.length > 0) setProgress(prog.map(p => ({ date: p.date, w: p.weight, bmi: p.bmi, cal: p.calories })));
      } catch(e) { console.warn('progress_logs not available'); }

      // 3. Fetch Plans — ignore if tables missing
      try {
        const { data: wPlan } = await supabase.from('workout_plans').select('plan_data').eq('user_id', userId).limit(1).single();
        if (wPlan?.plan_data) setWorkoutPlan(wPlan.plan_data);
      } catch(e) { console.warn('workout_plans not available'); }

      try {
        const { data: dPlan } = await supabase.from('diet_plans').select('plan_data').eq('user_id', userId).limit(1).single();
        if (dPlan?.plan_data) setDietPlan(dPlan.plan_data);
      } catch(e) { console.warn('diet_plans not available'); }

    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const callOllamaPlanner = async (prompt, type, fallbackPlan, maxRetries = 2) => {
    let attempt = 0;
    console.log(`🤖 AI Planner: Starting ${type} generation...`);
    
    while (attempt <= maxRetries) {
      try {
        console.log(`📡 AI Planner: Attempt ${attempt + 1}/${maxRetries + 1} sending to Ollama...`);
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(60000), // Increased to 60s for full plan generation
          body: JSON.stringify({
            model: "llama3.2:3b",
            prompt,
            stream: false,
            format: "json",
            options: { temperature: 0.3, num_predict: 1200 }
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log("📥 AI Planner: Received response from Ollama.");
          
          let raw = (result?.response || '').replace(/```json/g, '').replace(/```/g, '').trim();
          const match = raw.match(/\[[\s\S]*\]/) || raw.match(/\{[\s\S]*\}/);
          if (match) raw = match[0];
          
          const aiPlan = JSON.parse(raw);
          if (Array.isArray(aiPlan) && aiPlan.length > 0) {
            const isValid = type === "diet" 
              ? aiPlan.every(m => m.name && Array.isArray(m.foods))
              : aiPlan.every(d => d.day && Array.isArray(d.exs));
            
            if (isValid) {
              console.log("✅ AI Planner: Valid JSON plan received and verified.");
              return aiPlan;
            } else {
              console.warn("⚠️ AI Planner: Received JSON but it failed validation schema.");
            }
          }
        } else {
          console.error(`❌ AI Planner: Server error ${response.status}`);
        }
      } catch (err) {
        console.warn(`🛑 AI Planner: Attempt ${attempt + 1} failed:`, err.message);
      }
      attempt++;
    }
    console.warn("🏚️ AI Planner: All attempts failed or timed out. Falling back to local static logic.");
    return fallbackPlan;
  };

  const handleGenerate = async (type) => {
    if (!metrics || !user) return; // safety guard
    setGenerating(type);

    try {
      const fallbackPlan = type === "diet"
        ? buildDiet(metrics.target, metrics.prot)
        : user.workoutType === "Gym"
          ? buildGym(T, user.fitnessLevel || "Intermediate", healthReports)
          : buildHome(user.workoutDays, T, user.fitnessLevel || "Intermediate", healthReports);

      const prompt = type === "diet"
        ? `Generate a personalized diet plan...`
        : `Generate a weekly ${user.workoutType} workout plan...`;

      const finalPlan = fallbackPlan; // Use the pre-calculated Indian-localized static plan immediately

      if (type === "diet") {
        setDietPlan(finalPlan);
        _w("af_diet", finalPlan);
      } else {
        setWorkoutPlan(finalPlan);
        _w("af_workout", finalPlan);
      }
      
      // Persist to Supabase in background
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          if (type === "diet") {
            await supabase.from('diet_plans').upsert([{ user_id: authUser.id, plan_data: finalPlan }], { onConflict: 'user_id' });
          } else {
            await supabase.from('workout_plans').upsert([{ user_id: authUser.id, plan_data: finalPlan }], { onConflict: 'user_id' });
          }
        }
      } catch (err) {
        console.warn("Plan sync to DB failed (plan still saved locally):", err.message);
      }
    } catch (err) {
      console.error("Manual generation failed:", err);
    } finally {
      setGenerating(null); // ALWAYS turn off spinner
    }
  };

  const handleWeightUpdate = async (w) => {
    const upd = { ...user, weight: w, lastUpdate: new Date().toISOString() };
    const nm = computeM(upd);
    const snap = { date: new Date().toLocaleString("en-IN", { month: "short", year: "numeric" }), w, bmi: calcBMI(w, user.height), cal: nm.target };

    setUser(upd); _w("af_user", upd);
    setMetrics(nm); setProgress(p => [...p, snap]);

    if (dietPlan) setDietPlan(buildDiet(nm.target, nm.prot));
    // Weight updated
    setShowModal(false);

    if (dietPlan) setDietPlan(buildDiet(nm.target, nm.prot));
    if (workoutPlan) setWorkoutPlan(user.workoutType === "Gym" ? buildGym(T, user.fitnessLevel, healthReports) : buildHome(user.workoutDays, T, user.fitnessLevel, healthReports));

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('profiles').update({ weight: w, last_update: upd.lastUpdate }).eq('id', authUser.id);
      await supabase.from('progress_logs').insert([{
        user_id: authUser.id,
        weight: w,
        bmi: snap.bmi,
        calories: snap.cal,
        date: snap.date
      }]);
      // Plans are recalculated above, sync them if they exist
      if (dietPlan) {
        const p = buildDiet(nm.target, nm.prot);
        await supabase.from('diet_plans').upsert([{ user_id: authUser.id, plan_data: p }], { onConflict: 'user_id' });
      }
      if (workoutPlan) {
        const p = user.workoutType === "Gym" ? buildGym(T, user.fitnessLevel, healthReports) : buildHome(user.workoutDays, T, user.fitnessLevel, healthReports);
        await supabase.from('workout_plans').upsert([{ user_id: authUser.id, plan_data: p }], { onConflict: 'user_id' });
      }
    }
  };

  const replaceFood = async (mi, fi, alt) => {
    const updatedPlan = dietPlan.map((meal, m) => {
      if (m !== mi) return meal;
      const foods = meal.foods.map((f, i) => i === fi ? alt : f);
      return { ...meal, foods, total_cal: foods.reduce((s, f) => s + (f.calories || f.cal), 0), total_prot: foods.reduce((s, f) => s + (f.protein || f.prot), 0) };
    });
    setDietPlan(updatedPlan);
    _w("af_diet", updatedPlan); // persist locally immediately

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase.from('diet_plans').upsert([{ user_id: authUser.id, plan_data: updatedPlan }], { onConflict: 'user_id' });
      }
    } catch (err) {
      console.warn("Could not sync food swap to server:", err);
    }
  };

  if (page === "auth") return <AuthPage onLogin={handleLogin} isDark={isDark} onToggleTheme={toggleTheme} T={T} />;

  // Syncing is silent background — never blocks UI

  const pageEl = () => {
    if (!user || !metrics) return (
      <div style={{ padding: 40, textAlign: "center", color: T.txtTert }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>🔎</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.txtPrim, marginBottom: 8 }}>Profile not found</div>
        <div style={{ fontSize: 12 }}>We couldn't load your fitness profile. Try logging out and in again.</div>
        <button onClick={handleLogout} style={{ marginTop: 20, background: T.accent, color: "#fff", border: "none", padding: "8px 20px", borderRadius: 6, cursor: "pointer" }}>Sign Out</button>
      </div>
    );
    const p = { T };
    if (nav === "dashboard") return <Dashboard user={user} m={metrics} progress={progress} workoutPlan={workoutPlan} onGenerate={handleGenerate} onWeightModal={() => setShowModal(true)} onNav={handleNav} generating={generating} {...p} />;
    if (nav === "diet") return <DietPage plan={dietPlan} metrics={metrics} generating={generating} onGenerate={handleGenerate} onReplace={replaceFood} {...p} />;
    if (nav === "workout") return <WorkoutPage plan={workoutPlan} user={user} generating={generating} onGenerate={handleGenerate} {...p} />;
    if (nav === "chatbot") return <ChatPage msgs={chatMsgs} mode={chatMode} user={user} metrics={metrics} onAdd={m => setChatMsgs(p => [...p, m])} onMode={setChatMode} onClear={() => setChatMsgs([{ role: "ai", content: "Chat cleared. Ask me anything!" }])} onGenerate={handleGenerate} onNav={handleNav} {...p} />;
    if (nav === "explorer") return <ProgressPage history={progress} user={user} metrics={metrics} onUpdate={() => setShowModal(true)} {...p} />;
    if (nav === "profile") return <ProfilePage user={user} metrics={metrics} onUpdate={(u) => { setUser(u); localStorage.setItem("af_user", JSON.stringify(u)); if(u.weight) setMetrics(computeM(u)); }} {...p} />;
    if (nav === "integrations") return <IntegrationsPage T={T} />;
    if (nav === "community") return <Community user={user} T={T} />;
    if (nav === "ar-trainer") return <ARTrainer user={user} initialExId={arExId} onClearEx={() => setArExId(null)} {...p} />;
    if (nav === "leaderboard") return <LeaderboardPage user={user} {...p} />;
    if (nav === "health") return <HealthPage reports={healthReports} onUpdate={() => fetchHealthReports(user?.id)} T={T} />;
    return <Dashboard user={user} m={metrics} progress={progress} workoutPlan={workoutPlan} onGenerate={handleGenerate} onWeightModal={() => setShowModal(true)} onNav={handleNav} generating={generating} {...p} />;
  };

  return (
    <div className="af-layout" style={{ display: "flex", height: "100vh", overflow: "hidden", background: T.bgOuter, color: T.txtPrim, fontFamily: "DM Sans,sans-serif", transition: "background .3s,color .3s" }}>
      {/* Hamburger button — mobile only */}
      <button className="af-hamburger" onClick={() => setSideOpen(o => !o)} style={{ background: T.bgCard, color: T.txtPrim, border: `1px solid ${T.border}` }}>
        {sideOpen ? "✕" : "☰"}
      </button>
      {/* Overlay — mobile only */}
      <div className="af-overlay" onClick={() => setSideOpen(false)} style={{ display: sideOpen ? "block" : "none" }} />
      <Sidebar active={nav} onNav={handleNav} user={user} isDark={isDark} onToggleTheme={toggleTheme} onLogout={handleLogout} T={T} sideOpen={sideOpen} />
      <div style={{ flex: 1, overflowY: "auto", background: T.bgMain, transition: "background .3s" }}>
        <div className="af-content" style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 26px" }}>
          {pageEl()}
        </div>
      </div>
      <div onClick={() => setNav("chatbot")} className="chat-bubble" style={{ position: "fixed", bottom: 22, right: 22, width: 42, height: 42, borderRadius: "50%", background: T.bgBtn, border: `1px solid ${T.borderAct}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 4px 24px rgba(91,124,245,.35)`, fontSize: 18, zIndex: 200, transition: "transform .18s" }}>
        💬
        <span style={{ position: "absolute", top: 0, right: 0, width: "100%", height: "100%", borderRadius: "50%", border: `2px solid ${T.accent}`, animation: "ringPulse 2s ease-out infinite", pointerEvents: "none" }} />
      </div>
      {showModal && <WeightModal user={user} onConfirm={handleWeightUpdate} onClose={() => setShowModal(false)} T={T} />}
    </div>
  );
}
