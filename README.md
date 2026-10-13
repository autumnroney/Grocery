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
| `login.html` (`/login`) | Email sign-in (magic link) |
| `profile.html` (`/profile`) | Create or edit your profile |
| `admin.html` (`/admin`) | Admin console (administrators and employees) |
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
js/config.js     Supabase project URL + publishable key
js/auth.js       sign-in state, magic links, header account menu
js/login.js      sign-in page
js/profile.js    profile page
js/admin.js      admin console
css/admin.css    admin console styles
js/vendor/       supabase-js 2.117.3 (browser build, MIT)
css/auth.css     sign-in page + account menu styles
supabase/        database migrations + the `admin` edge function
```

Plain HTML/CSS/JS with no build step. The planner saves the week in the browser's `localStorage`, and also to the user's account when they're signed in.

## Accounts (Supabase)

Sign-in uses passwordless email: people enter their email, click the link we send, and land in the planner signed in. The same link creates a new account. The planner still works without an account.

- When someone is signed in, their week (meals, list check-offs, household size, carb goal, store) is saved to the `plans` table, one row per user, and loads on any device they sign in on.
- Row level security makes sure each user can only read and change their own row. The key in `js/config.js` is Supabase's publishable key, which is meant to be public.
- Signing out clears the plan stored on that device.

### Profiles

The first time someone signs in, the planner sends them to `profile.html` to set up a profile (they can skip it). They can edit it any time from the account menu. Profiles live in `public.profiles`, one row per user, and only the owner can read or change theirs:

| Field | Used for |
| --- | --- |
| `display_name` | Greeting and account button |
| `household_size` | Default servings for recipes and the grocery list |
| `carb_goal` | Default carb target on the Nutrition tab |
| `diet` | `vegetarian` / `gluten-free` limit suggestions and "Plan 5 dinners" to recipes that fit; the others pre-select recipe filters |
| `preferred_store` | Store the list is priced at (empty means the cheapest store each week) |
| `zip_code` | Saved for local store prices later |

Editing the profile resets the week's household size, carb goal and store to the new defaults. Changes made inside the planner for one week stay until the next profile edit.

### Supabase dashboard settings (required)

1. **Authentication → URL Configuration**: set **Site URL** to the Netlify address (e.g. `https://your-site.netlify.app`). Under **Redirect URLs**, add `https://your-site.netlify.app/**` and `http://localhost:8000/**`. Magic links only redirect to URLs on this list.
2. **Authentication → Emails → SMTP Settings**: Supabase's built-in email is for testing. It only delivers to your project's team members and sends a few emails an hour. Before launch, connect an email provider (Resend, Postmark, SendGrid, Amazon SES...).
3. Optional: **Authentication → Emails → Templates → Magic link**: change the wording to match Basketwise.

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

## Roles and the admin console

Every account has one role, stored in `public.user_roles`. New sign-ups are customers.

| Role | Can do |
| --- | --- |
| **Administrator** | Everything in the admin console: see all users, change roles, set passwords, change emails, suspend or unsuspend, sign a user out everywhere, delete accounts, invite users (as customer, employee or admin), view the activity log and site health |
| **Employee** | View the console (overview, health, users, activity log) and email a user a sign-in link. Every other action is shown but disabled |
| **Customer** | The planner only. Opening `/admin` shows "You don't have access" |

**How it stays secure:** the browser never gets admin powers. Every admin action is a request to the `admin` Supabase Edge Function (`supabase/functions/admin/index.ts`). It verifies the caller's session, looks up their role in the database, refuses anything the role doesn't allow, does the work with the project's secret key (which exists only on Supabase's servers), and writes the action to `public.admin_audit_log`. Admins can't suspend or delete themselves, and the last admin can't be demoted.

**The console shows:**
- **System health:** database connection and response time, Postgres version, connections in use, database size and uptime; the sign-in service's status and active sessions; the admin API's response time. You can refresh by hand or have it refresh every minute.
- **Usage:** total, new and active users, profiles set up, saved plans and meals, accounts that need attention, the most planned recipes, and popular diets and stores.
- **Users:** search, filter by role or suspended, export to CSV, and open any user to see their account, profile and plan, then act on it.
- **Activity log:** who did what to whom, and when.

To make someone an employee or admin, open them under **Users → Role**, or use **Invite user**.

To redeploy the function after editing it, use the Supabase CLI (`supabase functions deploy admin --no-verify-jwt`). The function checks the session itself, so it's deployed with gateway JWT verification turned off.
