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
#   make git-setup remote=...   first-time Git repo initialisation
#   make git-status             show current git status at a glance
#
# REQUIREMENTS:
#   - Node.js >=20 (node --version)
#   - npm >=10    (npm --version)
#   - Git         (git --version)
#   - Vercel CLI  (vercel --version) ← install: npm i -g vercel
# ═══════════════════════════════════════════════════════════════════


# ── Configuration ──────────────────────────────────────────────────
# These variables are used throughout the Makefile.
# Change BRANCH if you use a different production branch name.

BRANCH        := main
ENV_PROD_FILE := .env.production
ENV_DEV_FILE  := .env.development
BUILD_DIR     := .svelte-kit

# ── GitHub Repository Metadata ─────────────────────────────────────
# Used by make repo-settings.
#
# GITHUB_REPO:
#   Format: owner/repo
#   Example: VSRKDPiRaTe/portfolio
#
# REPO_TOPICS:
#   Comma-separated topics. GitHub topics should be lowercase and hyphenated.
GITHUB_REPO  ?=
REPO_DESC    ?= Cyberpunk SvelteKit portfolio with owner dashboard, GitHub repo sync, analytics, and live content management.
REPO_HOME    ?=
REPO_TOPICS  ?= sveltekit,portfolio,vercel,turso,github-api,cyberpunk,full-stack

# ── Turso Database Deployment ──────────────────────────────────────
# Used by make db-prod-schema and make db-prod-shell.
#
# TURSO_DB_NAME:
#   Name of the production Turso database.
#
# DB_SCHEMA_FILE:
#   Schema file to run against Turso.
TURSO_DB_NAME ?= portfolio
DB_SCHEMA_FILE := scripts/schema.sql

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

.PHONY: help dev check build preview clean sync-env deploy deploy-preview git-setup git-status repo-settings repo-open db-prod-schema db-prod-shell


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
	@echo "  $(GREEN)make build$(RESET)                  Build for production locally"
	@echo "  $(GREEN)make preview$(RESET)                Preview production build at localhost"
	@echo "  $(GREEN)make clean$(RESET)                  Remove all build artifacts"
	@echo ""
	@echo "$(BOLD)Deployment$(RESET)"
	@echo "  $(GREEN)make sync-env$(RESET)               Push .env.production → Vercel"
	@echo "  $(GREEN)make deploy msg='feat: ...'$(RESET)  Sync env + commit + push to GitHub"
	@echo "  $(GREEN)make deploy-preview$(RESET)         Deploy to preview URL (not production)"
	@echo ""
	@echo "$(BOLD)Database$(RESET)"
	@echo "  $(GREEN)make db-prod-schema TURSO_DB_NAME=name$(RESET)"
	@echo "                                Run scripts/schema.sql on Turso production DB"
	@echo "  $(GREEN)make db-prod-shell TURSO_DB_NAME=name$(RESET)"
	@echo "                                Open Turso DB shell"
	@echo ""
	@echo "$(BOLD)Git$(RESET)"
	@echo "  $(GREEN)make git-setup remote=URL$(RESET)   First-time repo init + push to GitHub"
	@echo "  $(GREEN)make git-status$(RESET)             Show current branch, status, and log"
	@echo ""
	@echo "  $(GREEN)make repo-settings GITHUB_REPO=owner/repo REPO_HOME=https://site.com$(RESET)"
	@echo "                                      Update GitHub repo description, homepage, topics"
	@echo "  $(GREEN)make repo-open$(RESET)                Open GitHub repo in browser"
	@echo ""
	@echo "$(BOLD)Examples$(RESET)"
	@echo "  make deploy msg=\"feat: add GitHub API integration\""
	@echo "  make git-setup remote=https://github.com/yourusername/portfolio.git"
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
	@echo "$(GREEN)✓ No errors found$(RESET)"


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
	@echo "$(CYAN)Previewing production build at http://localhost:4173$(RESET)"
	npm run preview


# Removes all build artifacts and caches.
# Use this if you hit weird build errors — clean slate fixes most things.
# node_modules is left intact (no need to re-run npm install after this).
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	rm -rf $(BUILD_DIR) build .vercel/output
	@echo "$(GREEN)✓ Cleaned$(RESET)"


# ════════════════════════════════════════════════════════════════════
# ENVIRONMENT VARIABLES & DEPLOYMENT
# ════════════════════════════════════════════════════════════════════

