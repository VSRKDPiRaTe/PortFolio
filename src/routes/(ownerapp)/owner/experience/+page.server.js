// src/routes/owner/experience/+page.server.js
import { fail } from "@sveltejs/kit";
import {
  getAllExperience,
  createExperience,
  updateExperience,
  deleteExperience,
} from "$lib/server/queries/experience.js";

export async function load() {
  return { experience: await getAllExperience() };
}

// ── Shared helper: parse form fields ──────────────────────────────
function parseFields(data) {
  const bullets = data.get("bullets")?.toString().trim() ?? "";
  const tags = data.get("tags")?.toString().trim() ?? "";

  return {
    id: data.get("id")?.toString().trim() ?? "",
    role: data.get("role")?.toString().trim() ?? "",
    company: data.get("company")?.toString().trim() ?? "",
    location: data.get("location")?.toString().trim() ?? "",
    startDate: data.get("startDate")?.toString().trim() ?? "",
    endDate: data.get("endDate")?.toString().trim() || null,
    current: data.get("current") === "on",
    // Bullets: split textarea by newline, trim each, remove empty lines
    bullets: bullets
      ? bullets
          .split("\n")
          .map((b) => b.trim())
          .filter(Boolean)
      : [],
    desc: data.get("desc")?.toString().trim() ?? "",
    // Tags: split by comma, trim each, remove empty
    tags: tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
  };
}

export const actions = {
  create: async ({ request }) => {
    const fields = parseFields(await request.formData());
    if (!fields.id || !fields.role || !fields.company) {
      return fail(400, { error: "ID, Role, and Company are required." });
    }
    try {
      await createExperience(fields);
      return { success: `${fields.company} added.` };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },

  update: async ({ request }) => {
    const data = await request.formData();
    const oldId = data.get("old_id")?.toString().trim();
    const fields = parseFields(data);
    if (!oldId) return fail(400, { error: "Missing original ID." });
    try {
      await updateExperience(oldId, fields);
      return { success: `${fields.company} updated.` };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },

  delete: async ({ request }) => {
    const data = await request.formData();
    const id = data.get("id")?.toString().trim();
    if (!id) return fail(400, { error: "Missing ID." });
    try {
      await deleteExperience(id);
      return { success: "Entry deleted." };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
};
