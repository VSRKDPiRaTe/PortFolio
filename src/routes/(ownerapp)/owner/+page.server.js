// src/routes/owner/+page.server.js — Dashboard Data
import { getAllExperience } from '$lib/server/queries/experience.js';
import { getAllSkillsGrouped } from '$lib/server/queries/skills.js';
import { getAllProjects } from '$lib/server/queries/projects.js';
import { getAnalyticsSummary } from '$lib/server/queries/analytics.js';

export async function load({ depends }) {
  depends('app:experience');
  depends('app:skills');
  depends('app:projects');

  // Analytics has its own dependency key.
  // Later, if you add live analytics refresh, you can invalidate this with:
  //   invalidate('app:analytics')
  depends('app:analytics');

  const [experience, skills, projects, analytics] = await Promise.all([
    getAllExperience(),
    getAllSkillsGrouped(),
    getAllProjects(),
    getAnalyticsSummary(),
  ]);

  const skillsCount = Object.values(skills).flat().length;

  return {
    experienceCount: experience.length,
    skillsCount,
    projectsCount: projects.length,
    analytics,
  };
}