# Pushes all variables from .env.production to Vercel's production
# environment. Runs before every deploy so Vercel always has the
# latest values at build time.
#
# How it works:
#   1. Reads each line from .env.production
#   2. Skips blank lines and comments (lines starting with #)
#   3. Removes the old value from Vercel (if it exists)
#   4. Pushes the new value to Vercel production environment
#
# Requires: vercel CLI logged in (run `vercel login` once)
sync-env:
	@echo "$(CYAN)Syncing $(ENV_PROD_FILE) → Vercel production...$(RESET)"
	@if [ ! -f $(ENV_PROD_FILE) ]; then \
		echo "$(RED)✗ Error: $(ENV_PROD_FILE) not found.$(RESET)"; \
		echo "  Create it first: cp .env.example .env.production"; \
		exit 1; \
	fi
	@if ! command -v vercel &> /dev/null; then \
		echo "$(RED)✗ Error: Vercel CLI not installed.$(RESET)"; \
		echo "  Install it: npm install -g vercel"; \
		exit 1; \
	fi
	@echo "$(CYAN)  Removing existing Vercel production vars...$(RESET)"
	@grep -v '^#' $(ENV_PROD_FILE) | grep -v '^$$' | cut -d= -f1 | while read key; do \
		vercel env rm $$key production --yes 2>/dev/null || true; \
	done
	@echo "$(CYAN)  Pushing new vars to Vercel...$(RESET)"
	@grep -v '^#' $(ENV_PROD_FILE) | grep -v '^$$' | while IFS='=' read -r key value; do \
		echo "    → $$key"; \
		printf '%s' "$$value" | vercel env add $$key production; \
	done
	@echo "$(GREEN)✓ Env vars synced to Vercel production$(RESET)"


# Full production deployment in one command.
#
# Flow:
#   1. Validate a commit message was provided
#   2. Run static analysis (catch errors before they hit prod)
#   3. Sync .env.production vars to Vercel
#   4. Stage ALL changes (git add .)
#   5. Commit with your message
#   6. Push to GitHub main branch
#   7. Vercel detects the push and auto-builds + deploys
#
# Usage: make deploy msg="feat: add GitHub API integration"
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
	@echo "$(BOLD)$(CYAN)Starting deployment pipeline...$(RESET)"
	@echo ""
	@echo "$(CYAN)Step 1/5 — Running static analysis...$(RESET)"
	@$(MAKE) check --no-print-directory
	@echo "$(CYAN)Step 2/5 — Syncing env vars to Vercel...$(RESET)"
	@$(MAKE) sync-env --no-print-directory
	@echo "$(CYAN)Step 3/5 — Staging all changes...$(RESET)"
	git add .
	@echo "$(CYAN)Step 4/5 — Committing: \"$(msg)\"$(RESET)"
	git commit -m "$(msg)"
	@echo "$(CYAN)Step 5/5 — Pushing to GitHub (branch: $(BRANCH))...$(RESET)"
	git push origin $(BRANCH)
	@echo ""
	@echo "$(GREEN)$(BOLD)✓ Deployment triggered!$(RESET)"
	@echo "$(GREEN)  Vercel is building now — track progress at:$(RESET)"
	@echo "$(GREEN)  https://vercel.com/dashboard$(RESET)"
	@echo ""


# Deploys to a Vercel PREVIEW URL — does NOT touch production.
# Use this to share a live link for review before going to prod.
# Each preview gets a unique URL like: portfolio-abc123.vercel.app
deploy-preview:
	@echo "$(CYAN)Deploying to preview (not production)...$(RESET)"
	vercel
	@echo "$(GREEN)✓ Preview deployed. Check the URL above.$(RESET)"

# ════════════════════════════════════════════════════════════════════
# GITHUB REPOSITORY METADATA
# ════════════════════════════════════════════════════════════════════

# Updates GitHub repository metadata:
#   - description
#   - website / homepage
#   - topics
#
# This is useful because the GitHub repo "About" panel is part of the
# portfolio presentation. Recruiters often see this before opening code.
#
# Requires:
#   gh CLI installed and logged in:
#     gh auth login
#
# Usage:
#   make repo-settings GITHUB_REPO=VSRKDPiRaTe/portfolio REPO_HOME=https://your-site.vercel.app
repo-settings:
	@if [ -z "$(GITHUB_REPO)" ]; then \
		echo "$(RED)✗ Error: GITHUB_REPO is required.$(RESET)"; \
		echo "  Usage: make repo-settings GITHUB_REPO=owner/repo REPO_HOME=https://your-site.vercel.app"; \
		exit 1; \
	fi
	@if ! command -v gh &> /dev/null; then \
		echo "$(RED)✗ Error: GitHub CLI not installed.$(RESET)"; \
		echo "  Install it: https://cli.github.com"; \
		exit 1; \
	fi
	@echo "$(CYAN)Updating GitHub repo settings for $(GITHUB_REPO)...$(RESET)"
	gh repo edit $(GITHUB_REPO) \
		--description "$(REPO_DESC)" \
		--homepage "$(REPO_HOME)" \
		--add-topic "$(REPO_TOPICS)"
	@echo "$(GREEN)✓ GitHub repo settings updated$(RESET)"


# Opens the GitHub repository in the browser.
# If GITHUB_REPO is provided, opens that repo.
# Otherwise gh uses the current folder's origin remote.
repo-open:
	@if ! command -v gh &> /dev/null; then \
		echo "$(RED)✗ Error: GitHub CLI not installed.$(RESET)"; \
		exit 1; \
	fi
	@if [ -z "$(GITHUB_REPO)" ]; then \
		gh repo view --web; \
	else \
		gh repo view $(GITHUB_REPO) --web; \
	fi

