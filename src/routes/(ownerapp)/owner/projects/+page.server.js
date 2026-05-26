// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/routes/(ownerapp)/owner/projects/+page.server.js             ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   Server loader + form actions for Owner → Projects.
//
// OWNER PROJECTS FLOW:
//   load():
//     1. Fetch GitHub repos through the server-only GitHub helper.
//     2. Sync GitHub repos into the projects table.
//     3. Read DB rows for both owner UI sections:
//          - githubProjects → source='github'
//          - manualProjects → source='manual'
//     4. Return DB-backed data to the Owner Interface.
//
// ARCHITECTURE:
//   GitHub API is ingestion only.
//   Database is the source of truth.
//
//   Public site does NOT fetch GitHub repos anymore.
//   Public site reads DB projects only.
//
// WHY THIS ROUTE FETCHES GITHUB DIRECTLY:
//   Owner routes live under the (ownerapp) route group.
//   They do not inherit public (site) layout data.
//   So GitHub ingestion must happen here, not in the public layout.

import { fail } from "@sveltejs/kit";
import { fetchOwnerGitHubRepos } from '$lib/server/github.js';
import {
  syncGithubRepos,
  getGithubProjects,
  getManualProjects,
  updateGithubProject,
  updateProjectBadge,
  resetGithubProject,
  createManualProject,
  updateManualProject,
  deleteProject,
} from '$lib/server/queries/projects.js';

import { groups, badges } from '$lib/data/projects.js';


export async function load({ fetch, depends }) {

  depends('app:projects');

  // ── GitHub Ingestion ───────────────────────────────────────────
  // Fetch latest GitHub repo data and upsert it into DB.
  //
  // syncGithubRepos() preserves owner overrides while still updating
  // metadata such as stars, pushedAt, language, private, archived, etc.
  try {
    const githubRepos = await fetchOwnerGitHubRepos(fetch);

    if (githubRepos.length) {
      await syncGithubRepos(githubRepos);
    }
  } catch (err) {
    // Owner page should still load from DB even if GitHub API fails.
    // Example failures:
    //   - token expired
    //   - GitHub rate limit
    //   - missing private repo permissions
    console.error("[owner/projects] GitHub sync failed:", err.message);
  }
 
  // ── DB Reads ───────────────────────────────────────────────────
  // After sync, read DB rows only.
  //
  // GitHub projects already contain the latest synced GitHub data in DB.
  // Manual projects are fully owner-managed DB records.
  const [githubProjects, manualProjects] = await Promise.all([
    getGithubProjects(),
    getManualProjects(),
  ]);
 
  return {
    githubProjects,
    manualProjects,
    groups,
    badges,
  };
}

// ── Shared helpers ────────────────────────────────────────────────
function toSlug(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
 
function parseTags(raw) {
  return String(raw ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// ── Form actions ──────────────────────────────────────────────────
export const actions = {
 
  // Update a GitHub repo entry.
  //
  // This sets manually_updated=1.
  // Future GitHub syncs will preserve these owner-controlled fields:
  //   title, desc, tags, demo
  //
  // GitHub metadata still continues to update:
  //   stars, language, pushedAt, private, archived
  updateGithub: async ({ request }) => {
    const data = await request.formData();

    const id = parseInt(data.get("id") ?? "0");

    const fields = {
      title: data.get("title")?.toString().trim() ?? "",
      desc: data.get("desc")?.toString().trim() ?? "",
      tags: parseTags(data.get("tags")?.toString()),
      demo: data.get("demo")?.toString().trim() || null,
    };

    if (!id) return fail(400, { error: "Missing ID." });

    try {
      await updateGithubProject(id, fields);
      return { success: "Project updated." };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 

  // Update badge only.
  //
  // Badge is treated as lightweight owner-controlled status.
  // It does NOT set manually_updated.
  updateBadge: async ({ request }) => {
    const data = await request.formData();

    const id = parseInt(data.get("id") ?? "0");
    const badge = data.get("badge")?.toString().trim() ?? "live";

    if (!id) return fail(400, { error: "Missing ID." });

    try {
      await updateProjectBadge(id, badge);
      return { success: "Badge updated." };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Reset GitHub repo overrides.
  //
  // Clears owner display overrides and sets manually_updated=0.
  // The next GitHub sync restores synced DB display values.
  resetGithub: async ({ request }) => {
    const data = await request.formData();

    const id = parseInt(data.get("id") ?? "0");

    if (!id) return fail(400, { error: "Missing ID." });

    try {
      await resetGithubProject(id);
      return { success: "Reset to GitHub data." };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Create manual/professional project.
  //
  // Used for employment/client projects that do not have a public GitHub repo.
  createManual: async ({ request }) => {
    const data = await request.formData();

    const title = data.get("title")?.toString().trim() ?? "";
    const subtitle = data.get("subtitle")?.toString().trim() ?? "";

    const fields = {
      slug: toSlug(subtitle || title),
      title,
      subtitle: subtitle || null,
      desc: data.get("desc")?.toString().trim() ?? "",
      tags: parseTags(data.get("tags")?.toString()),
      badge: data.get("badge")?.toString().trim() ?? "production",
      demo: data.get("demo")?.toString().trim() || null,
      company: data.get("company")?.toString().trim() || null,
    };

    if (!fields.title || !fields.desc) {
      return fail(400, { error: "Title and description required." });
    }

    try {
      await createManualProject(fields);
      return { success: `${fields.title} created.` };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Update manual/professional project.
  updateManual: async ({ request }) => {
    const data = await request.formData();

    const id = parseInt(data.get("id") ?? "0");
    const title = data.get("title")?.toString().trim() ?? "";
    const subtitle = data.get("subtitle")?.toString().trim() ?? "";

    const fields = {
      slug: toSlug(subtitle || title),
      title,
      subtitle: subtitle || null,
      desc: data.get("desc")?.toString().trim() ?? "",
      tags: parseTags(data.get("tags")?.toString()),
      badge: data.get("badge")?.toString().trim() ?? "production",
      demo: data.get("demo")?.toString().trim() || null,
      company: data.get("company")?.toString().trim() || null,
    };

    if (!id) return fail(400, { error: "Missing ID." });

    try {
      await updateManualProject(id, fields);
      return { success: `${fields.title} updated.` };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Delete project.
  //
  // UI currently exposes delete for manual projects.
  // Query deletes by id, so keep this action protected by owner auth route.
  delete: async ({ request }) => {
    const data = await request.formData();

    const id = parseInt(data.get("id") ?? "0");

    if (!id) return fail(400, { error: "Missing ID." });

    try {
      await deleteProject(id);
      return { success: "Deleted." };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
};