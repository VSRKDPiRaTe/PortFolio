# ═══════════════════════════════════════════════════════════════════
# Makefile — Portfolio Dev & Deployment Commands
#
# WHAT IS A MAKEFILE?
# Make is a build automation tool that turns long terminal commands
# into short memorable shortcuts. Instead of remembering and typing:
#   "git add . && git commit -m '...' && git push origin main"
# You just run: make deploy msg="your message"
#
# HOW TO USE:
#   make <command>              run a command
#   make deploy msg="..."       run command with a variable
#
# QUICK REFERENCE:
#   make help                   show all available commands
#   make dev                    start local dev server
#   make check                  run static analysis before deploying
#   make build                  build for production
#   make preview                preview production build locally
#   make clean                  remove build artifacts
#   make sync-env               push .env.production vars → Vercel
#   make deploy msg="..."       full deploy: env + commit + push
#   make deploy-preview         deploy to preview URL only (safe)
#   make repo-settings          update GitHub repo description/homepage/topics
#   make repo-open              open GitHub repo in browser
#   make git-status             show current git status at a glance
#   make db-prod-shell          open Turso production DB shell
#
# IMPORTANT:
#   .env.production is NEVER committed.
#   This Makefile reads .env.production locally and pushes those values
#   into Vercel using the Vercel CLI.
# ═══════════════════════════════════════════════════════════════════


# ── Shell ──────────────────────────────────────────────────────────
# Some commands below use bash features such as [[ ... ]].
# Explicitly setting SHELL avoids Make using /bin/sh on systems where
# /bin/sh is more limited.
SHELL := /bin/bash


# ── Configuration ──────────────────────────────────────────────────
# These variables are used throughout the Makefile.
# Change BRANCH if you use a different production branch name.

BRANCH        := main
ENV_PROD_FILE := .env.production
ENV_DEV_FILE  := .env.development
BUILD_DIR     := .svelte-kit

# ── Turso Database ─────────────────────────────────────────────────
# Used by:
#   make db-prod-shell
#
# Local development uses:
#   TURSO_DB_URL=file:local.db
#
# Production uses:
#   TURSO_DB_URL=libsql://...
#
# This Makefile does NOT automatically overwrite Turso with local.db.
# That should stay a deliberate/manual action so production data is not
# accidentally replaced.
TURSO_DB_NAME ?= portfolio


# ── Terminal Colours ───────────────────────────────────────────────
# ANSI escape codes for coloured terminal output.
# \033[ = escape sequence start, m = end, 0m = reset all styles
# 0;36m = cyan, 0;32m = green, 0;31m = red, 1;33m = yellow bold

