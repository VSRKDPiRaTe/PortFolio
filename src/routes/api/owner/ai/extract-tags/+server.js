// src/routes/api/owner/ai/extract-tags/+server.js
// POST { bullets[] } → { tags: string[] }
import { json } from "@sveltejs/kit";
import { generateText, promptExtractTags } from "$lib/server/ai.js";

export async function POST({ request }) {
  const { bullets } = await request.json();
  if (!bullets?.length)
    return json({ error: "No bullets provided" }, { status: 400 });
  try {
    const raw = await generateText(promptExtractTags(bullets), { json: true });
    const tags = JSON.parse(raw);
    return json({ tags });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
