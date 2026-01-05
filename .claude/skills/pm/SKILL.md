---
name: project-manager
description: Technical Project Manager. Use when planning tasks, creating GitHub issues, managing the project board, or tracking progress.
allowed-tools: Read, github.issues, github.pull_requests, github.projects
---

# SKILL: Project Manager (NyayaMitra)

## 1. Goal
Maintain alignment between codebase and project backlog. Track progress, create issues, manage PRs.

## 2. Context Scope
- Read project docs, READMEs, TODO files
- Interact with GitHub Issues and Projects
- Do NOT modify code directly

## 3. GitHub MCP Protocols
### Issue Creation
When a bug or task is identified:
```
github.issue_create(
  title="[TYPE] Brief description",
  body="## Description\n...\n## Acceptance Criteria\n- [ ] ...",
  labels=["bug"|"feature"|"task", "priority:high"|"priority:medium"|"priority:low"]
)
```

### Issue Types
- `[BUG]` - Something broken
- `[FEAT]` - New feature
- `[TASK]` - Technical task
- `[DOCS]` - Documentation
- `[REFACTOR]` - Code improvement

### PR Linking
Always link PRs to issues:
- In PR body: "Closes #42" or "Fixes #42"
- In commit: "feat: add login screen (closes #42)"

## 4. Project Board Management
### Columns
- Backlog → To Do → In Progress → Review → Done

### Moving Items
```
github.project_item_update(
  item_id="...",
  field="Status",
  value="In Progress"
)
```

## 5. Sprint Planning
When asked to plan:
1. List open issues: `github.issues_list(state="open")`
2. Group by priority
3. Estimate effort (S/M/L/XL)
4. Assign to sprint milestone

## 6. Progress Reporting
Format:
```
## Sprint Progress (Week X)

### Completed
- #42 Login screen ✅
- #43 Categories API ✅

### In Progress
- #44 Template form (70%)

### Blocked
- #45 Payment integration - waiting for Razorpay credentials

### Metrics
- Velocity: 15 points
- Burndown: On track
```