CYAN   := \033[0;36m
GREEN  := \033[0;32m
RED    := \033[0;31m
YELLOW := \033[1;33m
BOLD   := \033[1m
RESET  := \033[0m

# ── .PHONY Declaration ─────────────────────────────────────────────
# Tells Make that these are COMMANDS, not file names.
# Without this, if a file named "build" existed in your folder,
# Make would think the target is already satisfied and skip it.
# Rule: every target that isn't generating a real file goes here.

.PHONY: help dev check build preview clean sync-env deploy deploy-preview git-status repo-settings repo-open db-prod-shell


# ════════════════════════════════════════════════════════════════════
# HELP
# ════════════════════════════════════════════════════════════════════

# Default target — runs when you type just "make" with no command.
# The @echo suppresses printing the command itself (only shows output).
help:
	@echo ""
	@echo "$(BOLD)$(CYAN)Portfolio — Available Commands$(RESET)"
	@echo "$(CYAN)══════════════════════════════════════════$(RESET)"
	@echo ""
	@echo "$(BOLD)Development$(RESET)"
	@echo "  $(GREEN)make dev$(RESET)                    Start local dev server (hot reload)"
	@echo "  $(GREEN)make check$(RESET)                  Run Svelte static analysis"
	@echo "  $(GREEN)make build$(RESET)                  Run check + production build"
	@echo "  $(GREEN)make preview$(RESET)                Preview production build locally"
	@echo "  $(GREEN)make clean$(RESET)                  Remove all build artifacts"
	@echo ""
	@echo "$(BOLD)Vercel / Deployment$(RESET)"
	@echo "  $(GREEN)make sync-env$(RESET)               Push .env.production → Vercel production"
	@echo "  $(GREEN)make deploy-preview$(RESET)         Deploy current code to Vercel preview URL"
	@echo "  $(GREEN)make deploy msg='feat: ...'$(RESET)  Check + build + sync env + commit + push"
	@echo ""
	@echo "$(BOLD)GitHub Repo Settings$(RESET)"
	@echo "  $(GREEN)make repo-settings$(RESET)          Update repo description, website, and topics"
	@echo "  $(GREEN)make repo-open$(RESET)              Open GitHub repo in browser"
	@echo ""
	@echo "$(BOLD)Git$(RESET)"
	@echo "  $(GREEN)make git-status$(RESET)             Show branch, changed files, recent commits"
	@echo ""
	@echo "$(BOLD)Database$(RESET)"
	@echo "  $(GREEN)make db-prod-shell$(RESET)          Open Turso production DB shell"
	@echo ""
	@echo "$(BOLD)Examples$(RESET)"
	@echo "  make sync-env"
	@echo "  make repo-settings"
	@echo "  make deploy msg=\"feat: production-ready portfolio\""
	@echo ""


# ════════════════════════════════════════════════════════════════════
# LOCAL DEVELOPMENT
# ════════════════════════════════════════════════════════════════════

# Starts Vite dev server with hot module replacement.
# --open flag opens your browser automatically.
# Ctrl+C to stop the server.
dev:
	@echo "$(CYAN)Starting dev server...$(RESET)"
	npm run dev -- --open


# Runs svelte-check — static analysis for your .svelte files.
# Catches: missing props, wrong imports, type mismatches, unused vars.
# Run this before every deploy to catch errors early.
check:
	@echo "$(CYAN)Running Svelte static analysis...$(RESET)"
	npm run check
	@echo "$(GREEN)✓ Check complete$(RESET)"


# Compiles your app for production into the .svelte-kit/output folder.
# Runs the check first so you never build broken code.
build: check
	@echo "$(CYAN)Building for production...$(RESET)"
	npm run build
	@echo "$(GREEN)✓ Build complete$(RESET)"


# Previews the production build locally before deploying.
# Useful to verify the real build works, not just the dev server.
# Runs on http://localhost:4173 (different port from dev's 5173).
preview: build
	@echo "$(CYAN)Previewing production build locally...$(RESET)"
	npm run preview


# Removes all build artifacts and caches.
# Use this if you hit weird build errors — clean slate fixes most things.
# node_modules is left intact (no need to re-run npm install after this).
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	rm -rf $(BUILD_DIR) build .vercel/output
	@echo "$(GREEN)✓ Cleaned$(RESET)"


# ════════════════════════════════════════════════════════════════════
# VERCEL ENVIRONMENT VARIABLES
# ════════════════════════════════════════════════════════════════════

# Pushes all variables from .env.production to Vercel's production environment.
# Runs before deployment so Vercel has the latest values at build/runtime.
#
# WHY THIS EXISTS:
#   .env.production stays local and private.
#   Vercel still needs those same values during production build/runtime.
#
# WHAT IT DOES:
#   1. Checks .env.production exists.
#   2. Checks Vercel CLI is installed.
#   3. Checks this folder is linked to a Vercel project.
#   4. Reads each non-comment line from .env.production.
#   5. Removes existing production env vars with the same names.
#   6. Adds fresh values to Vercel production.
#
# SUPPORTED .env FORMAT:
#   KEY=value
#   KEY="value"
#   KEY='value'
#   # comments ignored
#
# NOTE:
#   After changing production env vars, Vercel needs a new deployment for
#   the new values to affect production.
sync-env:
	@echo "$(CYAN)Syncing $(ENV_PROD_FILE) → Vercel production...$(RESET)"
	@if [ ! -f "$(ENV_PROD_FILE)" ]; then \
		echo "$(RED)✗ Error: $(ENV_PROD_FILE) not found.$(RESET)"; \
		exit 1; \
	fi
	@if ! command -v vercel &> /dev/null; then \
		echo "$(RED)✗ Error: Vercel CLI not installed.$(RESET)"; \
		echo "  Install it: npm install -g vercel"; \
		exit 1; \
	fi
	@if [ ! -d ".vercel" ]; then \
		echo "$(RED)✗ Error: Project is not linked to Vercel.$(RESET)"; \
		echo "  Run: vercel link"; \
		exit 1; \
	fi
	@echo "$(CYAN)Reading env keys from $(ENV_PROD_FILE)...$(RESET)"
	@while IFS='=' read -r key value || [ -n "$$key" ]; do \
		key="$$(echo "$$key" | xargs)"; \
		value="$$(echo "$$value" | sed -e 's/^"//' -e 's/"$$//' -e "s/^'//" -e "s/'$$//")"; \
		if [[ -z "$$key" || "$$key" == \#* ]]; then \
			continue; \
		fi; \
		echo "$(YELLOW)→ Syncing $$key$(RESET)"; \
		vercel env rm "$$key" production --yes >/dev/null 2>&1 || true; \
		printf '%s' "$$value" | vercel env add "$$key" production >/dev/null; \
	done < "$(ENV_PROD_FILE)"
	@echo "$(GREEN)✓ Env vars synced to Vercel production$(RESET)"


# ════════════════════════════════════════════════════════════════════
# DEPLOYMENT
# ════════════════════════════════════════════════════════════════════

# Full production release flow.
#
# WHAT IT DOES:
#   1. Requires commit message.
#   2. Runs check.
#   3. Runs build.
#   4. Syncs .env.production to Vercel.
#   5. Stages code.
#   6. Commits code.
#   7. Pushes to GitHub.
#
# WHAT HAPPENS AFTER PUSH:
#   Vercel sees the GitHub push and automatically deploys production.
#
# USAGE:
#   make deploy msg="feat: update portfolio"
#
# Commit message convention:
#   feat:     new feature
#   fix:      bug fix
#   style:    visual/CSS changes
#   refactor: code restructure (no feature change)
#   chore:    config, deps, tooling
#   docs:     README or comment updates
deploy:
	@if [ -z "$(msg)" ]; then \
		echo "$(RED)✗ Error: Commit message is required.$(RESET)"; \
		echo "  Usage: make deploy msg=\"feat: your message here\""; \
		exit 1; \
	fi
	@echo ""
	@echo "$(BOLD)$(CYAN)Starting production deploy pipeline...$(RESET)"
	@echo ""
	@echo "$(CYAN)Step 1/5 — Check + build...$(RESET)"
	@$(MAKE) build --no-print-directory
	@echo "$(CYAN)Step 2/5 — Sync Vercel env vars...$(RESET)"
	@$(MAKE) sync-env --no-print-directory
	@echo "$(CYAN)Step 3/5 — Stage changes...$(RESET)"
	git add .
	@echo "$(CYAN)Step 4/5 — Commit changes...$(RESET)"
	git commit -m "$(msg)"
	@echo "$(CYAN)Step 5/5 — Push to GitHub branch: $(BRANCH)...$(RESET)"
	git push origin $(BRANCH)
	@echo ""
	@echo "$(GREEN)$(BOLD)✓ Push complete. Vercel deployment triggered.$(RESET)"
	@echo "$(GREEN)Open Vercel dashboard to watch build logs.$(RESET)"
	@echo ""


# Deploys to a Vercel PREVIEW URL — does NOT touch production.
# Use this to share a live link for review before going to prod.
# Each preview gets a unique URL like: portfolio-abc123.vercel.app
deploy-preview:
	@echo "$(CYAN)Deploying preview to Vercel...$(RESET)"
	vercel
	@echo "$(GREEN)✓ Preview deploy complete$(RESET)"
	@echo "$(GREEN)✓ Check the URL above.$(RESET)"

# ════════════════════════════════════════════════════════════════════
# GITHUB REPOSITORY METADATA
# ════════════════════════════════════════════════════════════════════
#
# GITHUB_REPO:
#   Format: owner/repo
#   Example: VSRKDPiRaTe/portfolio
#
# REPO_DESC:
#   Text shown in GitHub's repo About panel.
#
# REPO_HOME:
#   Website URL shown in GitHub's repo About panel.
#   Keep this updated when Vercel gives you a final/custom domain.
#
# REPO_TOPICS:
#   Comma-separated topics. GitHub topics should be lowercase and hyphenated.
GITHUB_REPO  ?= VSRKDPiRaTe/portfolio
#
# Reads repo metadata from .env.repo.local instead of hardcoding.
#
# FILE STRUCTURE (.env.repo.local):
#   REPO_DESC=...
#   REPO_HOME=...
#   REPO_TOPICS=a,b,c
#
# WHY:
#   - Keeps Makefile clean
#   - Keeps repo metadata private/local
#   - Easily editable without touching code
#
# REQUIREMENTS:
#   gh CLI installed and logged in:
#     gh auth login
#
# USAGE:
#   make repo-settings
#
# OPTIONAL:
#   Override file:
#     make repo-settings REPO_ENV_FILE=.env.repo.local
#
REPO_ENV_FILE ?= .env.repo.local

repo-settings:
	@if [ ! -f "$(REPO_ENV_FILE)" ]; then \
		echo "$(RED)✗ Error: $(REPO_ENV_FILE) not found.$(RESET)"; \
		echo "  Create $(REPO_ENV_FILE) with:"; \
		echo "    REPO_DESC=..."; \
		echo "    REPO_HOME=..."; \
		echo "    REPO_TOPICS=sveltekit,portfolio,vercel"; \
		exit 1; \
	fi
	@if ! command -v gh &> /dev/null; then \
		echo "$(RED)✗ Error: GitHub CLI not installed.$(RESET)"; \
		echo "  Install it: https://cli.github.com"; \
		exit 1; \
	fi
	@echo "$(CYAN)Reading repo metadata from $(REPO_ENV_FILE)...$(RESET)"
	@set -a; source "$(REPO_ENV_FILE)"; set +a; \
	echo "$(CYAN)Updating repo: $(GITHUB_REPO)$(RESET)"; \
	echo "$(CYAN)  Description: $$REPO_DESC$(RESET)"; \
	echo "$(CYAN)  Homepage:    $$REPO_HOME$(RESET)"; \
	echo "$(CYAN)  Topics:      $$REPO_TOPICS$(RESET)"; \
	gh repo edit "$(GITHUB_REPO)" \
		--description "$$REPO_DESC" \
		--homepage "$$REPO_HOME" \
		--add-topic "$$REPO_TOPICS"
	@echo "$(GREEN)✓ GitHub repo settings updated$(RESET)"


# Opens the GitHub repository in the browser.
# Uses GITHUB_REPO from the config section above.
repo-open:
	@if ! command -v gh &> /dev/null; then \
		echo "$(RED)✗ Error: GitHub CLI not installed.$(RESET)"; \
		exit 1; \
	fi
	gh repo view $(GITHUB_REPO) --web


# ════════════════════════════════════════════════════════════════════
# GIT STATUS
# ════════════════════════════════════════════════════════════════════

# Shows a quick summary of your current Git state.
# Useful before deploying to see exactly what's changed.
git-status:
	@echo ""
	@echo "$(BOLD)$(CYAN)Git Status$(RESET)"
	@echo "$(CYAN)──────────────────────────────────$(RESET)"
	@echo "$(BOLD)Branch:$(RESET)"
	@git branch --show-current
	@echo ""
	@echo "$(BOLD)Changed files:$(RESET)"
	@git status --short
	@echo ""
	@echo "$(BOLD)Last 5 commits:$(RESET)"
	@git log --oneline -5 2>/dev/null || echo "  No commits yet"
	@echo ""


# ════════════════════════════════════════════════════════════════════
# TURSO DATABASE
# ════════════════════════════════════════════════════════════════════

# Opens an interactive Turso shell for the production database.
#
# This is intentionally manual. We do NOT auto-overwrite Turso from local.db
# in the normal deploy command because production may contain real analytics
# or owner edits that should not be replaced accidentally.
#
# Requires:
#   turso CLI installed and logged in:
#     turso auth login
#
# Usage:
#   make db-prod-shell
#   make db-prod-shell TURSO_DB_NAME=another-db-name
db-prod-shell:
	@if ! command -v turso &> /dev/null; then \
		echo "$(RED)✗ Error: Turso CLI not installed.$(RESET)"; \
		exit 1; \
	fi
	turso db shell $(TURSO_DB_NAME)