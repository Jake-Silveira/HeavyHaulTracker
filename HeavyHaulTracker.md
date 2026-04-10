# Heavy Haul Move Control System

## Overview

This is a **production-ready transit tracking application** built using the **Vercel + Supabase** free-tier architecture — completely within $0/month hosting costs.

**Architecture Pattern:**
```
Browser (Carrier Owner / Dispatcher)
   ↓
Static Frontend (Vercel - Free)
   ↓
Supabase Client SDK (JS from CDN)
   ↓
Supabase Services (Free Tier):
  - PostgreSQL Database (500MB)
  - Authentication (50,000 MAU)
  - Row Level Security (RLS)
   ↓
Vercel Serverless Functions (Free - 100k invocations/month):
  - Secure webhooks, email, or other server-side operations
```

**Monthly Cost: $0** 🎉

---

## The Goal

When a carrier owner sees this, they should think:

*"This looks like it was built specifically for our kind of moves."*

If you hit that, you win.

---

## Core Application Pages (4)

### 1. Move Intake (Public Form)

Fields:
- Customer Name
- Origin
- Destination
- Load Width
- Load Height
- Load Weight
- Number of States Crossing
- Required Delivery Date

Auto-calculations:
- If width > X → Escort Required = Yes
- If multi-state → Permit Status = Pending

That makes it feel smart.

### 2. Dispatch Dashboard (Main View)

Grid layout showing:

**Each Move Card:**
- Load ID
- Origin → Destination
- Permit Status (Badge: Pending / Approved / Expiring)
- Escort Status (Not Scheduled / Scheduled / Confirmed)
- Document Checklist (3–4 items)
- Overall Status (Intake / Permits / Ready / In Transit / Complete)

Color-coded badges.

This alone looks powerful.

### 3. Permit Tracker View

Table showing:
- Move
- States Required
- Permit Status per State
- Expiration Date
- Visual Warning if expiring within 72 hours

This screams heavy haul awareness.

### 4. Document Control Panel

Checklist:
- Insurance Certificate
- Rate Confirmation
- Bill of Lading
- Escort Confirmation
- Route Plan

Each toggled complete.

Progress bar per move.

---

## "Impressive" Additions (High Impact, Low Effort)

### 1. Status Automation Logic

When:
- All documents complete
- Permits approved
- Escort confirmed

Auto-update Overall Status → "Ready for Dispatch"

That makes it feel intelligent.

### 2. KPI Header at Top

Top strip:
- Active Moves
- Pending Permits
- Moves Ready
- At-Risk Moves

Operators love high-level clarity.

### 3. Fake Realistic Data

Populate it with:
- 6–10 sample loads
- Realistic state combinations
- Varied widths and weights

No empty dashboards.

Empty dashboards look amateur.

---

## Core Concepts

### 1. Row Level Security (RLS)

**The Key Insight:** Instead of hiding database credentials behind a server, we use database-level access control.

```sql
-- Anonymous users can INSERT but not SELECT
CREATE POLICY "public_insert_moves" ON moves
FOR INSERT TO anon WITH CHECK (true);

-- Only authenticated users can SELECT
CREATE POLICY "admin_select_moves" ON moves
FOR SELECT TO authenticated USING (true);
```

**How it works:**
- Supabase provides two keys: `anon` (public) and `service_role` (secret)
- The `anon` key is **safe to expose in browser** because RLS restricts what it can do
- Every query is checked against RLS policies before execution
- Even if someone has the anon key, they can't bypass RLS

### 2. Supabase Authentication

Instead of custom auth with bcrypt and sessions:
```javascript
// Login - that's it!
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

// Check session
const { data: { session } } = await supabase.auth.getSession();

// Logout
await supabase.auth.signOut();
```

**Benefits:**
- No server-side session management
- No password hashing on your end
- Built-in token refresh
- Works across browser tabs

### 3. Vercel Serverless Functions

For things that **must** stay server-side (webhooks, secrets, rate limiting):

```javascript
// api/my-webhook.js
export default async function handler(req, res) {
  const secret = process.env.SECRET_KEY; // Never exposed to browser
  // Do something with secret...
  res.status(200).json({ success: true });
}
```

