// src/routes/api/owner/ai/classify-skill/+server.js
// POST { skillName, tabs[{id,label}] } → { tabId: string }
import { json } from "@sveltejs/kit";
import { generateText, promptClassifySkill } from "$lib/server/ai.js";

export async function POST({ request }) {
  const { skillName, tabs } = await request.json();
  if (!skillName || !tabs?.length)
    return json({ error: "Missing skillName or tabs" }, { status: 400 });
  try {
    const tabId = await generateText(promptClassifySkill(skillName, tabs));
    return json({ tabId: tabId.trim() });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
