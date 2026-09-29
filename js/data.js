/*
  Basketwise recipe + ingredient data.

  Nutrition values are per ONE recipe unit of the ingredient (see `u`), rounded
  estimates based on USDA FoodData Central entries for the plain ingredient.
  Order of the `nu` array matches NUTRIENTS below.

  Prices are per package (`pkg` units, described by `pl`) and are sample
  estimates for Aldi, Walmart and Publix. They are not live store prices.
*/

window.BW = window.BW || {};

BW.NUTRIENTS = [
  // key, label, unit, daily value (FDA, adults & children 4+), kind
  { key: "kcal", label: "Calories", unit: "kcal", dv: 2000, kind: "energy" },
  { key: "pro", label: "Protein", unit: "g", dv: 50, kind: "get" },
  { key: "carb", label: "Carbohydrates", unit: "g", dv: 275, kind: "carb" },
  { key: "fib", label: "Fiber", unit: "g", dv: 28, kind: "get" },
  { key: "fat", label: "Fat", unit: "g", dv: 78, kind: "limit" },
  { key: "na", label: "Sodium", unit: "mg", dv: 2300, kind: "limit" },
  { key: "ca", label: "Calcium", unit: "mg", dv: 1300, kind: "get" },
  { key: "fe", label: "Iron", unit: "mg", dv: 18, kind: "get" },
  { key: "k", label: "Potassium", unit: "mg", dv: 4700, kind: "get" },
  { key: "vc", label: "Vitamin C", unit: "mg", dv: 90, kind: "get" },
  { key: "va", label: "Vitamin A", unit: "mcg", dv: 900, kind: "get" },
];

BW.STORES = [
  { id: "aldi", name: "Aldi" },
  { id: "walmart", name: "Walmart" },
  { id: "publix", name: "Publix" },
];

BW.AISLES = [
  { id: "produce", label: "Produce", icon: "🥬" },
  { id: "meat", label: "Meat & seafood", icon: "🍗" },
  { id: "dairy", label: "Dairy & eggs", icon: "🥚" },
  { id: "bakery", label: "Bread & tortillas", icon: "🍞" },
  { id: "pantry", label: "Pantry & canned", icon: "🥫" },
  { id: "frozen", label: "Frozen", icon: "🧊" },
  { id: "spices", label: "Oils & spices", icon: "🧂" },
];