**Called from frontend:**
```javascript
fetch('/api/my-webhook', {
  method: 'POST',
  body: JSON.stringify({ data: 'value' })
});
```

---

## Tech Stack

- **Supabase backend** (PostgreSQL + Auth + RLS)
- **Vanilla JS frontend** (modular structure)
- **Vercel hosting** (static + serverless functions)

We leverage existing Supabase usage. Do not change stacks.

---

## Project Structure

```
TransitTrackingProject/
├── api/                          # Vercel serverless functions
│   └── webhook.js               # Secure server-side operations
├── index.html                   # Move intake form (source, uses env placeholders)
├── admin.html                   # Dispatch dashboard (source, uses env placeholders)
├── permits.html                 # Permit tracker (source, uses env placeholders)
├── documents.html               # Document control panel (source, uses env placeholders)
├── script.js                    # Form logic (uses Supabase SDK from CDN)
├── admin.js                     # Dashboard logic (uses Supabase Auth)
├── permits.js                   # Permit tracker logic
├── documents.js                 # Document panel logic
├── styles.css                   # Shared styles
├── build.js                     # Build script: copies assets + injects env vars into public/
├── vercel.json                  # Vercel deployment config
├── .env.example                 # Environment variable template
├── .env                         # Local env vars (gitignored!)
├── .gitignore                   # Excludes .env, public/, node_modules/
├── sql-migration.sql            # Database schema + RLS policies
├── VERCEL_SETUP.md              # Deployment guide
└── public/                      # Generated by build.js (gitignored)
    ├── index.html               # Intake form with env vars injected
    ├── admin.html               # Dashboard with env vars injected
    ├── permits.html             # Permit tracker with env vars injected
    ├── documents.html           # Document panel with env vars injected
    ├── script.js                # Copied from root
    ├── admin.js                 # Copied from root
    ├── permits.js               # Copied from root
    ├── documents.js             # Copied from root
    └── styles.css               # Copied from root
```

**Note:** The `public/` directory is generated by `build.js` and should be in `.gitignore`. Vercel serves the contents of this directory during deployment.

---

## Step-by-Step: Build This Project

### Phase 1: Supabase Setup (15 minutes)

#### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose your region (closest to your users)
3. Set database password (save it!)
4. Wait ~2 minutes for provisioning

#### 2. Get API Keys
- **Settings → API**
- Copy **Project URL** and **anon public key**
- Keep **service_role key** secret (only for serverless functions)

#### 3. Create Tables

```sql
-- Moves table
CREATE TABLE moves (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  customer_name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  width NUMERIC NOT NULL,
  height NUMERIC NOT NULL,
  weight NUMERIC NOT NULL,
  states_crossed INTEGER NOT NULL,
  delivery_date DATE NOT NULL,
  permit_status TEXT NOT NULL DEFAULT 'pending',
  escort_status TEXT NOT NULL DEFAULT 'not_scheduled',
  overall_status TEXT NOT NULL DEFAULT 'intake',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  move_id BIGINT REFERENCES moves(id) ON DELETE CASCADE,
  insurance_cert BOOLEAN DEFAULT false,
  rate_confirmation BOOLEAN DEFAULT false,
  bill_of_lading BOOLEAN DEFAULT false,
  escort_confirmation BOOLEAN DEFAULT false,
  route_plan BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin tracking (optional)
CREATE TABLE admin_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. Enable RLS

```sql
-- Enable RLS on all tables
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Public can submit intake forms
CREATE POLICY "public_insert_moves"
ON moves FOR INSERT TO anon WITH CHECK (true);

-- Authenticated can view/modify
CREATE POLICY "admin_select_moves"
ON moves FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_all_documents"
ON documents FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Service role full access (for serverless functions)
CREATE POLICY "service_role_all_moves"
ON moves FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_documents"
ON documents FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

#### 5. Create Admin User

1. **Authentication → Users** → Add User
2. Create user with email/password
3. Copy the **User ID** (UUID)
4. Add to admin_profiles:

