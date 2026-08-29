# Deploying Todo Planner to Vercel

This repository contains two deployable projects. Create both Vercel projects
from the same GitHub repository.

## 1. API project

- Project name: `todo-list-api`
- Root Directory: `server`
- Framework Preset: Express
- Environment variables:
  - `DATABASE_URL`: the hosted PostgreSQL connection string
  - `DB_SSL`: `true`

Deploy the project, then verify:

```text
https://todo-list-api.vercel.app/
```

The response should contain `Todo API is running`.

## 2. Web project

- Project name: `todo-list-web`
- Root Directory: `todo_list`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variable:
  - `VITE_API_BASE`: `https://todo-list-api.vercel.app/api`

Use the actual API deployment URL from step 1. Apply the environment variable
to Production, Preview, and Development, then redeploy the web project.

## GitHub integration

Grant the Vercel GitHub App access to `mindnonthiya/todo-list-app`. Both Vercel
projects can use the same repository; their Root Directory settings determine
which application each project deploys.
