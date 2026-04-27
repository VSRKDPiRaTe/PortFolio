// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/ai.js — AI Text Generation Layer                 ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   Handles all AI text generation for the owner interface.
//   Google Gemini is the primary provider (free tier, no credit card).
//   One optional fallback slot accepts any supported provider.
//
// HOW IT WORKS:
//   1. generateText() always tries Gemini first
//   2. If Gemini fails AND a fallback is configured → tries fallback
//   3. If both fail → throws a clear error
//
// ENV VARS:
//   Required (Gemini primary):
//     GOOGLE_AI_KEY=...          → get free at aistudio.google.com
//     GEMINI_MODEL=gemini-1.5-flash  → or gemini-1.5-pro, gemini-2.0-flash
//
//   Optional (one fallback of any supported provider):
//     AI_FALLBACK_PROVIDER=anthropic  → anthropic | openai
//     AI_FALLBACK_MODEL=claude-haiku-4-5-20251001
//     AI_FALLBACK_API_KEY=sk-ant-...
//
// SUPPORTED FALLBACK PROVIDERS:
//   anthropic → Claude (console.anthropic.com)
//   openai    → GPT    (platform.openai.com)
//
// ADDING A NEW FALLBACK PROVIDER IN THE FUTURE:
//   1. Add a new async function callXxx(prompt, model, key) below
//   2. Add it to the FALLBACK_PROVIDERS map
//   3. Set AI_FALLBACK_PROVIDER=xxx in .env — done
//
// NEVER IMPORT THIS IN .svelte FILES:
//   API keys would leak to the browser.
//   Only import in: +server.js, +page.server.js, src/lib/server/*.js

import {
  GOOGLE_AI_KEY,
  GEMINI_MODEL,
  AI_FALLBACK_PROVIDER,
  AI_FALLBACK_MODEL,
  AI_FALLBACK_API_KEY,
} from '$env/static/private';


// ── Primary: Google Gemini ────────────────────────────────────────
// Free tier: gemini → 15 req/min, 1500 req/day
//
// API shape:
//   POST .../models/{model}:generateContent?key={GOOGLE_AI_KEY}
//   Body: { contents: [{ parts: [{ text: prompt }] }] }
//   Response: { candidates: [{ content: { parts: [{ text }] } }] }
async function callGemini(prompt) {
  const model = GEMINI_MODEL || 'gemini-1.5-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_KEY}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.3,   // lower = more deterministic output
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');

  return text.trim();
}


// ── Fallback Providers ────────────────────────────────────────────
// Each function has the same signature: (prompt, model, key) → string
// This uniform signature is what makes the fallback system generic —
// any new provider just needs to match this shape.

async function callAnthropic(prompt, model, key) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      model || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.content?.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Anthropic returned no text');

  return text.trim();
}

async function callOpenAI(prompt, model, key) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model:       model || 'gpt-4o-mini',
      max_tokens:  1024,
      temperature: 0.3,
      messages:    [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned no text');

  return text.trim();
}

// Map of supported fallback provider IDs to their call functions.
// To add a new provider: add the function above, add it here.
const FALLBACK_PROVIDERS = {
  anthropic: callAnthropic,
  openai:    callOpenAI,
};


// ── generateText ──────────────────────────────────────────────────
// The single public function. All owner interface AI tasks call this.
//
// Flow:
//   1. Try Gemini (primary, always)
//   2. If Gemini throws AND fallback is configured → try fallback
//   3. If both throw → re-throw the last error
//
// @param {string}  prompt         — full prompt string
// @param {object}  options
//   options.json {boolean}        — strip markdown fences from response
//                                   use when asking AI to return JSON
// @returns {Promise<string>}      — AI response as plain string
//
// USAGE:
//   // Plain text
//   const desc = await generateText(prompt)
//
//   // JSON — AI wraps JSON in fences even when told not to, strip them
//   const raw  = await generateText(prompt, { json: true })
//   const tags = JSON.parse(raw)
export async function generateText(prompt, options = {}) {
  let lastError;

  // ── Try Gemini first ────────────────────────────────────────────
  try {
    const text = await callGemini(prompt);
    return options.json ? stripFences(text) : text;
  } catch (err) {
    lastError = err;
    console.warn('[ai] Gemini failed:', err.message);
  }

  // ── Try fallback if configured ──────────────────────────────────
  // AI_FALLBACK_PROVIDER, AI_FALLBACK_MODEL, AI_FALLBACK_API_KEY
  // are all optional — if not set, skip fallback entirely.
  const provider = (AI_FALLBACK_PROVIDER || '').toLowerCase().trim();

  if (provider && AI_FALLBACK_API_KEY) {
    const fn = FALLBACK_PROVIDERS[provider];

    if (!fn) {
      // Configured provider is not supported — warn and fall through
      console.warn(`[ai] Unknown fallback provider: "${provider}". Supported: ${Object.keys(FALLBACK_PROVIDERS).join(', ')}`);
    } else {
      try {
        const text = await fn(prompt, AI_FALLBACK_MODEL, AI_FALLBACK_API_KEY);
        return options.json ? stripFences(text) : text;
      } catch (err) {
        lastError = err;
        console.warn('[ai] Fallback failed:', err.message);
      }
    }
  }

  // Both failed — throw the last error with context
  throw new Error(`[ai] All providers failed. Last error: ${lastError?.message}`);
}


// ── stripFences ───────────────────────────────────────────────────
// Removes markdown code fences that AI models add around JSON output
// even when explicitly told not to.
// Handles opening fences like: ```json or just ```
// Handles closing fences like: ```
function stripFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}


