# Free API Strategy

Floodlit now runs without Anthropic or any paid LLM key. The tactical layer is
an auditable local engine in `lib/free-analysis.ts` that uses normalized match
data, lineups, events, stats, score state, and tournament context.

## Current Sources

- ESPN hidden endpoints: default no-key live fixtures, standings, match detail,
  lineups, events, and basic stats.
- API-Football: optional free-tier enrichment. Use sparingly because the free
  plan is quota-limited; the app already falls back to ESPN.
- Local prediction snapshots: `data/predictions/latest.json`,
  `data/ratings/latest.json`, and history snapshots.

## Safe Add-Ons

- football-data.org: free plan can add fixtures, delayed scores, schedules, and
  league tables. Good as a second opinion, not a live primary source.
- TheSportsDB: free JSON sports API for team/event metadata and artwork.
- ScoreBat: free feed for highlights/video modules, with branding/ads limits.
- Wikidata SPARQL: free public knowledge graph for team metadata, venues,
  country facts, aliases, and historical enrichment.
- OpenFootball: public-domain historical football datasets for offline context.

## Analysis Policy

- Never block the app on one provider.
- Prefer no-key ESPN first for liveness, then optional keyed/free-tier providers
  for enrichment.
- Cache aggressively and expose source/cached metadata in API responses.
- Keep tactical text deterministic unless a future free/local model is added.
- Do not claim computer vision in free mode. Frame upload returns a tactical
  checklist unless `CV_SERVICE_URL` points to a real external service.

## Highest-Impact Next Integrations

1. Add a `lib/enrichment.ts` fan-in layer that joins ESPN matches with optional
   API-Football, football-data.org, TheSportsDB, Wikidata, and local snapshots.
2. Add provider confidence badges to match detail: `live`, `delayed`, `metadata`,
   `prediction`, and `media`.
3. Add a highlights rail powered by ScoreBat's free feed.
4. Add Wikidata venue/team profiles for travel, climate, altitude, aliases, and
   federation metadata.
5. Add historical priors from OpenFootball/local CSV snapshots into the
   prediction and scenario pages.
