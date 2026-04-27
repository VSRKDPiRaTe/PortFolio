export async function generateExperienceDesc(payload) {
  const res = await fetch('/api/owner/ai/generate-desc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to generate description.');
  }

  return res.json();
}

export async function extractExperienceTags(payload) {
  const res = await fetch('/api/owner/ai/extract-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to extract tags.');
  }

  return res.json();
}

export async function fetchSkillsForTab(tabLabel) {
  const res = await fetch('/api/owner/ai/skills-for-tab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabLabel }),
  });

  if (!res.ok) {
    throw new Error('Failed to get skills for tab.');
  }

  return res.json();
}

export async function fetchClassifySkill(skillName, tabs) {
  const res = await fetch('/api/owner/ai/classify-skill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillName, tabs }),
  });

  if (!res.ok) {
    throw new Error('Failed to classify skill.');
  }

  return res.json();
}

// ── logoutOwner ──────────────────────────────────────────────────
// Logs out the owner by calling the auth endpoint which clears
// the httpOnly session cookie on the server.
//
// WHY THIS IS CLIENT-SIDE:
//   Logout is triggered by a user action (button click), so it
//   belongs in the browser layer — not server load.
//
// WHAT IT DOES:
//   1. Sends POST to /api/owner/auth → server clears cookie
//   2. Redirects browser to /owner-login
//
// NOTE:
//   We explicitly use window.fetch to guarantee browser-only execution
//   and avoid SSR warnings.
export async function logoutOwner() {
  const res = await window.fetch('/api/owner/auth', {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error('Failed to logout.');
  }

  // Hard redirect ensures all state resets cleanly
  window.location.href = '/owner-login';
}