// ── Prompt Templates ──────────────────────────────────────────────
// One function per owner interface AI task.
// Centralised here so prompt wording is improved in one place.
// Each returns a string to pass directly to generateText().

// Generate a 4-sentence professional experience description.
// Use: const desc = await generateText(promptGenerateDesc(...))
export function promptGenerateDesc(role, company, bullets) {
  return `
Write a concise 4-sentence professional summary for the following job role.
Capture the scope of work and key impact. Write in third person, past tense
(or present tense if it is a current role). Do not include the job title or
company name in the text. Return ONLY the 4 sentences — no preamble.

Role: ${role}
Company: ${company}
Bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}
`.trim();
}

// Extract technology and skill names from bullet points as a JSON array.
// Use: const raw = await generateText(promptExtractTags(...), { json: true })
//      const tags = JSON.parse(raw)
export function promptExtractTags(bullets) {
  return `
Extract all technology names, programming languages, frameworks, tools,
platforms, and methodologies from the bullet points below.
Return ONLY a valid JSON array of strings. No explanation, no markdown fences.
Use proper capitalisation (e.g. "TypeScript" not "typescript"). Remove duplicates.

Bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Example: ["TypeScript", "Docker", "Azure", "PostgreSQL"]
`.trim();
}

// ── promptClassifySkill ───────────────────────────────────────────
// Returns a prompt that asks the AI to classify a skill name into
// one of the existing tab categories stored in the DB.
//
// WHEN THIS IS USED:
//   Owner types a skill name in the Add Skill form in the owner interface.
//   The AI reads the skill name and the available tab IDs + labels from DB,
//   then returns the single ID of the most appropriate tab.
//   Owner sees the AI suggestion pre-selected and can override if wrong.
//
// WHY TABS COME FROM THE DB (not hardcoded):
//   Tab names are owned by the owner — they can add or rename tabs
//   via the owner interface. Passing live DB tabs means the AI always
//   classifies against the real current list, not a stale hardcoded one.
//
// WHY {id, label} PAIRS INSTEAD OF JUST IDS:
//   Passing both the slug ("backend") and the full label ("BACKEND & APIS")
//   gives the AI enough context to classify accurately without needing
//   hardcoded hint rules in the prompt. The label IS the hint.
//   If tabs are renamed or new ones added, the prompt stays accurate
//   automatically — no prompt changes needed.
//
// USAGE:
//   import { promptClassifySkill } from '$lib/server/ai.js'
//
//   const tabs   = await getAllTabs()  // [{ id, label }, ...] from DB
//   const prompt = promptClassifySkill('Prisma ORM', tabs)
//   const tabId  = await generateText(prompt)
//   // tabId = "backend"
//   // Pre-select this tab in the form, owner can override
//
// @param {string} skillName  — the skill to classify e.g. "Prisma ORM"
// @param {Array}  tabs       — array of { id, label } from DB
//                              e.g. [{ id: "backend", label: "BACKEND & APIS" }]
// @returns {string} — prompt ready to pass to generateText()
export function promptClassifySkill(skillName, tabs) {
  // Build the category list with both ID and label on each line.
  // e.g. "backend → BACKEND & APIS"
  // AI returns the ID (left side), label gives it context to decide.
  const categoryList = tabs
    .map(t => `${t.id} → ${t.label}`)
    .join('\n');

  return `
Classify the following skill into exactly one of the categories below.
Return ONLY the category ID on the left side of the arrow — nothing else,
no explanation, no punctuation.

Skill: ${skillName}

Categories (ID → Label):
${categoryList}

Return only the ID, e.g.: backend
`.trim();
}

// ── promptGetSkillsForTab ─────────────────────────────────────────
// Returns a prompt that asks the AI to list all real, industry-recognised
// skills that belong under a given tab category.
//
// WHEN THIS IS USED:
//   Owner opens the Skills section in the owner interface and clicks
//   "Load Skills" on a tab (e.g. "BACKEND & APIS").
//   The response gives a full list of real technologies in that category.
//   Owner then selects which ones to add, and sets pct + primary/exposure
//   flags for each. AI suggests — owner decides.
//
// WHY THE TAB LABEL AND NOT THE TAB ID:
//   tabLabel ("BACKEND & APIS") is more descriptive than tabId ("backend").
//   The AI produces better, more accurate results when given the full
//   human-readable name rather than a short slug.
//
// USAGE:
//   import { promptGetSkillsForTab } from '$lib/server/ai.js'
//
//   const prompt = promptGetSkillsForTab(tab.label)
//   const raw    = await generateText(prompt, { json: true })
//   const skills = JSON.parse(raw)
//   // skills = ["Node.js", "Express", "FastAPI", "GraphQL", ...]
//   // Show these to owner as a checklist — owner selects, then saves
//
// @param {string} tabLabel — the full display label of the tab
//                            e.g. "BACKEND & APIS", "DATA ENGINEERING"
//                            comes from skill_tabs.label in the DB
// @returns {string} — prompt ready to pass to generateText()
export function promptGetSkillsForTab(tabLabel) {
  return `
List all real, industry-recognised technologies, frameworks, libraries,
tools, and skills that a professional software engineer would classify
under the category: "${tabLabel}".

Rules:
- Include only technologies that genuinely exist and are widely used
- Use proper official capitalisation (e.g. "PostgreSQL" not "postgresql")
- Include both mainstream and notable niche tools in this category
- Do not include general concepts or soft skills
- Remove duplicates
- Return ONLY a valid JSON array of strings — no explanation, no markdown

Example format: ["Tool A", "Framework B", "Platform C"]
`.trim();
}