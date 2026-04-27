// ── /projects/[slug]/+page.js — Data Loader ─────────────────────
// SvelteKit load function for the project detail page.
// Runs on both server (SSR) and client (navigation).
//
// params.slug comes from the [slug] folder name in the route.
// Finds the matching project from the merged project data.
// If not found → throws SvelteKit 404 error.
//
// Whatever load() returns becomes `data` in +page.svelte via $props().
//
// WHY THIS FILE STAYS SMALL:
//   Route loaders should resolve plain data only.
//   They should not create reactive stores or duplicate merge logic.
//
//   The merge logic already lives in projects.js.
//   This file only:
//     1. reads parent layout data
//     2. asks projects.js to merge it
//     3. finds the requested slug
//     4. returns the final page data

import { error } from "@sveltejs/kit";
import { mergeProjects, groups, badges } from "$lib/data/projects.js";

export async function load({ params, parent }) {
  // parent() gives access to data returned by +layout.server.js.
  // This makes the detail page reliable on:
  //   - hard refresh
  //   - SSR
  //   - client-side navigation
  const data = await parent();

  const projects = mergeProjects({
    githubRepos: data.githubRepos ?? [],
    customisedProjects: data.customisedRepos ?? [],
    manualProjects: data.manualProjects ?? [],
  });

  // Find project by slug — slug is the URL-friendly identifier
  const project = projects.find((p) => p.slug === params.slug) ?? null;

  // No match → 404. SvelteKit renders its error page.
  if (!project) {
    throw error(404, `Project "${params.slug}" not found`);
  }

  // Resolve group and badge metadata for the found project
  const group = groups.find((g) => g.id === project.group) ?? null;
  const badgeKey = String(project.badge ?? "").toLowerCase();
  const badge = badges[badgeKey] ?? {
    label: String(project.badge ?? "UNKNOWN").toUpperCase(),
    full: "UNKNOWN STATUS",
    desc: "",
    color: "#94a3b8",
    textColor: "#000000",
  };

  // Return clean data — +page.svelte receives this as `data` prop
  return { project, group, badge };
}