```sql
INSERT INTO admin_profiles (id, email, role)
VALUES ('UUID_FROM_AUTH', 'admin@example.com', 'admin');
```

---

### Phase 2: Frontend Setup (30 minutes)

#### 1. Clone This Template

```bash
# Copy the project structure
cp -r FounderOpsAutomation my-new-project
cd my-new-project

# Remove old git history
rm -rf .git
git init
```

#### 2. Update HTML Files

**Add env placeholder block in `<head>` (before `</head>`):**
```html
<!-- ENV_PLACEHOLDER_START -->
<script id="env-script">
  window.__ENV__ = {
    SUPABASE_URL: '__SUPABASE_URL__',
    SUPABASE_ANON_KEY: '__SUPABASE_ANON_KEY__'
  };
</script>
<!-- ENV_PLACEHOLDER_END -->
```

**Add Supabase SDK + your scripts (before `</body>`):**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="script.js"></script>
```

**Important:** Never hardcode Supabase credentials in HTML files. The `build.js` script finds the `ENV_PLACEHOLDER` block and replaces it with real values from Vercel environment variables (or `.env` for local dev).

#### 3. Update build.js

The build script (`build.js`) does two things:
1. Copies static assets (`styles.css`, `script.js`, `admin.js`, `permits.js`, `documents.js`) into `public/`
2. Finds the `<!-- ENV_PLACEHOLDER_START -->` ... `<!-- ENV_PLACEHOLDER_END -->` block in HTML files and replaces it with actual env var values

For local development, the script loads `.env` if present. On Vercel, it uses build-time environment variables.

#### 4. Update vercel.json

```json
{
  "version": 2,
  "buildCommand": "node build.js",
  "outputDirectory": "public",
  "functions": {
    "api/*.js": {
      "maxDuration": 10
    }
  },
  "rewrites": [
    { "source": "/admin", "destination": "/admin.html" },
    { "source": "/permits", "destination": "/permits.html" },
    { "source": "/documents", "destination": "/documents.html" }
  ]
}
```

**Important:** The `buildCommand` must be `"node build.js"` and `outputDirectory` must be `"public"`. The build script outputs all static files and processed HTML into the `public/` directory which Vercel serves. Rewrites let users access different pages at clean URLs.

#### 5. Update script.js (Move Intake Form)

**Initialize Supabase client:**
```javascript
const supabaseClient = window.supabase.createClient(
  window.__ENV__.SUPABASE_URL,
  window.__ENV__.SUPABASE_ANON_KEY
);
```

**Auto-calculate fields:**
```javascript
function checkEscortRequired(width) {
  const ESCORT_THRESHOLD = 12; // feet
  return width > ESCORT_THRESHOLD ? 'Yes' : 'No';
}

function checkPermitStatus(statesCrossed) {
  return statesCrossed > 1 ? 'Pending' : 'Not Required';
}

// Submit form
async function submitMove(data) {
  const { data: result, error } = await supabaseClient
    .from('moves')
    .insert([{
      customer_name: data.customerName,
      origin: data.origin,
      destination: data.destination,
      width: data.width,
      height: data.height,
      weight: data.weight,
      states_crossed: data.statesCrossed,
      delivery_date: data.deliveryDate,
      permit_status: checkPermitStatus(data.statesCrossed),
      escort_status: checkEscortRequired(data.width) === 'Yes' ? 'not_scheduled' : 'confirmed',
      overall_status: 'intake'
    }])
    .select();

  if (error) throw error;
  return result;
}
```

#### 6. Update admin.js (Dispatch Dashboard)

**Use Supabase Auth:**
```javascript
// Login
const { data, error } = await supabaseClient.auth.signInWithPassword({
  email: emailInput.value,
  password: passwordInput.value
});

// Check session
const { data: { session } } = await supabaseClient.auth.getSession();

// Query moves (only works if authenticated due to RLS)
async function loadMoves() {
  const { data: moves } = await supabaseClient
    .from('moves')
    .select('*, documents(*)')
    .order('created_at', { ascending: false });
  return moves;
}