# ════════════════════════════════════════════════════════════════════
# GIT SETUP & STATUS
# ════════════════════════════════════════════════════════════════════

# Initialises a Git repo and pushes to GitHub for the FIRST TIME.
# Run this ONCE when setting up the project — never again after that.
#
# What it does:
#   1. Checks your git identity is configured (name + email)
#   2. Checks the remote URL was provided
#   3. Initialises git in this folder (git init)
#   4. Stages everything except git-ignored files
#   5. Makes the initial commit
#   6. Renames branch to main (git default is still master on some systems)
#   7. Adds your GitHub repo as the remote origin
#   8. Pushes everything up
#
# Usage:
#   make git-setup remote=https://github.com/yourusername/portfolio.git
#
# Before running:
#   1. Create an EMPTY repo on github.com (no README, no .gitignore)
#   2. Copy the HTTPS URL from GitHub
#   3. Run this command with that URL
git-setup:
	@echo "$(CYAN)Checking git configuration...$(RESET)"
	@if [ -z "$(remote)" ]; then \
		echo "$(RED)✗ Error: GitHub remote URL required.$(RESET)"; \
		echo "  Usage: make git-setup remote=https://github.com/yourusername/portfolio.git"; \
		echo "  Step 1: Create an EMPTY repo at github.com (no README, no .gitignore)"; \
		echo "  Step 2: Copy the HTTPS URL and run this command"; \
		exit 1; \
	fi
	@GIT_NAME=$$(git config --global user.name); \
	GIT_EMAIL=$$(git config --global user.email); \
	if [ -z "$$GIT_NAME" ] || [ -z "$$GIT_EMAIL" ]; then \
		echo "$(RED)✗ Error: Git identity not configured.$(RESET)"; \
		echo "  Run these first:"; \
		echo "    git config --global user.name \"Your Name\""; \
		echo "    git config --global user.email \"your@email.com\""; \
		exit 1; \
	fi; \
	echo "$(GREEN)  Git identity: $$GIT_NAME <$$GIT_EMAIL>$(RESET)"
	@if [ -d .git ]; then \
		echo "$(YELLOW)  Warning: .git already exists — skipping git init$(RESET)"; \
	else \
		echo "$(CYAN)Initialising git repository...$(RESET)"; \
		git init; \
	fi
	@echo "$(CYAN)Staging all files...$(RESET)"
	git add .
	@echo "$(CYAN)Creating initial commit...$(RESET)"
	git commit -m "chore: initial commit"
	@echo "$(CYAN)Setting branch to main...$(RESET)"
	git branch -M main
	@if git remote get-url origin 2>/dev/null; then \
		echo "$(YELLOW)  Remote 'origin' already exists — updating URL$(RESET)"; \
		git remote set-url origin $(remote); \
	else \
		echo "$(CYAN)Adding remote origin...$(RESET)"; \
		git remote add origin $(remote); \
	fi
	@echo "$(CYAN)Pushing to GitHub...$(RESET)"
	git push -u origin main
	@echo ""
	@echo "$(GREEN)$(BOLD)✓ Repository live on GitHub!$(RESET)"
	@echo "$(GREEN)  Next steps:$(RESET)"
	@echo "$(GREEN)  1. Go to vercel.com → New Project$(RESET)"
	@echo "$(GREEN)  2. Import your portfolio repo from GitHub$(RESET)"
	@echo "$(GREEN)  3. Vercel auto-detects SvelteKit — just click Deploy$(RESET)"
	@echo ""


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

# Runs the schema file against the production Turso database.
#
# This creates/updates tables and indexes defined in scripts/schema.sql.
# It does NOT import local data unless your schema file contains inserts.
#
# Requires:
#   turso CLI installed and logged in:
#     turso auth login
#
# Usage:
#   make db-prod-schema TURSO_DB_NAME=portfolio
db-prod-schema:
	@if [ ! -f $(DB_SCHEMA_FILE) ]; then \
		echo "$(RED)✗ Error: $(DB_SCHEMA_FILE) not found.$(RESET)"; \
		exit 1; \
	fi
	@if ! command -v turso &> /dev/null; then \
		echo "$(RED)✗ Error: Turso CLI not installed.$(RESET)"; \
		echo "  Install: curl -sSfL https://get.tur.so/install.sh | bash"; \
		exit 1; \
	fi
	@echo "$(CYAN)Running $(DB_SCHEMA_FILE) on Turso DB: $(TURSO_DB_NAME)...$(RESET)"
	turso db shell $(TURSO_DB_NAME) < $(DB_SCHEMA_FILE)
	@echo "$(GREEN)✓ Turso schema applied$(RESET)"


# Opens an interactive Turso shell.
#
# Usage:
#   make db-prod-shell TURSO_DB_NAME=portfolio
db-prod-shell:
	@if ! command -v turso &> /dev/null; then \
		echo "$(RED)✗ Error: Turso CLI not installed.$(RESET)"; \
		exit 1; \
	fi
	turso db shell $(TURSO_DB_NAME)