---
name: competitive-intelligence
description: Research competitors, pricing plans, and market analysis for SaaS/AI platforms
trigger: When asked about competitors, pricing comparisons, or market research in any domain
---

# Competitive Intelligence Research

**When to use:** Researching competitors, pricing plans, feature comparisons, market analysis for SaaS/automation/AI platforms.

## Workflow

1. **Identify competitors first** via `web_search` or `web_extract` with broad queries before diving into specific pages.

2. **Choose extraction tool based on site type:**
   - `web_extract` for sites that cooperate (open API-friendly pricing pages)
   - `browser_navigate` + `browser_snapshot` for sites with Cloudflare/bot detection (enable stealth if available)
   - Never rely solely on Firecrawl when auth issues occur

3. **Handle common blockers:**
   - "Just a moment..." / Cloudflare challenges → browser navigate, wait for verification to complete
   - 404/ERR_NAME_NOT_RESOLVED → domain may not exist or pricing page path changed
   - Bot detection warnings → consider `BROWSERBASE_ADVANCED_STEALTH=true` if on Scale plan

4. **Extract key data points per platform:**
   - Pricing tiers and thresholds
   - Free trial availability/duration
   - Usage models (per-task, per-seat, per-conversation)
   - Enterprise pricing contact options
   - Feature gating by tier

## Common Data Sources

- Official pricing pages (primary source)
- GitHub repos for open-source alternatives
- Review aggregators (G2, Capterra, etc.) when direct access blocked
- Comparison articles and analyst reports

## Output Format

Structure findings into:
1. **Competitor list** with URL and positioning
2. **Pricing comparison table** (always include: Free Trial? Free Plan? Tier 1? Tier 2? Enterprise?)
3. **Pricing model analysis** (task-based vs seat-based vs hybrid)
4. **Notable observations** (unique features, gaps in market, common pitfalls)

## Pitfalls

- Don't assume competitor URLs follow predictable paths — test multiple endpoints
- "Free forever" plans often have usage caps (tasks, conversations, seats) hidden in fine print
- Bot detection is aggressive on SaaS pricing pages — don't waste tokens on failed scrapes
- Enterprise pricing usually requires direct contact; document that this is a class of blocker

## References

- See `references/pricing-patterns.md` for SaaS pricing model classifications
- See `references/bot-detection-handbook.md` for stealth browsing patterns and tool fallback strategies
- See `references/competitor-analysis-example.md` for output format examples and historical research findings