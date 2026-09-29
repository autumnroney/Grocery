# Basketwise

A zero-waste weekly meal planner. Pick simple recipes for the week and Basketwise:

- **Builds one grocery list.** Quantities are combined across recipes, rounded up to real package sizes, grouped by aisle, and checked off as you shop.
- **Reuses ingredients.** It flags perishable leftovers (half a bunch of cilantro, extra spinach) and suggests recipes that use them up, ranked by how little they add to the bill.
- **Counts nutrition.** Carbs (plus net carbs and 15 g carb choices), protein, fiber, fat, sodium, calcium, iron, potassium and vitamins A and C, per person, against FDA Daily Values. You can pick a carb goal, and it points out gaps with recipes that fill them.
- **Compares stores.** Your exact list is priced at Aldi, Walmart and Publix, with the cheapest store highlighted.

Light and dark mode follow the system setting, and a toggle in the header lets you choose.

## Pages

| Path | What it is |
| --- | --- |
| `index.html` | Landing page (shoppers + "For grocers" band with a Netlify Forms demo request) |
| `plan.html` (`/plan`) | The planner app: Plan, List, Nutrition, Stores |
| `thanks.html` | Demo request confirmation |
| `404.html` | Not-found page |

## Project layout

```
css/styles.css   design tokens, light/dark themes, shared components
css/app.css      planner styles
css/landing.css  landing page styles
js/theme.js      theme detection + toggle (saved in localStorage)
js/data.js       recipes, ingredients, nutrition and sample prices
js/app.js        planner logic
js/landing.js    landing interactions (calculator, pricing toggle)
```

Plain HTML/CSS/JS with no build step. The planner saves the week in the browser's `localStorage`.

### Adding a recipe

Add an entry to `BW.RECIPES` in `js/data.js`. Each ingredient is `[ingredientId, quantity]` in that ingredient's unit (`u`). Only use ingredients defined in `BW.INGREDIENTS`, or add new ones with their package size, prices and nutrition per unit. Recipes that share ingredients make the leftover suggestions work better.

## Data notes

- Nutrition values are estimates built from USDA FoodData Central averages for each ingredient. They are not medical advice.
- Store prices are **sample estimates**, not live prices. Connecting a real pricing source is the next step.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub**, and choose `autumnroney/Grocery`.
2. Branch: `main`. Leave the build command empty. Publish directory: `.` (already set in `netlify.toml`).
3. Deploy. Netlify redeploys every time you push to `main`.
4. Demo requests from the "For grocers" form show up under **Forms** in the Netlify dashboard. Turn on form detection if Netlify asks.
