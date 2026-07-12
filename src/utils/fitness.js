// ─── Fitness constants ────────────────────────────────────────────
const GOALS      = ["Fat Loss","Muscle Gain","Maintenance","Recomposition"];
const ACT_LEVELS = ["Sedentary","Lightly Active","Moderately Active","Very Active","Extremely Active"];
const WK_TYPES   = ["Gym","Home"];

const FOOD = {
  protein:[
    {id:"p1",name:"Chicken Breast (150g)",cal:220,prot:35,carb:0,fat:5},
    {id:"p2",name:"Greek Yogurt (150g)",cal:130,prot:17,carb:8,fat:3},
    {id:"p3",name:"Boiled Eggs (2 large)",cal:156,prot:12,carb:1,fat:11},
    {id:"p4",name:"Tofu (100g)",cal:144,prot:17,carb:2,fat:9},
    {id:"p5",name:"Tuna in Water (100g)",cal:132,prot:29,carb:0,fat:1},
    {id:"p6",name:"Salmon (100g)",cal:208,prot:25,carb:0,fat:12},
    {id:"p7",name:"Paneer (100g)",cal:265,prot:18,carb:3,fat:20},
    {id:"p8",name:"Turkey Breast (150g)",cal:195,prot:36,carb:0,fat:4},
  ],
  carbs:[
    {id:"c1",name:"Brown Rice (150g)",cal:165,prot:3,carb:34,fat:1},
    {id:"c2",name:"Rolled Oats (80g)",cal:300,prot:10,carb:52,fat:5},
    {id:"c3",name:"Sweet Potato (150g)",cal:130,prot:3,carb:30,fat:0},
    {id:"c4",name:"Quinoa (100g)",cal:120,prot:4,carb:21,fat:2},
    {id:"c5",name:"Mixed Berries (100g)",cal:57,prot:1,carb:14,fat:0},
    {id:"c6",name:"Banana (medium)",cal:105,prot:1,carb:27,fat:0},
  ],
  fats:[
    {id:"f1",name:"Almonds (30g)",cal:174,prot:6,carb:6,fat:15},
    {id:"f2",name:"Avocado (½)",cal:120,prot:1,carb:6,fat:11},
    {id:"f3",name:"Peanut Butter (2 tbsp)",cal:190,prot:8,carb:7,fat:16},
    {id:"f4",name:"Olive Oil (1 tbsp)",cal:119,prot:0,carb:0,fat:14},
    {id:"f5",name:"Walnuts (30g)",cal:196,prot:5,carb:4,fat:20},
  ],
  veg:[
    {id:"v1",name:"Broccoli (100g)",cal:34,prot:3,carb:7,fat:0},
    {id:"v2",name:"Spinach (100g)",cal:23,prot:3,carb:4,fat:0},
    {id:"v3",name:"Mixed Greens (80g)",cal:20,prot:2,carb:3,fat:0},
  ],
};
const ALLF = [...FOOD.protein,...FOOD.carbs,...FOOD.fats,...FOOD.veg];

const GYM_SPLIT = [
  {day:"Mon",focus:"Chest"},
  {day:"Tue",focus:"Back"},
  {day:"Wed",focus:"Legs"},
  {day:"Thu",focus:"Shoulders"},
  {day:"Fri",focus:"Arms"},
  {day:"Sat",focus:"Core"},
];
const GYM_EX = {
  Chest:[["Barbell Bench Press","4","6-8","3 min"],["Incline DB Press","3","10-12","90s"],["Cable Flyes","3","12-15","60s"],["Chest Dips","3","10-12","90s"],["Push-Up Burnout","2","AMRAP","60s"]],
  Back:[["Deadlift","4","5","3 min"],["Lat Pulldown","3","10-12","90s"],["Barbell Row","3","8-10","2 min"],["Seated Cable Row","3","12","75s"],["Face Pulls","3","15-20","60s"]],
  Legs:[["Barbell Squat","4","6-8","3 min"],["Leg Press","3","10-12","2 min"],["Romanian Deadlift","3","10-12","90s"],["Leg Curl","3","12-15","75s"],["Calf Raises","4","15-20","60s"]],
  Shoulders:[["OHP Barbell","4","6-8","2 min"],["Lateral Raises","3","12-15","60s"],["Front Raises","3","12","60s"],["Rear Delt Flyes","3","15-20","60s"],["Arnold Press","3","10-12","90s"]],
  Arms:[["Barbell Curl","3","10-12","75s"],["Tricep Pushdown","3","12-15","60s"],["Hammer Curl","3","10-12","75s"],["Skull Crushers","3","10-12","75s"],["Preacher Curl","3","10-12","75s"]],
  Core:[["Plank","3","45-60s","60s"],["Hanging Leg Raise","3","12-15","75s"],["Cable Crunch","3","15-20","60s"],["Russian Twist","3","20","60s"],["Treadmill","1","20 min","—"]],
};

