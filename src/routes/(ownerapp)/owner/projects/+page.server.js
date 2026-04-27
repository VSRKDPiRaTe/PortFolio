// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/routes/owner/projects/+page.server.js                       ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// load():
//   1. Fetches all GitHub repos via the parent layout data
//   2. Syncs any new repos into the DB (syncGithubRepos)
//   3. Returns DB rows for both sections of the UI:
//      - githubProjects: all source='github' rows (for the GitHub section)
//      - manualProjects: all source='manual' rows (for the manual section)

import { fail } from "@sveltejs/kit";
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


export async function load({ parent, depends }) {

  depends('app:projects');

  // After splitting routes into (site) and (ownerapp),
  // the owner tree no longer inherits the public root layout data.
  // parent() now only reads from /owner/+layout.server.js.
  //
  // So githubRepos may be missing here unless the owner layout
  // explicitly provides it. Use a safe fallback for now so the
  // owner projects page keeps working after the split.
  const parentData = await parent();
  const githubRepos = parentData.githubRepos ?? [];
 
  // Sync: register new repos, update slugs for renamed repos
  if (githubRepos.length) {
    await syncGithubRepos(githubRepos);
  }
 
  const [githubProjects, manualProjects] = await Promise.all([
    getGithubProjects(),
    getManualProjects(),
  ]);
 
  // Merge live GitHub data into the DB rows for display in owner interface.
  // The owner interface needs both DB state (manually_updated, badge etc.)
  // AND live GitHub fields (stars, pushedAt, description) for each row.
  const repoMap = new Map(githubRepos.map(r => [r.slug, r]));
  const mergedGithub = githubProjects.map(dbRow => ({
    ...dbRow,
    // Live fields always from GitHub
    liveTitle:       repoMap.get(dbRow.slug)?.title       ?? dbRow.slug,
    liveDesc:        repoMap.get(dbRow.slug)?.description ?? '',
    liveTags:        repoMap.get(dbRow.slug)?.tags        ?? [],
    stars:           repoMap.get(dbRow.slug)?.stars       ?? 0,
    pushedAt:        repoMap.get(dbRow.slug)?.pushedAt    ?? null,
    language:        repoMap.get(dbRow.slug)?.language    ?? null,
    livePrivate:     repoMap.get(dbRow.slug)?.private     ?? false,
    githubUrl:       repoMap.get(dbRow.slug)?.github      ?? null,
  }));
 
  return {
    githubProjects: mergedGithub,
    manualProjects,
    groups,
    badges,
  };
}

// ── Shared helpers ────────────────────────────────────────────────
function toSlug(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
 
function parseTags(raw) {
  return (raw ?? '').split(',').map(t => t.trim()).filter(Boolean);
}
// ── Form actions ──────────────────────────────────────────────────
export const actions = {
 
  // Update a GitHub repo entry (sets manually_updated=1)
  updateGithub: async ({ request }) => {
    const data   = await request.formData();
    const id     = parseInt(data.get('id') ?? '0');
    const fields = {
      title: data.get('title')?.toString().trim() ?? '',
      desc:  data.get('desc')?.toString().trim()  ?? '',
      tags:  parseTags(data.get('tags')?.toString()),
      demo:  data.get('demo')?.toString().trim()  || null,
    };
    if (!id) return fail(400, { error: 'Missing ID.' });
    try {
      await updateGithubProject(id, fields);
      return { success: 'Project updated.' };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Update badge only — does not set manually_updated
  updateBadge: async ({ request }) => {
    const data  = await request.formData();
    const id    = parseInt(data.get('id') ?? '0');
    const badge = data.get('badge')?.toString().trim() ?? 'live';
    if (!id) return fail(400, { error: 'Missing ID.' });
    try {
      await updateProjectBadge(id, badge);
      return { success: 'Badge updated.' };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Reset GitHub repo — clears all manual overrides, manually_updated → 0
  resetGithub: async ({ request }) => {
    const data = await request.formData();
    const id   = parseInt(data.get('id') ?? '0');

    if (!id) return fail(400, { error: 'Missing ID.' });
    try {
      await resetGithubProject(id);
      return { success: 'Reset to GitHub data.' };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Create manual project
  createManual: async ({ request }) => {
    const data     = await request.formData();
    const title    = data.get('title')?.toString().trim()    ?? '';
    const subtitle = data.get('subtitle')?.toString().trim() ?? '';
    const fields   = {
      slug:     toSlug(subtitle || title),
      title,
      subtitle: subtitle || null,
      desc:     data.get('desc')?.toString().trim()    ?? '',
      tags:     parseTags(data.get('tags')?.toString()),
      badge:    data.get('badge')?.toString().trim()   ?? 'production',
      demo:     data.get('demo')?.toString().trim()    || null,
      company:  data.get('company')?.toString().trim() || null,
    };
    if (!fields.title || !fields.desc)
      return fail(400, { error: 'Title and description required.' });
    try {
      await createManualProject(fields);
      return { success: `${fields.title} created.` };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Update manual project
  updateManual: async ({ request }) => {
    const data     = await request.formData();
    const id       = parseInt(data.get('id') ?? '0');
    const title    = data.get('title')?.toString().trim()    ?? '';
    const subtitle = data.get('subtitle')?.toString().trim() ?? '';
    const fields   = {
      slug:     toSlug(subtitle || title),
      title,
      subtitle: subtitle || null,
      desc:     data.get('desc')?.toString().trim()    ?? '',
      tags:     parseTags(data.get('tags')?.toString()),
      badge:    data.get('badge')?.toString().trim()   ?? 'production',
      demo:     data.get('demo')?.toString().trim()    || null,
      company:  data.get('company')?.toString().trim() || null,
    };
    if (!id) return fail(400, { error: 'Missing ID.' });
    try {
      await updateManualProject(id, fields);
      return { success: `${fields.title} updated.` };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
 
  // Delete any project (GitHub or manual)
  delete: async ({ request }) => {
    const data = await request.formData();
    const id   = parseInt(data.get('id') ?? '0');
    if (!id) return fail(400, { error: 'Missing ID.' });
    try {
      await deleteProject(id);
      return { success: 'Deleted.' };
    } catch (err) {
      return fail(500, { error: err.message });
    }
  },
};