// keep: "fresh" = spoils within about a week, "fridge" = keeps a few weeks,
// "pantry" = shelf stable. Only "fresh" leftovers are flagged as waste risk.
//          kcal  pro  carb  fib  fat   na    ca   fe    k    vc   va
BW.INGREDIENTS = {
  // Produce
  onion:        { n: "Yellow onion", u: "onion", up: "onions", a: "produce", pkg: 1, pl: "each", p: [0.69, 0.78, 1.29], keep: "fridge",
                  nu: [60, 1.6, 14, 2.5, 0.2, 6, 35, 0.3, 220, 11, 0] },
  garlic:       { n: "Garlic", u: "clove", up: "cloves", a: "produce", pkg: 10, pl: "head (~10 cloves)", p: [0.5, 0.54, 0.79], keep: "fridge",
                  nu: [4, 0.2, 1, 0.1, 0, 1, 5, 0.1, 12, 0.9, 0] },
  bellPepper:   { n: "Bell peppers", u: "pepper", up: "peppers", a: "produce", pkg: 3, pl: "3-pack", p: [2.49, 2.97, 3.99], keep: "fresh",
                  nu: [37, 1.2, 7, 2.5, 0.4, 5, 8, 0.5, 250, 150, 190] },
  spinach:      { n: "Baby spinach", u: "cup", up: "cups", a: "produce", pkg: 5, pl: "5 oz bag (~5 cups)", p: [1.99, 2.24, 3.49], keep: "fresh",
                  nu: [7, 0.9, 1.1, 0.7, 0.1, 24, 30, 0.8, 167, 8.4, 141] },
  cilantro:     { n: "Cilantro", u: "bunch", up: "bunches", a: "produce", pkg: 1, pl: "bunch", p: [0.69, 0.78, 1.29], keep: "fresh",
                  nu: [12, 1, 2, 1.4, 0.3, 23, 34, 0.9, 260, 14, 170] },
  lime:         { n: "Limes", u: "lime", up: "limes", a: "produce", pkg: 1, pl: "each", p: [0.33, 0.38, 0.5], keep: "fridge",
                  nu: [20, 0.5, 7, 1.9, 0.1, 1, 22, 0.4, 70, 20, 1] },
  lemon:        { n: "Lemons", u: "lemon", up: "lemons", a: "produce", pkg: 1, pl: "each", p: [0.5, 0.58, 0.79], keep: "fridge",
                  nu: [17, 0.6, 5.4, 1.6, 0.2, 1, 15, 0.4, 80, 31, 1] },
  tomato:       { n: "Tomatoes", u: "tomato", up: "tomatoes", a: "produce", pkg: 1, pl: "each", p: [0.59, 0.68, 0.99], keep: "fresh",
                  nu: [22, 1.1, 4.8, 1.5, 0.2, 6, 12, 0.3, 290, 17, 52] },
  broccoli:     { n: "Broccoli florets", u: "cup", up: "cups", a: "produce", pkg: 4, pl: "12 oz bag (~4 cups)", p: [1.89, 2.18, 3.49], keep: "fresh",
                  nu: [31, 2.5, 6, 2.4, 0.3, 30, 43, 0.7, 290, 81, 28] },
  carrot:       { n: "Carrots", u: "carrot", up: "carrots", a: "produce", pkg: 6, pl: "1 lb bag (~6)", p: [0.89, 0.98, 1.69], keep: "fridge",
                  nu: [25, 0.6, 6, 1.7, 0.1, 42, 20, 0.2, 195, 3.6, 509] },
  celery:       { n: "Celery", u: "stalk", up: "stalks", a: "produce", pkg: 9, pl: "bunch (~9 stalks)", p: [1.29, 1.48, 2.29], keep: "fridge",
                  nu: [6, 0.3, 1.2, 0.6, 0.1, 32, 16, 0.1, 104, 1.2, 9] },
  potato:       { n: "Russet potatoes", u: "potato", up: "potatoes", a: "produce", pkg: 1, pl: "each", p: [0.6, 0.68, 1.0], keep: "pantry",
                  nu: [164, 4.3, 37, 4, 0.2, 13, 21, 1.9, 925, 17, 2] },
  sweetPotato:  { n: "Sweet potatoes", u: "sweet potato", up: "sweet potatoes", a: "produce", pkg: 1, pl: "each", p: [0.99, 1.08, 1.49], keep: "pantry",
                  nu: [112, 2, 26, 3.9, 0.1, 72, 39, 0.8, 440, 3, 920] },
  zucchini:     { n: "Zucchini", u: "zucchini", up: "zucchini", a: "produce", pkg: 1, pl: "each", p: [0.89, 0.98, 1.49], keep: "fresh",
                  nu: [33, 2.4, 6, 2, 0.6, 16, 31, 0.7, 512, 35, 20] },
  avocado:      { n: "Avocados", u: "avocado", up: "avocados", a: "produce", pkg: 1, pl: "each", p: [0.79, 0.98, 1.67], keep: "fresh",
                  nu: [240, 3, 13, 10, 22, 10, 18, 0.8, 730, 15, 10] },
  cucumber:     { n: "Cucumbers", u: "cucumber", up: "cucumbers", a: "produce", pkg: 1, pl: "each", p: [0.59, 0.68, 0.99], keep: "fresh",
                  nu: [45, 2, 11, 1.5, 0.3, 6, 48, 0.8, 440, 8, 15] },
  greenOnion:   { n: "Green onions", u: "bunch", up: "bunches", a: "produce", pkg: 1, pl: "bunch", p: [0.79, 0.88, 1.29], keep: "fresh",
                  nu: [30, 1.6, 7, 2.4, 0.2, 15, 65, 1.3, 250, 17, 45] },
  banana:       { n: "Bananas", u: "banana", up: "bananas", a: "produce", pkg: 1, pl: "each", p: [0.25, 0.27, 0.35], keep: "fresh",
                  nu: [105, 1.3, 27, 3.1, 0.4, 1, 6, 0.3, 422, 10, 4] },

  // Meat & seafood
  chickenBreast:{ n: "Chicken breast", u: "lb", up: "lb", a: "meat", pkg: 2, pl: "2 lb pack", p: [5.98, 6.48, 9.98], keep: "fresh",
                  nu: [544, 102, 0, 0, 12, 204, 23, 1.6, 1560, 0, 27] },
  chickenThigh: { n: "Boneless chicken thighs", u: "lb", up: "lb", a: "meat", pkg: 1.5, pl: "1.5 lb pack", p: [4.49, 4.97, 7.49], keep: "fresh",
                  nu: [549, 90, 0, 0, 19, 430, 40, 3.6, 1100, 0, 40] },
  groundBeef:   { n: "Ground beef 85/15", u: "lb", up: "lb", a: "meat", pkg: 1, pl: "1 lb pack", p: [4.99, 5.47, 6.99], keep: "fresh",
                  nu: [975, 84, 0, 0, 68, 300, 55, 9.5, 1225, 0, 0] },
  groundTurkey: { n: "Ground turkey 93/7", u: "lb", up: "lb", a: "meat", pkg: 1, pl: "1 lb pack", p: [3.99, 4.47, 6.49], keep: "fresh",
                  nu: [680, 85, 0, 0, 37, 320, 70, 5, 1080, 0, 0] },
  salmon:       { n: "Salmon fillets", u: "lb", up: "lb", a: "meat", pkg: 1, pl: "1 lb pack", p: [7.99, 8.97, 12.99], keep: "fresh",
                  nu: [940, 92, 0, 0, 60, 270, 40, 1.5, 1650, 0, 263] },

  // Dairy & eggs
  eggs:         { n: "Eggs", u: "egg", up: "eggs", a: "dairy", pkg: 12, pl: "dozen", p: [2.49, 2.87, 3.99], keep: "fridge",
                  nu: [72, 6.3, 0.4, 0, 4.8, 71, 28, 0.9, 69, 0, 80] },
  milk:         { n: "Milk (2%)", u: "cup", up: "cups", a: "dairy", pkg: 8, pl: "half gallon (8 cups)", p: [1.99, 2.28, 3.49], keep: "fresh",
                  nu: [122, 8, 12, 0, 4.8, 115, 293, 0, 390, 0, 134] },
  cheddar:      { n: "Shredded cheddar", u: "cup", up: "cups", a: "dairy", pkg: 2, pl: "8 oz bag (2 cups)", p: [1.99, 2.24, 3.59], keep: "fridge",
                  nu: [455, 26, 1.5, 0, 37, 700, 800, 0.2, 85, 0, 300] },
  parmesan:     { n: "Grated parmesan", u: "tbsp", up: "tbsp", a: "dairy", pkg: 45, pl: "8 oz tub", p: [2.99, 3.47, 5.49], keep: "fridge",
                  nu: [21, 1.9, 0.2, 0, 1.4, 76, 55, 0, 6, 0, 10] },
  yogurt:       { n: "Plain Greek yogurt", u: "cup", up: "cups", a: "dairy", pkg: 4, pl: "32 oz tub (4 cups)", p: [3.49, 3.97, 5.99], keep: "fresh",
                  nu: [130, 23, 9, 0, 0.7, 85, 250, 0.2, 340, 0, 0] },
  feta:         { n: "Crumbled feta", u: "oz", up: "oz", a: "dairy", pkg: 4, pl: "4 oz tub", p: [2.29, 2.48, 3.99], keep: "fridge",
                  nu: [75, 4, 1.2, 0, 6, 320, 140, 0.2, 18, 0, 35] },
  butter:       { n: "Butter", u: "tbsp", up: "tbsp", a: "dairy", pkg: 32, pl: "1 lb (4 sticks)", p: [3.49, 3.97, 5.49], keep: "pantry", staple: true,
                  nu: [102, 0.1, 0, 0, 11.5, 90, 3, 0, 3, 0, 97] },

  // Bread & tortillas
  flourTortilla:{ n: "Flour tortillas (8 in)", u: "tortilla", up: "tortillas", a: "bakery", pkg: 10, pl: "10-count", p: [1.89, 2.18, 3.29], keep: "fridge",
                  nu: [140, 4, 24, 1, 3.5, 340, 60, 1.4, 60, 0, 0] },
  cornTortilla: { n: "Corn tortillas", u: "tortilla", up: "tortillas", a: "bakery", pkg: 30, pl: "30-count", p: [1.79, 1.98, 2.99], keep: "fridge",
                  nu: [52, 1.4, 11, 1.5, 0.7, 10, 20, 0.3, 40, 0, 0] },
  bread:        { n: "Whole wheat bread", u: "slice", up: "slices", a: "bakery", pkg: 20, pl: "loaf (~20 slices)", p: [1.69, 2.28, 3.99], keep: "fresh",
                  nu: [80, 4, 14, 2, 1, 140, 40, 0.9, 80, 0, 0] },

  // Pantry & canned
  blackBeans:   { n: "Black beans", u: "can", up: "cans", a: "pantry", pkg: 1, pl: "15 oz can", p: [0.79, 0.88, 1.39], keep: "pantry",
                  nu: [350, 21, 63, 24, 1.5, 1000, 120, 5, 1100, 0, 0] },
  chickpeas:    { n: "Chickpeas", u: "can", up: "cans", a: "pantry", pkg: 1, pl: "15 oz can", p: [0.79, 0.88, 1.39], keep: "pantry",
                  nu: [380, 18, 60, 17, 7, 800, 100, 4, 500, 0, 0] },
  dicedTomato:  { n: "Diced tomatoes", u: "can", up: "cans", a: "pantry", pkg: 1, pl: "14.5 oz can", p: [0.75, 0.88, 1.49], keep: "pantry",
                  nu: [90, 4, 18, 5, 0.5, 600, 100, 3, 800, 35, 80] },
  marinara:     { n: "Marinara sauce", u: "cup", up: "cups", a: "pantry", pkg: 2.75, pl: "24 oz jar", p: [1.79, 1.98, 3.49], keep: "pantry",
                  nu: [100, 3, 16, 4, 3, 900, 60, 1.8, 700, 18, 50] },
  salsa:        { n: "Salsa", u: "cup", up: "cups", a: "pantry", pkg: 2, pl: "16 oz jar", p: [1.79, 2.12, 3.29], keep: "pantry",
                  nu: [70, 3, 14, 4, 0.4, 1500, 70, 1, 700, 8, 60] },
  coconutMilk:  { n: "Light coconut milk", u: "can", up: "cans", a: "pantry", pkg: 1, pl: "13.5 oz can", p: [1.19, 1.48, 2.49], keep: "pantry",
                  nu: [420, 4, 7, 0, 42, 50, 40, 3, 400, 0, 0] },
  broth:        { n: "Reduced-sodium chicken broth", u: "cup", up: "cups", a: "pantry", pkg: 4, pl: "32 oz carton", p: [1.49, 1.68, 2.79], keep: "pantry",
                  nu: [15, 2, 1, 0, 0.5, 500, 5, 0.2, 60, 0, 0] },
  tuna:         { n: "Chunk light tuna", u: "can", up: "cans", a: "pantry", pkg: 1, pl: "5 oz can", p: [0.89, 0.98, 1.59], keep: "pantry",
                  nu: [120, 26, 0, 0, 1, 360, 15, 1.5, 200, 0, 20] },
  pasta:        { n: "Pasta (spaghetti or penne)", u: "oz", up: "oz", a: "pantry", pkg: 16, pl: "1 lb box", p: [0.95, 1.18, 1.89], keep: "pantry",
                  nu: [105, 3.7, 21, 0.9, 0.4, 2, 5, 1, 45, 0, 0] },
  brownRice:    { n: "Brown rice", u: "cup dry", up: "cups dry", a: "pantry", pkg: 4.5, pl: "2 lb bag", p: [1.69, 1.98, 3.29], keep: "pantry",
                  nu: [690, 15, 145, 6.5, 5.5, 10, 45, 2.8, 420, 0, 0] },
  quinoa:       { n: "Quinoa", u: "cup dry", up: "cups dry", a: "pantry", pkg: 2, pl: "12 oz bag", p: [2.99, 3.48, 4.99], keep: "pantry",
                  nu: [626, 24, 109, 12, 10, 8, 80, 7.8, 960, 0, 2] },
  lentils:      { n: "Dry lentils", u: "cup", up: "cups", a: "pantry", pkg: 2.25, pl: "1 lb bag", p: [1.29, 1.48, 2.29], keep: "pantry",
                  nu: [676, 47, 121, 21, 2, 12, 67, 12.5, 1300, 8, 4] },
  oats:         { n: "Rolled oats", u: "cup", up: "cups", a: "pantry", pkg: 5, pl: "18 oz canister", p: [1.99, 2.24, 3.99], keep: "pantry",
                  nu: [300, 10.5, 54, 8, 5, 5, 42, 3.4, 290, 0, 0] },
  peanutButter: { n: "Peanut butter", u: "tbsp", up: "tbsp", a: "pantry", pkg: 28, pl: "16 oz jar", p: [1.89, 2.12, 3.49], keep: "pantry",
                  nu: [95, 3.5, 3.6, 0.9, 8, 70, 7, 0.3, 100, 0, 0] },
  honey:        { n: "Honey", u: "tbsp", up: "tbsp", a: "pantry", pkg: 24, pl: "12 oz bottle", p: [3.49, 3.64, 5.49], keep: "pantry", staple: true,
                  nu: [64, 0.1, 17, 0, 0, 1, 1, 0.1, 11, 0.1, 0] },
  soySauce:     { n: "Low-sodium soy sauce", u: "tbsp", up: "tbsp", a: "pantry", pkg: 20, pl: "10 oz bottle", p: [1.29, 1.58, 2.49], keep: "pantry", staple: true,
                  nu: [9, 1, 1, 0.1, 0, 530, 3, 0.3, 35, 0, 0] },

  // Frozen
  peas:         { n: "Frozen peas", u: "cup", up: "cups", a: "frozen", pkg: 2.5, pl: "12 oz bag", p: [0.99, 1.12, 2.19], keep: "pantry",
                  nu: [105, 7, 19, 6, 0.5, 145, 30, 2, 150, 24, 100] },
  berries:      { n: "Frozen mixed berries", u: "cup", up: "cups", a: "frozen", pkg: 3.5, pl: "16 oz bag", p: [2.49, 2.78, 4.49], keep: "pantry",
                  nu: [70, 1, 17, 4, 0.5, 1, 20, 0.5, 140, 30, 5] },

  // Oils & spices (pantry staples)
  oliveOil:     { n: "Olive oil", u: "tbsp", up: "tbsp", a: "spices", pkg: 34, pl: "17 oz bottle", p: [4.99, 5.47, 8.99], keep: "pantry", staple: true,
                  nu: [119, 0, 0, 0, 13.5, 0, 0, 0.1, 0, 0, 0] },
  chiliPowder:  { n: "Chili powder", u: "tsp", up: "tsp", a: "spices", pkg: 40, pl: "jar", p: [0.99, 1.24, 2.49], keep: "pantry", staple: true,
                  nu: [8, 0.4, 1.4, 0.9, 0.4, 77, 9, 0.4, 50, 0, 40] },
  cumin:        { n: "Ground cumin", u: "tsp", up: "tsp", a: "spices", pkg: 40, pl: "jar", p: [0.99, 1.24, 2.49], keep: "pantry", staple: true,
                  nu: [8, 0.4, 0.9, 0.2, 0.5, 4, 20, 1.3, 37, 0, 1] },
  curryPowder:  { n: "Curry powder", u: "tsp", up: "tsp", a: "spices", pkg: 40, pl: "jar", p: [1.29, 1.48, 2.99], keep: "pantry", staple: true,
                  nu: [7, 0.3, 1.1, 1.1, 0.3, 1, 10, 0.6, 30, 0, 1] },
  italianSeasoning: { n: "Italian seasoning", u: "tsp", up: "tsp", a: "spices", pkg: 40, pl: "jar", p: [0.99, 1.24, 2.49], keep: "pantry", staple: true,
                  nu: [3, 0.1, 0.6, 0.4, 0.1, 1, 20, 0.5, 20, 0, 5] },
};

