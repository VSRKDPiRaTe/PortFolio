// src/routes/api/owner/ai/generate-desc/+server.js
// POST { role, company, bullets[] } → { desc: string }
import { json } from "@sveltejs/kit";
import { generateText, promptGenerateDesc } from "$lib/server/ai.js";

export async function POST({ request }) {
  const { role, company, bullets } = await request.json();
  if (!bullets?.length)
    return json({ error: "No bullets provided" }, { status: 400 });
  try {
    const desc = await generateText(promptGenerateDesc(role, company, bullets));
    return json({ desc });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