// Render KPI strip
function renderKPI(moves) {
  const activeMoves = moves.filter(m => m.overall_status !== 'complete').length;
  const pendingPermits = moves.filter(m => m.permit_status === 'pending').length;
  const movesReady = moves.filter(m => m.overall_status === 'ready').length;
  const atRisk = moves.filter(m => m.delivery_date && new Date(m.delivery_date) < new Date(Date.now() + 3 * 86400000)).length;
  
  return { activeMoves, pendingPermits, movesReady, atRisk };
}
```

#### 7. Update permits.js & documents.js

**Permit Tracker:**
```javascript
async function loadPermits() {
  const { data } = await supabaseClient
    .from('moves')
    .select('id, origin, destination, states_crossed, permit_status')
    .order('created_at', { ascending: false });
  return data;
}

function checkExpiringSoon(deliveryDate, days = 3) {
  const threshold = new Date(Date.now() + days * 86400000);
  return new Date(deliveryDate) < threshold;
}
```

**Document Panel:**
```javascript
async function updateDocuments(docId, updates) {
  const { data, error } = await supabaseClient
    .from('documents')
    .update(updates)
    .eq('id', docId)
    .select();
  if (error) throw error;
  return data;
}

// Auto-update overall status when all docs complete
async function checkMoveReady(moveId) {
  const { data: docs } = await supabaseClient
    .from('documents')
    .select('*')
    .eq('move_id', moveId)
    .single();
  
  const allComplete = docs.insurance_cert && docs.rate_confirmation && 
                      docs.bill_of_lading && docs.escort_confirmation && docs.route_plan;
  
  if (allComplete) {
    await supabaseClient
      .from('moves')
      .update({ overall_status: 'ready' })
      .eq('id', moveId);
  }
}
```

---

### Local Development Workflow

```bash
# 1. Copy env template and fill in values
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# 2. Run the build script
node build.js

# 3. Verify env vars were injected
grep -A 5 'window.__ENV__' public/index.html

# 4. Serve locally
npx serve .

# 5. Open http://localhost:3000
#    Admin dashboard at http://localhost:3000/admin
#    Permit tracker at http://localhost:3000/permits
#    Document panel at http://localhost:3000/documents
```

Every time you change `.env`, re-run `node build.js`. The script cleans and rebuilds the `public/` directory.

---

### Phase 3: Vercel Deployment (10 minutes)

#### 1. Set Environment Variables in Vercel

**Vercel Dashboard → Settings → Environment Variables:**

| Variable | Value | Environments |
|----------|-------|--------------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `SUPABASE_ANON_KEY` | `eyJhbG...` | All |
| `SECRET_KEY` | Your secret (if needed) | Production |

#### 2. Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Production deploy
vercel --prod
```

**Or use GitHub integration:**
1. Push code to GitHub
2. Vercel → New Project → Import from GitHub
3. Set env vars
4. Deploy!

---

## Build Order (No Scope Creep)

### Phase A: Supabase + Database
- Create tables
- Seed realistic data (6–10 sample loads)

### Phase B: Dispatch Dashboard UI
- Grid layout with move cards
- KPI header strip
- Color-coded status badges

### Phase C: Intake Form Logic
- Auto-calculate escort/permit requirements
- Form submission to Supabase

### Phase D: Status Automation
- Auto-update to "Ready for Dispatch" when all conditions met

### Phase E: Polish UI
- Badges, KPI strip, responsive layout
- Realistic seeded data throughout

**No more.**

---

## Seed Data Example

Populate with 6–10 realistic loads:

