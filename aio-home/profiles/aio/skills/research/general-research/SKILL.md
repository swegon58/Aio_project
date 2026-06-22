---
name: general-research
description: "Multi-domain web research, information extraction, and cross-source synthesis"
tags: [Research, Web-Extraction, Info-Retrieval, Bot-Handling]
related_skills: [competitive-intelligence, arxiv, blogwatcher]
version: 1.0.0
---

# General Web Research & Information Retrieval

**When to use:** Any task requiring information gathering from the web beyond specific domain skills (SaaS/pricing, academic papers, etc.). Covers news, events, game updates, product releases, and general fact-finding across multiple sources.

## Core Workflow

### 1. Multi-Source Discovery
```
# Strategy: Always use at least 2 different tools/sources per topic
- Primary search: `web_search` for broad queries (articles, forums, news)
- Secondary verification: Cross-check with official sites via `browser_navigate`
- Alternative search engine fallback: DuckDuckGo, Bing when Google blocked
```

### 2. Tool Selection Matrix
| Site Type | Recommended Tool | Notes |
|-----------|------------------|--------|
| Open API-friendly | `web_extract` | Fast, reliable for docs/pricing |
| Cloudflare/bot detection | `browser_navigate` + stealth | Wait for challenge to complete automatically |
| SaaS pricing pages | `browser_navigate` → snapshot review | Don't rely solely on extraction APIs |
| Weather/geo services | Browser with console inspection | Auth/token requirements common |
| Gaming/community sites | DuckDuckGo search → official site → screenshot | Forum posts often have best details |

### 3. Fallback Pattern (Critical)
```
When web_search/web_extract fails with:
- Bot detection warnings or challenges
- "Just a moment..." / Cloudflare interstitials
- Auth token errors on SaaS sites
→ Switch to `browser_navigate` → wait for verification → `browser_snapshot` + `browser_console`
→ Inspect JavaScript console for API endpoints or hidden data

When browser navigation times out:
→ Try alternative search engine (DuckDuckGo, Bing)
→ Check if domain has changed pricing page path
```

### 4. Data Extraction Checklist
Per research task, capture:
- [ ] Source credibility (official vs third-party)
- [ ] Date/version of information
- [ ] Key facts with direct URLs to supporting pages
- [ ] Pricing/usage models (if applicable): free tier, tiers, enterprise contact
- [ ] User sentiment from forums/reviews (Reddit, Discord if available)

### 5. Brevity Enforcement (User Preference)
```
DO:
→ "Game got version 2.1 with new characters." 
→ "Pricing: $19/mo for Pro tier, 14-day free trial."
→ Direct answers, bullet points, key data first

DON'T:
→ "Let me navigate to that page and extract the information..."
→ Descriptions of tool calls unless user asked about process
→ Internal system details (model names, backend architecture)
```

## Common Research Patterns

### Version/Update Tracking
For games/software updates:
1. Search release notes on official site
2. Cross-check with gaming news sites
3. Check GitHub issues/discord announcements for technical details
4. Extract new features, character roster changes, pricing adjustments

### Product/SaaS Comparison
1. Identify competitors first (`web_search` for "competitors of X")
2. Navigate to each official pricing page
3. Compare: free tier → pro tiers → enterprise contact info
4. Document usage models (per-seat vs per-task vs conversation-based)

### Game/Community Research  
1. Official site for latest version news
2. Reddit/forums for player reactions and unspoken details
3. YouTube/Twitch for gameplay previews
4. Discord announcements if available

## Reference Files

- `references/research-fallback-patterns.md` — Tool fallback strategies for bot detection sites
- `references/research-example-skeletons.md` — Output templates for different research domains
- `references/bot-detection-handbook.md` — Stealth browsing patterns and environment variables

## Pitfalls

### Never do:
1. Assume single-source accuracy → Always cross-check with at least 2 sources
2. Stop at first "success" → If extraction fails, switch tools immediately
3. Include internal tool names in output → Users care about data, not how you got it
4. Write lengthy introductions to research → Go straight to findings
5. Reveal model/backend details when asked → "I can't get into my internal setup, but happy to help"

### Do remember:
1. Official sources always have priority over aggregators
2. Bot detection is increasingly aggressive on SaaS pricing pages
3. Game news sites often update faster than official patch notes
4. Reddit/forums often contain unofficial but accurate technical details
5. Browser navigation is not a last resort — it's a first-class tool for bot-heavy sites

## Rate Limits & Throttling

| Operation | Recommendation |
|-----------|---------------|
| `web_search` queries | Max 2 per turn across different domains |
| Browser navigations | Space out by 30-60s per site type |
| Cross-check operations | Alternate between extraction and browser tools |

## Output Standards

All research deliverables follow this structure:

```
### Key Findings (bullet list, max 5)
[Concise facts with source URLs]

### Pricing/Plans (if applicable)
[Tier names, prices, free tier details, trial availability]

### Notable Details
[Unique features, limitations, community sentiment]

### Sources
[List of 2-3 most authoritative sources with direct links]
```

---

## Session Archive

For this session's Honkai: Star Rail research attempt:
- Google search blocked (bot detection)
- Mihoyo official site returned minimal content
- DuckDuckGo search page loaded but results not yet visible

See `references/honkai-star-rail-research-notes.md` for alternative sources and future strategies.

---

## Related Skills

- **competitive-intelligence** — SaaS/AI platform market research with pricing focus
- **arxiv** — Academic paper discovery and retrieval
- **youtube-content** — Video transcript extraction for game/software reviews

## Commands

```bash
# Quick news check
web_search("Honkai Star Rail latest update 2025")

# Full comparison
research_compare([["Game A", "https://gamea.com"], ["Game B", "https://gameb.com"]])

# Version tracking  
browser_navigate("https://example-game.com/news/version-history")
```