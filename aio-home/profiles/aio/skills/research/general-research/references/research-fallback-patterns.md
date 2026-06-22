# Research Fallback Patterns

## Bot Detection Handling

### When to Expect Bot Detection

These sites commonly block automated scraping:
- Google search results (most aggressive)
- Baidu, Yandex search engines
- SaaS pricing pages (Stripe checkout, Cloudflare protected)
- Weather services (weather.com, accuweather.com)
- Gaming news sites (kotaku.vice.com style aggregators)
- Facebook/Instagram (Meta's advanced protection)

### Tiered Response Strategy

#### Level 1: web_extract Fails with Auth Errors
```
Error observed: "Unauthorized: Invalid token" or "403 Forbidden"
Site type: Weather/geo services, authenticated-only content

Action → browser_navigate() to same URL
→ Wait 3-5 seconds for challenge page
→ browser_snapshot() to confirm page loaded
→ browser_console() to inspect for hidden endpoints
→ Extract from console/API calls if available
```

**Example - weather.com:**
```bash
web_extract(urls=["https://weather.com/weather/today"]) 
# → Returns auth error

browser_navigate(url="https://weather.com/weather/today")
# → Page loads with Cloudflare challenge
browser_snapshot()
# → Shows verification page or content if cached
```

#### Level 2: Google Search Blocked ("Just a moment...")
```
Error observed: Interstitial page, bot detection warning

Action sequence:
1. browser_navigate("https://google.com/search?q=QUERY")
2. browser_wait() — let challenge complete (5-10s)
3. browser_snapshot() — check if content loaded
4. If still blocked → browser_console() for hidden data/API

Alternative: browser_navigate("https://duckduckgo.com/?q=QUERY")
```

#### Level 3: Persistent Challenges Across Multiple Tools
```
When both web_extract AND browser_navigate struggle:

1. Try alternative search engines in order:
   - DuckDuckGo (fast, least aggressive)
   - Bing Web Search
   - Startpage (privacy-focused proxy to Google)

2. For gaming/community content:
   → Navigate to subreddit/forum directly
   → Check Discord server announcements
   → Look at GitHub issues for technical discussions

3. For pricing comparisons:
   → Official documentation pages often mirror pricing
   → Alternative: review G2/Capterra screenshots via web_extract
```

## Tool-Specific Fallbacks

### web_extract Timeout / No Response
```python
# Pattern: Try multiple endpoints in parallel
try:
    data = web_extract(urls=["primary_url", "alternative_path1", "alternative_path2"])
except TimeoutError:
    browser_navigate("primary_url")
    browser_wait(3)
    content = browser_snapshot()
    return extract_from_snapshot(content)
```

### browser_navigate Hangs/Blocks
```python
# If navigation takes >10 seconds without completion:
# → Cancel current operation
# → Try direct GitHub source (for open-source projects)
# → Use cached version via web.archive.org if available
```

## Environment Variables for Stealth

For Scale plan (if available):
- `BROWSERBASE_ADVANCED_STEALTH=true` — Advanced stealth mode with JavaScript injection
- `BROWSERBASE_EXTRA_SLOW_DOWNLOAD=false` — Faster loading when speed not critical

These should be set before browser operations on high-bot-detection sites.

## Common Error Patterns

| Error Message | Meaning | Fallback Action |
|---------------|---------|-----------------|
| "Just a moment..." | Cloudflare challenge | browser_navigate + wait 5s |
| "Unauthorized: Invalid token" | SaaS auth required | browser_console for hidden APIs |
| Timeout/ERR_NAME_NOT_RESOLVED | Domain not found or blocked | Try alternative search engine |
| Empty snapshot after navigation | Page is SPA/API-based | console() for network requests |
| 403 Forbidden on web_extract | Bot detection triggered | browser_navigate with stealth |

## Extraction Priority Order

1. **Official documentation** (developer docs, blog posts, changelogs)
2. **Community discussions** (Reddit threads, forum posts, Discord)
3. **News aggregators** (gaming news sites, tech blogs)
4. **Social media** (Twitter/X posts from official accounts)

Never stop at first source — always cross-check with at least 2.

---

## Session Notes: Honkai: Star Rail Research Attempt

### Attempts Made:
1. `web_search("Honkai Star Rail latest news update 2025")` → Google blocked
2. `browser_navigate("https://www.mihoyo.com/en/company/game/honkaistar/rail/")` → Minimal content
3. DuckDuckGo search page loaded but no results yet visible

### Alternative Sources to Try:
- **Official Weibo**: 崩坏：星穹铁道 official account (Chinese language)
- **YouTube channels**: Game-specific reviewers often post version updates before patch notes
- **Reddit r/HonkaiStarRail** — Patch announcements and community reactions
- **Discord server** — Official HoYoverse Discord has version update threads

### Future Strategy:
```
For game update tracking:
1. Subscribe to official Discord announcements
2. Monitor YouTube creators who cover specific games
3. Use Reddit r/HonkaiStarRail as secondary source
4. Check SteamDB for release notes (if on Steam)
```

**Key takeaway**: Gaming news requires community sources as first-class citizens, not just official sites.