```sql
INSERT INTO moves (customer_name, origin, destination, width, height, weight, states_crossed, delivery_date, permit_status, escort_status, overall_status) VALUES
('ABC Manufacturing', 'Houston, TX', 'Atlanta, GA', 14.5, 12.0, 85000, 3, '2026-04-20', 'pending', 'scheduled', 'permits'),
('Steel Dynamics', 'Pittsburgh, PA', 'Chicago, IL', 10.0, 10.5, 62000, 2, '2026-04-15', 'approved', 'confirmed', 'ready'),
('Heavy Lift Co', 'Denver, CO', 'Phoenix, AZ', 16.0, 15.0, 120000, 2, '2026-04-18', 'pending', 'not_scheduled', 'intake'),
('Prime Movers', 'Dallas, TX', 'Charlotte, NC', 12.5, 11.0, 75000, 4, '2026-04-22', 'approved', 'scheduled', 'permits'),
('Mammoth Transport', 'Seattle, WA', 'Salt Lake City, UT', 11.0, 10.0, 55000, 2, '2026-04-12', 'approved', 'confirmed', 'in_transit'),
('Overland Freight', 'Miami, FL', 'Nashville, TN', 15.0, 13.5, 95000, 3, '2026-04-25', 'pending', 'not_scheduled', 'intake'),
('Giant Moves Inc', 'Detroit, MI', 'Boston, MA', 13.0, 12.0, 88000, 5, '2026-04-14', 'approved', 'confirmed', 'ready'),
('Superload Systems', 'Los Angeles, CA', 'Las Vegas, NV', 18.0, 16.0, 150000, 2, '2026-04-28', 'pending', 'not_scheduled', 'intake');
```

---

## Common Variations

### Variation 1: File Upload Form (Documents)

**Add Supabase Storage:**
```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('move-docs', 'move-docs', false);

-- RLS for storage
CREATE POLICY "authenticated_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'move-docs');
```

**Frontend upload:**
```javascript
const { data, error } = await supabaseClient.storage
  .from('move-docs')
  .upload(`moves/${moveId}/${file.name}`, file);
```

### Variation 2: Email Notifications

**Use serverless function + Resend/SendGrid:**
```javascript
// api/send-email.js
import { Resend } from 'resend';

export default async function handler(req, res) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'noreply@yourdomain.com',
    to: 'dispatch@yourcompany.com',
    subject: 'New Move Intake Submission',
    html: `<p>New move from ${req.body.customer_name}: ${req.body.origin} → ${req.body.destination}</p>`
  });

  res.status(200).json({ success: true });
}
```

### Variation 3: Public Tracking Link

**Allow anyone to view (no auth required):**
```sql
-- Public can SELECT moves (read-only)
CREATE POLICY "public_select_moves" ON moves
FOR SELECT TO anon USING (true);
```

---

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] RLS policies restrict anon access appropriately
- [ ] Service role key **never** in frontend code
- [ ] Supabase credentials injected via build script — never hardcoded in HTML
- [ ] Environment variables set in Vercel (not hardcoded in source)
- [ ] `.env` and `public/` in `.gitignore` (secrets and build output never committed)
- [ ] Discord webhooks/emails use serverless functions (not browser)
- [ ] Never use `process.env` in browser scripts (Node.js only)
- [ ] Input sanitization on both client and server
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Admin users created via Supabase Auth (not custom table)
- [ ] CORS configured correctly (automatic with Vercel)

---

## Cost Breakdown

### Free Tier Limits

| Service | Free Limit | Typical Usage | Overage Cost |
|---------|------------|---------------|--------------|
| **Vercel Hosting** | 100GB bandwidth | ~1-5GB/month | $20/mo for Pro |
| **Vercel Functions** | 100k invocations/mo | ~100-1000/mo | Included in Pro |
| **Supabase DB** | 500MB storage | ~10MB (10k rows) | $25/mo for Pro |
| **Supabase Auth** | 50,000 MAU | ~1-10 admins | Included in Pro |
| **Supabase Bandwidth** | 2GB/month | ~1GB/month | Included in Pro |

**Total Free Capacity:** ~10,000+ form submissions/month
**Typical Cost:** $0/month 🎉

### When to Upgrade

Upgrade to paid when:
- Exceeding 500MB database (archive old data first!)
- Need custom domains with SSL (Vercel Pro: $20/mo)
- Need team collaboration features
- Require priority support

---

## Time Estimate

If focused:
- **8–12 hours total**
- **3–4 focused sessions**

That is manageable even with a busy schedule.

---

## Troubleshooting Guide

### Problem: `process is not defined` or `window.__ENV__ is undefined`

**Cause:** A script is using `process.env` (Node.js only) in the browser, or the build script didn't run.

