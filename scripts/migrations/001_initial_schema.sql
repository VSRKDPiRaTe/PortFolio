-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  scripts/schema.sql — Database Schema                            ║
-- ╚═══════════════════════════════════════════════════════════════════╝
--
-- WHAT THIS FILE IS:
--   Defines all tables in the portfolio database.
--   Run once via: node --env-file=.env.development scripts/db-init.js
--   Safe to re-run — all statements use CREATE TABLE IF NOT EXISTS.
--
-- HOW TO RESET:
--   rm local.db
--   node --env-file=.env.development scripts/db-init.js
--   node --env-file=.env.development scripts/seed.js
--
-- TABLE OVERVIEW:
--   experience   → one row per job. bullets + tags as JSON arrays.
--   skill_tabs   → industry-standard skill category headings.
--   skills       → individual skills, each belonging to one tab.
--   projects     → GitHub repos (auto-synced) + manual entries.
--
-- SQLITE TYPE NOTES:
--   SQLite has no native BOOLEAN — use INTEGER 0/1.
--   SQLite has no native ARRAY  — use TEXT storing a JSON string.
--   unixepoch() returns current Unix timestamp as INTEGER.


-- ── experience ────────────────────────────────────────────────────
-- One row per job in the portfolio owner's work history.
--
-- bullets:
--   JSON array of bullet point strings typed in the owner interface.
--   Owner types one bullet per line in a textarea. The system splits
--   on newline and stores as a JSON array.
--   Example: ["Built REST APIs in Go", "Led IoT data ingestion"]
--
-- tags:
--   JSON array of technology and skill names. AI extracts these from
--   the bullet points. Owner can add/remove tags manually after extraction.
--   Example: ["Go", "Python", "Azure", "Kafka", "Docker"]
--
-- endDate:
--   NULL means the job is current (still employed there).
--   The owner interface shows "PRESENT" when endDate is NULL.
--
-- id (slug):
--   Auto-generated from company name in the owner interface.
--   URL-safe: lowercase, alphanumeric, hyphens only.
--   Used as the primary key — cannot change after creation without
--   deleting and recreating the entry.
CREATE TABLE IF NOT EXISTS experience (
  id          TEXT    PRIMARY KEY,
  role        TEXT    NOT NULL,
  company     TEXT    NOT NULL,
  location    TEXT    NOT NULL,
  startDate   TEXT    NOT NULL,        -- "YYYY-MM" e.g. "2025-03"
  endDate     TEXT,                    -- "YYYY-MM" or NULL if current
  current     INTEGER NOT NULL DEFAULT 0,
  bullets     TEXT    NOT NULL DEFAULT "[]",
  desc        TEXT    NOT NULL DEFAULT "",
  tags        TEXT    NOT NULL DEFAULT "[]",
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);


-- ── skill_tabs ────────────────────────────────────────────────────
-- Industry-standard tab headings for grouping skills.
-- These are factual groupings that match real industry practice.
-- Seeded once by seed.js — owner can add/rename via owner interface.
--
-- Standard tabs (seeded by seed.js):
--   languages  → LANGUAGES
--   frontend   → FRONTEND
--   mobile     → MOBILE
--   backend    → BACKEND & APIS
--   databases  → DATABASES
--   data       → DATA ENGINEERING
--   cloud      → CLOUD & DEVOPS
--   security   → SECURITY
--   testing    → TESTING
CREATE TABLE IF NOT EXISTS skill_tabs (
  id          TEXT    PRIMARY KEY,     -- slug e.g. "languages", "backend"
  label       TEXT    NOT NULL,        -- display text e.g. "BACKEND & APIS"
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);


-- ── skills ────────────────────────────────────────────────────────
-- One row per skill. Each skill belongs to one tab via tab_id.
--
-- Badge hierarchy (primary_skill + exposure combination):
--   primary_skill=1, exposure=0 → CORE       (green badge + animated bar)
--   primary_skill=0, exposure=0 → SUPPORTING (muted cyan badge + solid bar)
--   primary_skill=0, exposure=1 → EXPOSURE   (yellow badge + dashed bar, pct hidden)
--
-- pct:
--   Proficiency 0-100. Not shown for EXPOSURE skills.
--   CHECK constraint enforced at DB level — owner interface also validates.
--
-- ON DELETE CASCADE:
--   Deleting a skill_tab automatically deletes all skills under it.
CREATE TABLE IF NOT EXISTS skills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_id        TEXT    NOT NULL REFERENCES skill_tabs(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  pct           INTEGER NOT NULL DEFAULT 80 CHECK (pct >= 0 AND pct <= 100),
  primary_skill INTEGER NOT NULL DEFAULT 1,
  exposure      INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);


