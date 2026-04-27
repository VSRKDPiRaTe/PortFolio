// src/lib/server/sync-events.js
import { publishSync } from '$lib/server/sync-hub.js';

export function notifyProjectsChanged() {
  publishSync('projects-updated');
}

export function notifySkillsChanged() {
  publishSync('skills-updated');
}

export function notifyExperienceChanged() {
  publishSync('experience-updated');
}

export function notifyAnalyticsChanged() {
  publishSync("analytics-updated");
}