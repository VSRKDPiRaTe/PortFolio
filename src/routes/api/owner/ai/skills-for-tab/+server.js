// src/routes/api/owner/ai/skills-for-tab/+server.js
// POST { tabLabel: string } → { skills: string[] }
import { json } from "@sveltejs/kit";
import { generateText, promptGetSkillsForTab } from "$lib/server/ai.js";

export async function POST({ request }) {
  const { tabLabel } = await request.json();
  if (!tabLabel) return json({ error: "Missing tabLabel" }, { status: 400 });
  try {
    const raw = await generateText(promptGetSkillsForTab(tabLabel), {
      json: true,
    });
    const skills = JSON.parse(raw);
    return json({ skills });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