-- ── projects ──────────────────────────────────────────────────────
-- Stores two kinds of entries:
--
--   source = 'github':
--     Auto-created when the owner opens /owner/projects.
--     The sync logic inserts a minimal row (slug only) for every
--     GitHub repo that does not yet exist in this table.
--     All display fields (title, desc, tags, badge) default to empty
--     because the main site reads live GitHub data for these rows
--     unless manually_updated = 1.
--
--   source = 'manual':
--     Professional work, client projects — anything not on GitHub.
--     All fields filled in via the owner interface.
--     These have no GitHub equivalent so all display data comes from DB.
--
--
-- group_id:
--   "personal"      → personal or open source projects
--   "professional"  → work done during employment or contract
--
-- badge values:
--   wip | live | done | delivered | production
--
-- tags:
--   JSON array. Example: ["TypeScript", "SvelteKit", "Vercel"]
CREATE TABLE IF NOT EXISTS projects (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT    NOT NULL UNIQUE,
  source           TEXT    NOT NULL DEFAULT 'manual',  -- 'github' | 'manual'
  manually_updated INTEGER NOT NULL DEFAULT 0,          -- 0 = GitHub wins, 1 = DB wins
  group_id         TEXT    NOT NULL DEFAULT 'personal', -- 'personal' | 'professional'
  title            TEXT    NOT NULL DEFAULT "",
  subtitle         TEXT,
  desc             TEXT    NOT NULL DEFAULT "",
  tags             TEXT    NOT NULL DEFAULT "[]",
  badge            TEXT    NOT NULL DEFAULT "live",
  github           TEXT,
  github_id        INTEGER UNIQUE,  -- GitHub's permanent numeric repo ID, Never changes on rename or transfer, NULL for manual projects
  demo             TEXT,
  private          INTEGER NOT NULL DEFAULT 0,
  company          TEXT,
  language         TEXT,
  stars            INTEGER NOT NULL DEFAULT 0,
  pushedAt         TEXT,
  createdAt        TEXT,
  archived         INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── visitor_sessions ──────────────────────────────────────────────
-- Privacy-friendly unique visitor tracking.
--
-- IMPORTANT:
--   Raw IP addresses are NOT stored.
--   Server code hashes IP + user-agent using HMAC before inserting.
--
-- visitor_key:
--   Stable anonymous hash for the same visitor/browser/device.
--   UNIQUE so the same visitor does not increase total unique count
--   every time they refresh or revisit.
--
-- first_seen_at:
--   Unix timestamp of the visitor's first recorded visit.
--
-- last_seen_at:
--   Unix timestamp of the visitor's latest recorded visit.
--
-- first_path:
--   First public page this visitor landed on.
--
-- last_path:
--   Most recent public page this visitor viewed.
--
-- pageviews:
--   Running total pageviews from this visitor.
--
-- user_agent:
--   Stored for debugging/device context, not shown publicly.
--
-- referrer:
--   First known referrer for this visitor.
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_key   TEXT    NOT NULL UNIQUE,
  first_seen_at INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  first_path    TEXT,
  last_path     TEXT,
  pageviews     INTEGER NOT NULL DEFAULT 1,
  user_agent    TEXT,
  referrer      TEXT,
  country       TEXT,
  city          TEXT
);


-- ── visitor_pageviews ─────────────────────────────────────────────
-- One row per public page view.
--
-- This table is intentionally separate from visitor_sessions because:
--   visitor_sessions → unique visitor summary
--   visitor_pageviews → traffic/page popularity history
--
-- visitor_key:
--   Same anonymous visitor hash used in visitor_sessions.
--
-- path:
--   Public route visited, e.g. "/", "/projects", "/projects/portfolio".
--
-- viewed_at:
--   Unix timestamp when the page was viewed.
--
-- referrer:
--   Referrer for that specific pageview, if available.
CREATE TABLE IF NOT EXISTS visitor_pageviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_key TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  viewed_at   INTEGER NOT NULL,
  referrer    TEXT
);


-- ── Indexes ───────────────────────────────────────────────────────
-- Speeds up the most common queries in the app.
-- experience and skills are always fetched ordered by sort_order.
-- skills are always filtered by tab_id before being ordered.
-- projects are filtered by source and group_id in owner interface.
CREATE INDEX IF NOT EXISTS idx_experience_sort      ON experience(sort_order);
CREATE INDEX IF NOT EXISTS idx_skills_tab           ON skills(tab_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_group       ON projects(group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_source      ON projects(source, manually_updated);
CREATE INDEX IF NOT EXISTS idx_projects_github_id   ON projects(github_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at  ON projects(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_tab_name
  ON skills(tab_id, name);

-- ── Visitor Analytics Indexes ─────────────────────────────────────
-- Speeds up owner dashboard analytics queries.
--
-- idx_visitor_sessions_key:
--   Fast lookup/upsert by anonymous visitor key.
--
-- idx_visitor_sessions_first_seen:
--   Fast "new visitors today" count.
--
-- idx_visitor_sessions_last_seen:
--   Fast recent visitors panel.
--
-- idx_visitor_pageviews_viewed_at:
--   Fast "pageviews today" count.
--
-- idx_visitor_pageviews_path:
--   Fast top pages aggregation.
--
-- idx_visitor_pageviews_key:
--   Fast lookup of pageviews by anonymous visitor.
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_key
  ON visitor_sessions(visitor_key);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_first_seen
  ON visitor_sessions(first_seen_at);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen
  ON visitor_sessions(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_visitor_pageviews_viewed_at
  ON visitor_pageviews(viewed_at);

CREATE INDEX IF NOT EXISTS idx_visitor_pageviews_path
  ON visitor_pageviews(path);

CREATE INDEX IF NOT EXISTS idx_visitor_pageviews_key
  ON visitor_pageviews(visitor_key);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_country
  ON visitor_sessions(country);