**Fix:**
1. Never use `process.env` in browser-facing JS files (`script.js`, `admin.js`, `permits.js`, `documents.js`)
2. Ensure HTML files have the `<!-- ENV_PLACEHOLDER_START -->` ... `<!-- ENV_PLACEHOLDER_END -->` block in `<head>`
3. Verify `vercel.json` has `"buildCommand": "node build.js"` and `"outputDirectory": "public"`
4. Check Vercel build logs to confirm the build script ran successfully
5. Set environment variables in Vercel Dashboard → Settings → Environment Variables
6. Test locally: `cp .env.example .env`, edit values, run `node build.js`, check `public/index.html` has real values injected

### Problem: Vercel build fails with "No Output Directory named public found"

**Cause:** The build script isn't creating the `public/` directory or `vercel.json` is misconfigured.

**Fix:**
1. Ensure `build.js` creates `public/` and copies all static files into it
2. Verify `vercel.json` has `"outputDirectory": "public"`
3. Test locally: `rm -rf public && node build.js && ls public/`

### Problem: Form submission fails

**Check:**
1. Browser console for errors
2. Supabase URL and anon key are correct
3. RLS policies allow INSERT for anon users
4. Network tab shows request reaching Supabase

**Fix:**
```sql
-- Verify RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'moves';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'moves';

-- Temporarily disable RLS for testing (DON'T leave this on!)
ALTER TABLE moves DISABLE ROW LEVEL SECURITY;
-- Test, then re-enable
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
```

### Problem: Admin can't login

**Check:**
1. User exists in Supabase Auth (Authentication → Users)
2. User has the correct password set
3. Session is being created

**Reset admin password via SQL:**
If the Supabase dashboard password reset email doesn't work, reset directly via SQL:

```sql
-- Requires pgcrypto extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET encrypted_password = crypt('your-new-secure-password', gen_salt('bf'))
WHERE email = 'admin@example.com';
```

**Debug login issues:**
```javascript
// Add debug logging in admin.js
const { data, error } = await supabase.auth.signInWithPassword({
  email, password
});
console.log('Login result:', data, error);
```

### Problem: Admin can't see moves

**Check:**
1. User is authenticated (check session)
2. RLS allows SELECT for authenticated users
3. Supabase query returns data in Table Editor

**Fix:**
```sql
-- Verify authenticated can SELECT
CREATE POLICY "admin_select" ON moves
FOR SELECT TO authenticated USING (true);
```

---

## Monitoring & Analytics

### Track Moves

```sql
-- Moves today
SELECT COUNT(*) FROM moves
WHERE created_at >= CURRENT_DATE;

-- Moves by status
SELECT overall_status, COUNT(*) FROM moves
GROUP BY overall_status;

-- Moves by week (last 30 days)
SELECT DATE(created_at) as date, COUNT(*)
FROM moves
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date ORDER BY date DESC;
```

### Vercel Analytics

- Enable in Vercel Dashboard → Analytics
- Track page views, function invocations
- Set up alerts for errors

---

## Migration Path: From Prototype to Production

### Stage 1: Local Development
```bash
# Test locally
npx serve .

# Or use Vercel dev mode
vercel dev
```

### Stage 2: Preview Deployment
```bash
# Deploy to Vercel preview
vercel

# Test with real Supabase (use test project)
```

### Stage 3: Production
```bash
# Deploy to production
vercel --prod

# Set up GitHub auto-deployments
# Configure custom domain (optional)
# Set up monitoring/alerts
```

---

## Strategic Outcome

When you show this:

You're no longer: *"Automation guy"*

You are: **"Heavy haul workflow system builder"**

That's positioning power.

---

## Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Vercel Docs](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

## Template Versions

| Version | Architecture | Status | Notes |
|---------|--------------|--------|-------|
| v1.0 | Express Server + Supabase Service Role | Deprecated | Requires paid server |
| v2.0 | Vercel Static + Supabase Anon + RLS | **Current** | Completely free! |

---

**Built with ❤️ using free tiers - because great tools shouldn't require a budget!**

---

*Last updated: April 2026*