/*
  Recipes. Quantities are for `serves` people; the planner scales them to the
  household size. `meal` is breakfast, lunch or dinner.
*/
BW.RECIPES = [
  {
    id: "chicken-fajitas", name: "Sheet-Pan Chicken Fajitas", meal: "dinner", serves: 4, mins: 30, emoji: "🌮",
    tags: ["high-protein"],
    ing: [["chickenBreast", 1], ["bellPepper", 2], ["onion", 1], ["flourTortilla", 8], ["lime", 1], ["cilantro", 0.5], ["yogurt", 0.5], ["chiliPowder", 2], ["cumin", 1], ["oliveOil", 2]],
    steps: [
      "Heat oven to 425°F. Slice chicken, peppers and onion into strips.",
      "Toss everything on a sheet pan with oil, chili powder, cumin and a pinch of salt.",
      "Roast 20 minutes, until chicken is cooked through. Squeeze lime over the top.",
      "Serve in warm tortillas with cilantro and a spoonful of Greek yogurt (it stands in for sour cream).",
    ],
  },
  {
    id: "burrito-bowls", name: "Chicken Burrito Bowls", meal: "dinner", serves: 4, mins: 35, emoji: "🥙",
    tags: ["high-protein", "high-fiber"],
    ing: [["chickenBreast", 1], ["brownRice", 1], ["blackBeans", 1], ["bellPepper", 1], ["cilantro", 0.5], ["lime", 1], ["salsa", 0.5], ["cheddar", 0.5], ["chiliPowder", 2], ["oliveOil", 1]],
    steps: [
      "Cook brown rice according to the package (about 30 minutes).",
      "Season chicken with chili powder and salt, then cook in oil over medium-high heat 6–7 minutes per side. Slice.",
      "Sauté diced pepper 3 minutes. Warm the drained black beans.",
      "Build bowls: rice, beans, chicken, peppers, salsa, cheddar, cilantro and a squeeze of lime.",
    ],
  },
  {
    id: "turkey-chili", name: "One-Pot Turkey Chili", meal: "dinner", serves: 4, mins: 40, emoji: "🌶️",
    tags: ["high-protein", "high-fiber", "lower-carb"],
    ing: [["groundTurkey", 1], ["blackBeans", 1], ["dicedTomato", 2], ["onion", 1], ["bellPepper", 1], ["garlic", 2], ["cheddar", 0.5], ["chiliPowder", 3], ["cumin", 2], ["oliveOil", 1]],
    steps: [
      "Cook diced onion and pepper in oil for 5 minutes. Add garlic for 1 minute.",
      "Add turkey and brown it, breaking it up as it cooks.",
      "Stir in spices, tomatoes and drained beans. Simmer 20 minutes.",
      "Top bowls with cheddar. Leftovers freeze well.",
    ],
  },
  {
    id: "black-bean-tacos", name: "Crispy Black Bean Tacos", meal: "dinner", serves: 4, mins: 20, emoji: "🫘",
    tags: ["vegetarian", "high-fiber", "under-30"],
    ing: [["blackBeans", 2], ["cornTortilla", 12], ["avocado", 1], ["cilantro", 0.5], ["lime", 1], ["salsa", 0.5], ["onion", 0.5], ["cheddar", 0.5], ["cumin", 1], ["oliveOil", 1]],
    steps: [
      "Mash half the beans with cumin and a pinch of salt. Stir in the rest of the beans.",
      "Warm tortillas in a dry skillet, fill with beans and cheddar, fold and crisp in a little oil.",
      "Top with diced avocado, onion, cilantro, salsa and lime.",
    ],
  },
  {
    id: "spaghetti-meat-sauce", name: "Spaghetti with Meat Sauce & Spinach", meal: "dinner", serves: 4, mins: 25, emoji: "🍝",
    tags: ["high-protein", "under-30"],
    ing: [["pasta", 12], ["groundBeef", 1], ["marinara", 2.75], ["onion", 0.5], ["garlic", 2], ["spinach", 2], ["parmesan", 4]],
    steps: [
      "Boil pasta in salted water. Save a cup of the pasta water before draining.",
      "Brown beef with diced onion. Add garlic for 1 minute, then pour in the marinara.",
      "Stir in spinach until wilted. Loosen with pasta water if needed.",
      "Toss with pasta and top with parmesan.",
    ],
  },
  {
    id: "salmon-sheet-pan", name: "Sheet-Pan Salmon, Sweet Potato & Broccoli", meal: "dinner", serves: 4, mins: 35, emoji: "🐟",
    tags: ["high-protein", "gluten-free"],
    ing: [["salmon", 1], ["sweetPotato", 2], ["broccoli", 3], ["lemon", 1], ["garlic", 2], ["oliveOil", 2]],
    steps: [
      "Heat oven to 425°F. Cube sweet potatoes, toss with 1 tbsp oil and roast 15 minutes.",
      "Add broccoli and salmon to the pan. Brush with remaining oil mixed with minced garlic.",
      "Roast 12–15 minutes more, until salmon flakes. Finish with lemon juice.",
    ],
  },
  {
    id: "chicken-stir-fry", name: "Chicken & Broccoli Stir-Fry", meal: "dinner", serves: 4, mins: 30, emoji: "🥦",
    tags: ["high-protein"],
    ing: [["chickenBreast", 1], ["broccoli", 3], ["carrot", 2], ["brownRice", 1], ["soySauce", 3], ["honey", 1], ["garlic", 3], ["greenOnion", 0.5], ["oliveOil", 1]],
    steps: [
      "Start the brown rice.",
      "Stir-fry bite-size chicken in oil until browned, about 6 minutes. Set aside.",
      "Stir-fry broccoli and sliced carrots 4 minutes. Add garlic.",
      "Return chicken, add soy sauce and honey, toss 1 minute. Top with green onions and serve over rice.",
    ],
  },
  {
    id: "veggie-fried-rice", name: "Veggie Fried Rice with Egg", meal: "dinner", serves: 4, mins: 25, emoji: "🍳",
    tags: ["vegetarian", "under-30"],
    ing: [["brownRice", 1.5], ["eggs", 4], ["peas", 1], ["carrot", 2], ["greenOnion", 0.5], ["soySauce", 3], ["garlic", 2], ["oliveOil", 2]],
    steps: [
      "Use cold, cooked rice if you have it. Otherwise cook it and spread it out to cool.",
      "Scramble eggs in 1 tbsp oil and set aside.",
      "Stir-fry diced carrots, peas and garlic 3 minutes in the remaining oil.",
      "Add rice and soy sauce, fry until hot and a little crispy. Fold in eggs and green onions.",
    ],
  },
  {
    id: "lentil-soup", name: "Hearty Lentil & Spinach Soup", meal: "dinner", serves: 4, mins: 45, emoji: "🥣",
    tags: ["vegetarian", "high-fiber", "high-protein"],
    ing: [["lentils", 1.5], ["carrot", 2], ["celery", 2], ["onion", 1], ["dicedTomato", 1], ["broth", 4], ["spinach", 2], ["garlic", 2], ["cumin", 1], ["oliveOil", 1]],
    steps: [
      "Cook diced onion, carrot and celery in oil for 6 minutes. Add garlic and cumin.",
      "Add rinsed lentils, tomatoes and broth. Simmer 30 minutes, until lentils are tender.",
      "Stir in spinach and season with salt, pepper and a squeeze of lemon if you have one.",
    ],
  },
  {
    id: "chicken-noodle-soup", name: "Weeknight Chicken Noodle Soup", meal: "dinner", serves: 4, mins: 35, emoji: "🍜",
    tags: ["high-protein"],
    ing: [["chickenThigh", 1], ["carrot", 3], ["celery", 3], ["onion", 1], ["pasta", 6], ["broth", 8], ["garlic", 2], ["italianSeasoning", 1], ["oliveOil", 1]],
    steps: [
      "Cook diced onion, carrot and celery in oil 6 minutes. Add garlic and seasoning.",
      "Add broth and whole chicken thighs. Simmer 15 minutes, then shred the chicken.",
      "Add pasta and cook until tender, about 8 minutes. Return the chicken to the pot.",
    ],
  },
  {
    id: "loaded-potatoes", name: "Loaded Broccoli Cheddar Potatoes", meal: "dinner", serves: 4, mins: 50, emoji: "🥔",
    tags: ["vegetarian", "gluten-free"],
    ing: [["potato", 4], ["broccoli", 2], ["cheddar", 1], ["yogurt", 0.5], ["greenOnion", 0.5], ["oliveOil", 1]],
    steps: [
      "Rub potatoes with oil and salt. Bake at 425°F for 45 minutes (or microwave 10–12 minutes).",
      "Steam broccoli 4 minutes.",
      "Split potatoes, fluff, and top with broccoli, cheddar, Greek yogurt and green onions.",
    ],
  },
  {
    id: "chickpea-curry", name: "Chickpea Coconut Curry", meal: "dinner", serves: 4, mins: 30, emoji: "🍛",
    tags: ["vegetarian", "high-fiber", "gluten-free"],
    ing: [["chickpeas", 2], ["coconutMilk", 1], ["dicedTomato", 1], ["spinach", 3], ["onion", 1], ["garlic", 3], ["brownRice", 1], ["curryPowder", 3], ["oliveOil", 1]],
    steps: [
      "Start the brown rice.",
      "Cook diced onion in oil 5 minutes. Add garlic and curry powder for 1 minute.",
      "Add chickpeas, tomatoes and coconut milk. Simmer 15 minutes.",
      "Stir in spinach until wilted. Serve over rice.",
    ],
  },
  {
    id: "beef-tacos", name: "Classic Beef Tacos", meal: "dinner", serves: 4, mins: 20, emoji: "🌮",
    tags: ["high-protein", "under-30"],
    ing: [["groundBeef", 1], ["cornTortilla", 12], ["cheddar", 0.5], ["tomato", 2], ["onion", 0.5], ["cilantro", 0.5], ["lime", 1], ["chiliPowder", 2], ["cumin", 1]],
    steps: [
      "Brown beef with half the diced onion. Drain fat.",
      "Add chili powder, cumin, salt and ¼ cup water. Simmer 5 minutes.",
      "Warm tortillas and fill with beef, cheddar, diced tomato, onion, cilantro and lime.",
    ],
  },
  {
    id: "turkey-zucchini-pasta", name: "Lemon Garlic Turkey & Zucchini Pasta", meal: "dinner", serves: 4, mins: 25, emoji: "🍋",
    tags: ["high-protein", "under-30"],
    ing: [["pasta", 12], ["groundTurkey", 1], ["zucchini", 2], ["garlic", 3], ["lemon", 1], ["parmesan", 4], ["spinach", 2], ["oliveOil", 2]],
    steps: [
      "Boil pasta. Save a cup of the pasta water.",
      "Brown turkey in 1 tbsp oil. Add diced zucchini and garlic and cook 5 minutes.",
      "Add spinach, lemon zest and juice, pasta, and a splash of pasta water.",
      "Toss with parmesan and the remaining oil.",
    ],
  },
  {
    id: "greek-chicken", name: "Greek Chicken & Potato Sheet Pan", meal: "dinner", serves: 4, mins: 45, emoji: "🫒",
    tags: ["high-protein", "gluten-free"],
    ing: [["chickenThigh", 1.5], ["potato", 3], ["zucchini", 1], ["onion", 1], ["lemon", 1], ["feta", 2], ["yogurt", 0.5], ["cucumber", 0.5], ["italianSeasoning", 2], ["oliveOil", 2]],
    steps: [
      "Heat oven to 425°F. Cut potatoes into wedges, toss with oil and seasoning and roast 15 minutes.",
      "Add chicken, zucchini and onion wedges. Roast 25 minutes more.",
      "Stir grated cucumber, lemon juice and salt into the yogurt for a quick tzatziki.",
      "Finish with feta and serve with the tzatziki.",
    ],
  },
  {
    id: "stuffed-sweet-potatoes", name: "Black Bean Stuffed Sweet Potatoes", meal: "dinner", serves: 4, mins: 45, emoji: "🍠",
    tags: ["vegetarian", "high-fiber", "gluten-free"],
    ing: [["sweetPotato", 4], ["blackBeans", 1], ["salsa", 0.5], ["avocado", 1], ["yogurt", 0.5], ["cilantro", 0.5], ["lime", 1], ["cumin", 1]],
    steps: [
      "Bake sweet potatoes at 425°F for 40 minutes (or microwave 8–10 minutes).",
      "Warm beans with cumin and salsa.",
      "Split potatoes and stuff with beans. Top with avocado, yogurt, cilantro and lime.",
    ],
  },
  {
    id: "shakshuka", name: "Easy Shakshuka with Spinach", meal: "dinner", serves: 4, mins: 30, emoji: "🍅",
    tags: ["vegetarian", "lower-carb"],
    ing: [["eggs", 8], ["dicedTomato", 2], ["onion", 1], ["bellPepper", 1], ["spinach", 2], ["feta", 2], ["bread", 4], ["garlic", 2], ["cumin", 1], ["oliveOil", 2]],
    steps: [
      "Cook diced onion and pepper in oil 6 minutes. Add garlic and cumin.",
      "Add tomatoes and simmer 8 minutes. Stir in spinach.",
      "Make 8 wells, crack in the eggs, cover and cook 6–8 minutes until whites set.",
      "Top with feta and serve with toast.",
    ],
  },

  // Lunch
  {
    id: "tuna-sandwiches", name: "Greek Yogurt Tuna Sandwiches", meal: "lunch", serves: 4, mins: 10, emoji: "🥪",
    tags: ["high-protein", "under-30"],
    ing: [["tuna", 3], ["yogurt", 0.5], ["celery", 2], ["lemon", 0.5], ["bread", 8], ["spinach", 1], ["cucumber", 1]],
    steps: [
      "Mix drained tuna with yogurt, diced celery, lemon juice, salt and pepper.",
      "Pile onto bread with spinach leaves.",
      "Serve with sliced cucumber on the side.",
    ],
  },
  {
    id: "quinoa-salad", name: "Greek Quinoa & Chickpea Salad", meal: "lunch", serves: 4, mins: 25, emoji: "🥗",
    tags: ["vegetarian", "high-fiber", "gluten-free"],
    ing: [["quinoa", 1], ["chickpeas", 1], ["cucumber", 1], ["tomato", 2], ["feta", 2], ["lemon", 1], ["oliveOil", 3]],
    steps: [
      "Cook quinoa and let it cool a few minutes.",
      "Dice cucumber and tomatoes. Rinse the chickpeas.",
      "Toss everything with lemon juice, olive oil, salt and feta. Keeps 4 days in the fridge.",
    ],
  },
  {
    id: "bean-quesadillas", name: "Spinach & Bean Quesadillas", meal: "lunch", serves: 4, mins: 15, emoji: "🧀",
    tags: ["vegetarian", "high-fiber", "under-30"],
    ing: [["flourTortilla", 8], ["blackBeans", 1], ["spinach", 2], ["cheddar", 1], ["salsa", 0.5]],
    steps: [
      "Lightly mash beans. Spread on 4 tortillas and top with spinach and cheddar.",
      "Cover with the other tortillas and cook in a dry skillet 2–3 minutes per side.",
      "Cut into wedges and serve with salsa.",
    ],
  },
  {
    id: "chicken-wraps", name: "Chicken, Pepper & Hummus-Style Wraps", meal: "lunch", serves: 4, mins: 20, emoji: "🌯",
    tags: ["high-protein", "under-30"],
    ing: [["chickenBreast", 0.75], ["flourTortilla", 4], ["chickpeas", 1], ["lemon", 1], ["bellPepper", 1], ["spinach", 2], ["garlic", 1], ["oliveOil", 2]],
    steps: [
      "Blend or mash chickpeas with lemon juice, garlic, olive oil and salt into a quick spread.",
      "Cook sliced chicken in a skillet until done, about 8 minutes.",
      "Spread tortillas, add chicken, sliced pepper and spinach, then roll up.",
    ],
  },

  // Breakfast
  {
    id: "overnight-oats", name: "Berry Overnight Oats", meal: "breakfast", serves: 4, mins: 5, emoji: "🫐",
    tags: ["vegetarian", "high-fiber", "under-30"],
    ing: [["oats", 2], ["milk", 2], ["yogurt", 1], ["berries", 2], ["honey", 2]],
    steps: [
      "Stir oats, milk, yogurt and honey together in 4 jars.",
      "Top with berries (frozen is fine, they thaw overnight).",
      "Refrigerate overnight. Eat cold or warmed.",
    ],
  },
  {
    id: "spinach-scramble", name: "Spinach Cheddar Scramble & Toast", meal: "breakfast", serves: 4, mins: 10, emoji: "🍳",
    tags: ["vegetarian", "high-protein", "under-30"],
    ing: [["eggs", 8], ["spinach", 2], ["cheddar", 0.5], ["bread", 4], ["butter", 1]],
    steps: [
      "Wilt spinach in butter over medium heat.",
      "Add beaten eggs and stir gently until just set. Fold in cheddar.",
      "Serve with toast.",
    ],
  },
  {
    id: "pb-banana-toast", name: "Peanut Butter Banana Toast", meal: "breakfast", serves: 4, mins: 5, emoji: "🍌",
    tags: ["vegetarian", "under-30"],
    ing: [["bread", 8], ["peanutButter", 8], ["banana", 4], ["milk", 4]],
    steps: [
      "Toast the bread.",
      "Spread with peanut butter and top with sliced banana.",
      "Serve with a glass of milk.",
    ],
  },
  {
    id: "egg-muffins", name: "Make-Ahead Veggie Egg Muffins", meal: "breakfast", serves: 4, mins: 30, emoji: "🧁",
    tags: ["vegetarian", "high-protein", "lower-carb", "gluten-free"],
    ing: [["eggs", 10], ["bellPepper", 1], ["spinach", 2], ["onion", 0.5], ["cheddar", 0.5], ["milk", 0.25]],
    steps: [
      "Heat oven to 350°F and grease a 12-cup muffin tin.",
      "Divide chopped pepper, spinach, onion and cheddar among the cups.",
      "Whisk eggs with milk and salt, pour over the veggies and bake 20 minutes.",
      "Keeps 4 days in the fridge. Reheat 30 seconds.",
    ],
  },
  {
    id: "yogurt-parfait", name: "Berry Yogurt Parfaits", meal: "breakfast", serves: 4, mins: 5, emoji: "🍓",
    tags: ["vegetarian", "high-protein", "under-30"],
    ing: [["yogurt", 3], ["berries", 2], ["oats", 1], ["honey", 2]],
    steps: [
      "Toast oats in a dry skillet 3 minutes for crunch (optional).",
      "Layer yogurt, berries and oats in glasses.",
      "Drizzle with honey.",
    ],
  },
];

BW.TAGS = {
  vegetarian: "Vegetarian",
  "high-protein": "High protein",
  "high-fiber": "High fiber",
  "lower-carb": "Lower carb",
  "gluten-free": "Gluten-free",
  "under-30": "30 min or less",
};

// Carb goals, grams per person per day.
BW.CARB_GOALS = {
  standard: { label: "Standard (275 g/day)", g: 275 },
  moderate: { label: "Moderate (130 g/day)", g: 130 },
  lower: { label: "Lower-carb (100 g/day)", g: 100 },
};
