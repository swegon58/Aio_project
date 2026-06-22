# Bot Detection Handbook — Research Edition

## Overview

Bot detection is increasingly aggressive on modern websites. This document provides condensed reference patterns for common scenarios encountered during general research tasks.

**Not a replacement for site-specific guidance** in skills like `competitive-intelligence`, but a fallback reference when encountering unexpected blocking.

---

## Tiered Response to Blocking

### Level 1: Minor Delays or Retryable Errors
```
Pattern: "Loading..." spinner, slow page transitions

Action → Wait 3-5 seconds, then browser_snapshot()
If no change after 10s → Proceed to Level 2
```

**Example:**
```python
browser_navigate(url="https://example.com/news")
# If spinner appears, wait
import time
time.sleep(5)
content = browser_snapshot()
return extract_key_data(content)
```

### Level 2: Cloudflare/Interstitial Pages
```
Pattern: "Just a moment...", challenge pages, CAPTCHA

Action → Continue waiting (up to 10s for challenge completion)
→ If still blocked → switch to console inspection
```

**Example:**
```python
browser_navigate("https://cloudflare-protected-site.com/pricing")
# Wait for challenge
browser_wait(seconds=8)
snapshot = browser_snapshot()
console_data = browser_console()

# Sometimes console reveals hidden API endpoint
if "API call" in console_data:
    url_match = re.search(r'fetch\("([^"]+)"', console_data)
    if url_match:
        return web_extract([url_match.group(1)])
```

### Level 3: Persistent Blocking After Multiple Attempts
```
Pattern: Same error after 2-3 retries across different tools

Action → Switch tool entirely
→ Try alternative search engine (DuckDuckGo, Bing)
→ Check GitHub issues for workaround documentation
```

---

## Stealth Mode Variables (Scale Plan Only)

Set these environment variables before browser operations on high-risk sites:

```bash
export BROWSERBASE_ADVANCED_STEALTH=true   # JavaScript injection for fingerprint spoofing
export BROWSERBASE_EXTRA_SLOW_DOWNLOAD=false  # Faster loading when speed acceptable
```

**When to enable:** SaaS pricing pages, weather services, gaming news aggregators
**When not needed:** Official documentation sites, community forums, open-source repositories

---

## Site-Specific Patterns

### Google Search (Most Aggressive)
```
Common errors: "Just a moment...", bot detection warnings
Fallback → DuckDuckGo or Bing for same query
Direct URL navigation often works even when search doesn't
```

### Weather Services (weather.com, etc.)
```
Common errors: "Unauthorized: Invalid token", 403 Forbidden
Reason: Residential proxy requirement on backend API calls
Solution → browser_navigate + console inspection for cached data
Note: Direct API access usually requires paid subscription anyway
```

### SaaS Pricing Pages
```
Common errors: Cloudflare interstitials, 403 on web_extract
Pattern: Stripe checkout pages detect non-residential IPs
Fallback → Official documentation mirrors often have same pricing
Alternative → G2/Capterra screenshots via web_extract (usually no auth)
```

### Gaming News/Reviews Sites
```
Common errors: Mixed bot detection depending on content type
Pattern: Reviews work, real-time updates blocked
Solution → Check official patch notes first, then aggregator sites
Community forums often have most accurate/unofficial details
```

---

## Tool Fallback Hierarchy (For General Research)

```
Priority 1: web_extract (API-first, fast for cooperative sites)
Priority 2: browser_navigate + snapshot (fallback for bot-heavy sites)
Priority 3: console inspection (last resort for hidden APIs)
Alternative: Alternative search engine when primary blocked
```

**Implementation Pattern:**
```python
def research_with_fallback(topic):
    """Try multiple approaches before giving up"""
    
    # Level 1: Direct extraction
    try:
        return web_extract([f"https://target-site.com/pricing"])
    except (TimeoutError, AuthError):
        pass
    
    # Level 2: Browser navigation
    try:
        browser_navigate(f"https://target-site.com/pricing")
        time.sleep(5)  # Wait for challenges
        return browser_snapshot()
    except TimeoutError:
        pass
    
    # Level 3: Console inspection
    try:
        console = browser_console(clear=True)
        if "API" in console or "fetch" in console:
            api_urls = re.findall(r'fetch\("([^"]+)"', console)
            return web_extract(api_urls[:2])
    except:
        pass
    
    # Level 4: Alternative source
    search_result = web_search(f"{topic} pricing comparison")
    return parse_from_alternative_sources(search_result)
```

---

## Common Error Messages & Meanings

| Error | Meaning | Action |
|-------|---------|--------|
| "Just a moment..." | Cloudflare challenge in progress | Wait 5-10s, then snapshot |
| "Unauthorized: Invalid token" | SaaS API auth required (proxy issue) | Switch to browser inspection |
| ERR_NAME_NOT_RESOLVED | Domain blocked or doesn't exist | Try alternative source |
| TimeoutError on web_extract | Bot detection triggered | Switch to browser_navigate |
| Empty snapshot after nav | SPA/API-based, no direct DOM | Console() for network requests |

---

## Rate Limiting Guidelines

To avoid triggering bot detection:

- **web_search queries**: Max 2 per turn (different domains)
- **Browser navigations**: Space by 30-60s per site type
- **Cross-check operations**: Alternate extraction vs browser tools
- **Same-URL retries**: Wait minimum 15s between attempts

---

## When Bot Detection Is Expected (Prepared for It)

These sites commonly require fallback patterns:

✓ SaaS pricing pages with Stripe checkout
✓ Weather services (weather.com, accuweather.com, etc.)
✓ Google/Baidu search results
✓ Facebook/Instagram profile pages
✓ TikTok/Douyin video pages
✓ GitHub repositories with strict protection

**For these**: Always plan Level 2+ fallback in your workflow.

---

## Session Reference

This document condensed from patterns observed during:
- Honkai: Star Rail research (Google bot detection failures)
- SaaS pricing comparisons (Stripe auth errors)
- Weather data retrieval (residential proxy requirements)

See `research/general-research/references/research-fallback-patterns.md` for complete implementation examples and session archives.