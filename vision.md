# Vision (site): see docs/brief.md, mirrored here for the pipeline

**Purpose:** a showcase and outreach page for Homeroom. **Not** a product launch: no waitlist, pricing or sign-up.

**Sections:**
1. **What it is:** a photo frame first, with two registers: the Wall (photos, quiet info) and the Rail (a touch opens today, week, meals, chores, home, cameras).
2. **Who it's for:** a household. The adults interact, everyone glances, and phones are for planning.
3. **Why:** in the owner's own words (gathered at intake; never invented).
4. **How it's built:** local-first (one small server, borrowing Home Assistant, Immich, Google Calendar and Family Hub), and built by an agentic studio: PM → Designer → Architect → Dev → QE, with the owner as the gate.
5. **Build log:** short entries for page-worthy milestones.

**Hard rules:**
- **Privacy:** no real household data (names, calendar, config, addresses, metadata). Text and examples come from the product's sample-data build (the sample household Avery, Jordan, Sam and Riley). **Imagery may use the owner-approved photos in `source-photos/owner/`** (owner, 2026-11-02) so the wall looks real; otherwise the fake photos. A privacy check runs on every PR.
- **Static site:** no runtime server, fast, works at phone width. Deployed with Cloudflare Pages (owner account step).
- **Voice:** plain, warm, specific; no hype.

The agent rules (triage, entry shape, voice, privacy) live in the pipeline brain at `projects/site.md`. Product context comes from the product repo's `vision.md` and `docs/design/studio-design.md`, read with `gh`.