const calcBMI    = (w,h)=>+(w/(h/100)**2).toFixed(1);
const calcBMR    = (w,h,a,g)=>g==="Male"?10*w+6.25*h-5*a+5:10*w+6.25*h-5*a-161;
const calcTDEE   = (w,h,a,g,act)=>{const M={Sedentary:1.2,"Lightly Active":1.375,"Moderately Active":1.55,"Very Active":1.725,"Extremely Active":1.9};return Math.round(calcBMR(w,h,a,g)*(M[act]||1.375));};
const calcTarget = (tdee,goal)=>tdee+({"Fat Loss":-500,"Muscle Gain":300,"Maintenance":0,"Recomposition":-200}[goal]||0);
const calcProt   = (w,goal)=>Math.round(w*({"Fat Loss":2.2,"Muscle Gain":2.4,"Maintenance":1.8,"Recomposition":2.2}[goal]||2));
const bmiMeta    = (b,T)=>b<18.5?{l:"Underweight",c:T.yellow}:b<25?{l:"Normal",c:T.green}:b<30?{l:"Overweight",c:T.orange}:{l:"Obese",c:T.red};
const getAlts    = f=>ALLF.filter(x=>x.id!==f.id&&Math.abs(x.cal-f.cal)<=65&&Math.abs(x.prot-f.prot)<=9).slice(0,4);

const buildDiet = ()=>[
  {name:"Breakfast",time:"7:30 AM",emoji:"☀️",foods:[{...FOOD.carbs[1],calories:FOOD.carbs[1].cal,protein:FOOD.carbs[1].prot},{...FOOD.protein[1],calories:FOOD.protein[1].cal,protein:FOOD.protein[1].prot},{...FOOD.carbs[4],calories:FOOD.carbs[4].cal,protein:FOOD.carbs[4].prot}]},
  {name:"Lunch",time:"1:00 PM",emoji:"🍽️",foods:[{...FOOD.protein[0],calories:FOOD.protein[0].cal,protein:FOOD.protein[0].prot},{...FOOD.carbs[0],calories:FOOD.carbs[0].cal,protein:FOOD.carbs[0].prot},{...FOOD.veg[0],calories:FOOD.veg[0].cal,protein:FOOD.veg[0].prot},{...FOOD.fats[3],calories:FOOD.fats[3].cal,protein:FOOD.fats[3].prot}]},
  {name:"Snack",time:"4:30 PM",emoji:"⚡",foods:[{...FOOD.fats[0],calories:FOOD.fats[0].cal,protein:FOOD.fats[0].prot},{...FOOD.carbs[5],calories:FOOD.carbs[5].cal,protein:FOOD.carbs[5].prot}]},
  {name:"Dinner",time:"7:30 PM",emoji:"🌙",foods:[{...FOOD.protein[2],calories:FOOD.protein[2].cal,protein:FOOD.protein[2].prot},{...FOOD.carbs[3],calories:FOOD.carbs[3].cal,protein:FOOD.carbs[3].prot},{...FOOD.veg[1],calories:FOOD.veg[1].cal,protein:FOOD.veg[1].prot},{...FOOD.fats[1],calories:FOOD.fats[1].cal,protein:FOOD.fats[1].prot}]},
].map(m=>({...m,total_cal:m.foods.reduce((s,f)=>s+(f.calories||f.cal),0),total_prot:m.foods.reduce((s,f)=>s+(f.protein||f.prot),0)}));

