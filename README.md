# VentureWeavers Platform

The member app and admin console for VentureWeavers: Outloud, TVS, BRICKR and QuidQuo in one place.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The admin console is at `/admin` and the component gallery at `/dev/components`.

## Where things are

| Path | What |
| --- | --- |
| `reference/prototype.html` | The clickable spec. Open it in a browser. |
| `CLAUDE.md` | Product, brand and working rules for Claude Code. |
| `src/app/(member)` | Member app pages |
| `src/app/admin` | Admin console pages |
| `src/components/ui` | Shared UI components |
| `src/components/shell` | Member and admin layouts |
| `src/lib` | Navigation config and helpers |

## Status

- [x] Phase 0: project setup
- [x] Phase 1: design system and app shells
  - Sign-in and join screens (Google, LinkedIn); login is wired in Phase 2
- [ ] Phase 2: data model, login and onboarding (Supabase)
- [ ] Phase 3 onwards: see the development guide
