// src/routes/owner/skills/+page.server.js
import { fail } from "@sveltejs/kit";
import {
  getAllTabs,
  getAllSkillsGrouped,
  createSkill,
  deleteSkill,
} from "$lib/server/queries/skills.js";

export async function load() {
  const [tabs, skills] = await Promise.all([
    getAllTabs(),
    getAllSkillsGrouped(),
  ]);
  return { tabs, skills };
}

export const actions = {
  // Add a single skill
  create: async ({ request }) => {
    const data = await request.formData();
    const name = data.get("name")?.toString().trim() ?? "";
    const tabId = data.get("tabId")?.toString().trim() ?? "";
    const pct = parseInt(data.get("pct")?.toString() ?? "80");
    const primary = data.get("primary") === "on";
    const exposure = data.get("exposure") === "on";

    if (!name || !tabId) return fail(400, { error: "Name and tab required." });

    try {
      await createSkill({ tab_id: tabId, name, pct, primary, exposure });
      return { success: `${name} added.` };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },

  // Bulk add skills from AI suggestions — pipe-separated names
  bulkAdd: async ({ request }) => {
    const data = await request.formData();
    const tabId = data.get("tabId")?.toString().trim() ?? "";
    const names =
      data
        .get("names")
        ?.toString()
        .split("|")
        .map((n) => n.trim())
        .filter(Boolean) ?? [];

    if (!tabId || !names.length)
      return fail(400, { error: "Missing tab or skills." });

    try {
      for (const name of names) {
        await createSkill({
          tab_id: tabId,
          name,
          pct: 80,
          primary: true,
          exposure: false,
        });
      }
      return { success: `${names.length} skills added to ${tabId}.` };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },

  delete: async ({ request }) => {
    const data = await request.formData();
    const id = parseInt(data.get("id")?.toString() ?? "0");
    if (!id) return fail(400, { error: "Missing ID." });
    try {
      await deleteSkill(id);
      return { success: "Skill deleted." };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
};
