# ScanMitra Frontend

ScanMitra is a real-time slot booking and queue management platform for diagnostic centers.
This repository currently contains the integrated Next.js application workspace where frontend UI and backend planning live together in one monorepo structure.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4

## Project Naming

All project naming in this repository uses ScanMitra.
Older MedQueue naming has been removed from project documentation.

## Monorepo Structure

- frontend-scanmitra: Next.js application codebase
- docs: product and architecture documentation (including backend roadmap)

There is no separate backend repository required.
Backend implementation is intended to stay integrated in this same monorepo.

## Documentation

- Product and implementation spec: docs/doc.md
- Backend roadmap: docs/Backend.md
- Architecture document: docs/scanmitra-architecture (1).html
- Business model presentation: docs/ScanMitra BMC ppt.pptx

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Run development server:

```bash
npm run dev
```

3. Open browser:

```text
http://localhost:3000
```

## Quality Checks

- Lint: npm run lint
- Build: npm run build

## Current Status

The codebase is a customized dashboard foundation with ScanMitra branding updates.
Feature-complete patient and center workflows should be validated against the architecture and PPT scope documents.