const buildGym = (T)=>GYM_SPLIT.map(({day,focus},i)=>{
  const cols=[T.accent,T.purple,T.yellow,T.teal,T.orange,T.green];
  return{day,focus,col:cols[i],exs:GYM_EX[focus].map(([name,sets,reps,rest])=>({name,sets,reps,rest}))};
});
const buildHome = (days,T)=>["Mon","Wed","Fri","Sat"].slice(0,Math.min(days,4)).map((day,i)=>({day,focus:i%2===0?"Full Body Strength":"HIIT Circuit",col:i%2===0?T.accent:T.orange,exs:[["Push-Ups","3","15","60s"],["Jump Squats","3","15","60s"],["Glute Bridges","3","15","45s"],["Plank","3","45s","30s"],["Mountain Climbers","3","30s","30s"],["Burpees","3","10","75s"]].map(([name,sets,reps,rest])=>({name,sets,reps,rest}))}));

function aiReply(msg,user,m){
  const q=msg.toLowerCase();
  if(["diagnos","disease","prescri","medication","symptom","surgery"].some(k=>q.includes(k)))
    return "I provide general fitness guidance only — not medical advice.\n\nPlease consult a qualified healthcare professional for medical concerns.";
  if(q.includes("protein")) return `Your protein target is **${m.prot}g/day** for ${user.goal}.\n\nAt ${user.weight}kg that's ${(m.prot/user.weight).toFixed(1)}g/kg — optimal for your goal. Spread across 4–5 meals (~${Math.round(m.prot/4)}g each).\n\nBest sources: chicken breast, tuna, Greek yogurt, paneer, eggs.`;
  if(q.includes("calori")||q.includes("eat")) return `Your daily target is **${m.target} kcal** (maintenance: ${m.tdee} kcal).\n\nFor ${user.goal}: ${Math.abs(m.target-m.tdee)} kcal ${m.target<m.tdee?"deficit":"surplus"}. Track consistently for 3–4 weeks before adjusting.\n\nConsistency beats perfection every time.`;
  if(q.includes("workout")||q.includes("train")) return `For **${user.goal}** on a ${user.workoutType} plan:\n\n• Progressive overload — add weight/reps weekly\n• Compound movements are primary, isolation is secondary\n• ${user.workoutDays} days/week is ${user.workoutDays>=4?"solid — ensure 2 rest days":"a great start — maximize intensity"}\n\nNo gains without progressive stimulus.`;
  if(q.includes("sleep")||q.includes("recov")) return `Sleep is your **#1 recovery tool**.\n\nTarget 7–9 hours nightly — growth hormone is primarily released during deep sleep for muscle repair.\n\nWith ${user.workoutDays} training days: minimum 2 full rest days. Deload every 4–6 weeks if strength stalls.`;
  if(q.includes("supplement")||q.includes("creatine")) return `Evidence-based supplements:\n\n• **Creatine monohydrate** (3-5g/day) — best-studied, strongest evidence\n• **Whey protein** — convenient, not magic\n• **Vitamin D3 + K2** — critical if limited sun exposure\n• **Caffeine** — 3-6mg/kg pre-workout\n\nFood first, always. Supplements fill gaps only.`;
  return `Based on your profile (${user.weight}kg · ${user.goal}):\n\n• Hit **${m.target} kcal/day** — your primary lever\n• Reach **${m.prot}g protein** — protects muscle in deficit\n• Train progressively — harder each week\n• Sleep 7–9h — where adaptation happens\n\nAsk me anything specific about nutrition, training, or recovery!`;
}

// ─── Demo data ────────────────────────────────────────────────────
const DEMO = {name:"Rahul Sharma",email:"rahul@adaptfit.ai",age:28,gender:"Male",height:175,weight:80,goal:"Muscle Gain",activityLevel:"Moderately Active",workoutType:"Gym",workoutHours:1,workoutDays:5,lastUpdate:new Date(Date.now()-37*864e5).toISOString()};
const DEMO_PROG = [
  {date:"Sep 2025",w:85,bmi:27.8,cal:2580},
  {date:"Oct 2025",w:83.5,bmi:27.3,cal:2620},
  {date:"Nov 2025",w:82,bmi:26.8,cal:2650},
  {date:"Dec 2025",w:80.5,bmi:26.3,cal:2680},
  {date:"Jan 2026",w:80,bmi:26.1,cal:2710},
];

/* ════════════════════════════════════════════
   PRIMITIVES
════════════════════════════════════════════ */