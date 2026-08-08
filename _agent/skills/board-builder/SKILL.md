---
name: board-builder
description: GitHub API & Vercel serverless based CMS static board homepage builder
---

# Board Builder Skill Specification

This skill outlines the structure and operation of the serverless static board CMS.

## Architecture

- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS (CDN).
- **Storage**: GitHub REST API (`data/posts.json`) with LocalStorage caching fallback.
- **Config**: `/api/config` Vercel Serverless Function combined with `config/git_config.json`.
- **Routing**: `vercel.json` zero-config with `cleanUrls: true`.

## Key Files

- `index.html`: Main landing page with real estate services, agent profile, latest posts dynamic preview, and consultation form modal.
- `news.html`: Board listing page with category filters, real-time search, sidebar profile, and mobile bottom navigation.
- `news-detail.html`: Post detail page with full custom markdown rendering and admin edit/delete controls.
- `news-write.html`: Admin post creation and editing page with markdown preview.
- `admin.html`: Admin authentication and post management dashboard.
- `db.js`: LocalStorage & GitHub API hybrid data management script.
