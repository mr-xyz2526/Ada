import { useMemo } from "react";

const ACT_MULT = {
  "Sedentary": 1.2,
  "Lightly Active": 1.375,
  "Moderately Active": 1.55,
  "Very Active": 1.725,
  "Extremely Active": 1.9,
};

const GOAL_DELTA = {
  "Fat Loss": -500,
  "Muscle Gain": 300,
  "Maintenance": 0,
  "Recomposition": -200,
};

const PROT_MULT = {
  "Fat Loss": 2.2,
  "Muscle Gain": 2.4,
  "Maintenance": 1.8,
  "Recomposition": 2.2,
};

/**
 * useFitnessMetrics — derives BMI, BMR, TDEE, target calories and protein
 * from a user profile object. Returns memoized values.
 */
export function useFitnessMetrics(user) {
  return useMemo(() => {
    if (!user) return null;

    const { weight, height, age, gender, activityLevel, goal } = user;

    // BMI
    const bmi = +(weight / (height / 100) ** 2).toFixed(1);

    // BMR (Mifflin-St Jeor)
    const bmr = gender === "Male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

    // TDEE
    const tdee = Math.round(bmr * (ACT_MULT[activityLevel] || 1.375));

    // Calorie target
    const target = tdee + (GOAL_DELTA[goal] || 0);

    // Protein target
    const protein = Math.round(weight * (PROT_MULT[goal] || 2.0));

    // BMI classification
    const bmiLabel =
      bmi < 18.5 ? "Underweight" :
      bmi < 25   ? "Normal"      :
      bmi < 30   ? "Overweight"  : "Obese";

    return { bmi, bmr, tdee, target, protein, bmiLabel };
  }, [user]);
}
