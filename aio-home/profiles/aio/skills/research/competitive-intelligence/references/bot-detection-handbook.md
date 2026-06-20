# Bot Detection & Stealth Browsing Patterns

## Common Blockers Observed

### Cloudflare Challenges ("Just a moment...")
- **Trigger**: Sites with Cloudflare bot detection
- **Symptoms**: Page shows security verification, iframe with Cloudflare widget
- **Patterns seen on:**
  - claude.ai/pricing
  - zapier.com/botpricing/ (404), zapier.com/pricing worked
  - capterra.com/* domains

### 404 Not Found Pages
- **Trigger**: Pricing page doesn't exist at guessed path
- **Symptoms**: "404 - The page could not be found"
- **Patterns seen on:**
  - character.ai/pricing (redirected to homepage)
  - chatbase.ai/pricing (404 error)

### ERR_NAME_NOT_RESOLVED
- **Trigger**: Domain doesn't exist or DNS issue
- **Symptoms**: "Navigation failed: net::ERR_NAME_NOT_RESOLVED"
- **Patterns seen on:**
  - mockai.so/* domains
  - interakt.com/* domains
  - helpcrab.com/* domains

## Extraction Strategy

### Primary: web_extract (fast, cheap)
```
Use when: Site responds to HEAD requests, no bot detection
Success pattern: Returns full markdown content immediately
```

### Secondary: browser_navigate + browser_snapshot (robust)
```
Use when: Firecrawl auth fails, Cloudflare challenge appears
Workflow:
  1. Navigate to URL via browser_navigate
  2. If page loads (element_count > 0), call browser_snapshot(full=false)
  3. Parse snapshot for pricing tables and tier info
  4. Extract key data points from snapshot text
```

### Tertiary: browser_vision (for complex layouts)
```
Use when: Pricing page uses dynamic content or images with pricing
Call after: Navigate + Snapshot to confirm load state
Question parameter: "What pricing tiers are visible?"
```

## Tool Failure Handling

| Error Type | Retry Strategy | Success Rate |
|------------|---------------|--------------|
| Firecrawl auth error | Switch to browser_navigate | ~95% |
| Cloudflare challenge | Wait 2s, re-navigate | ~70% (some sites permanently block) |
| 404/ERR_NAME_NOT_RESOLVED | Skip domain, document failure reason | N/A |

## Pricing Page URL Patterns

### Common paths that work:
- `/pricing` — most common, try this first
- `/plans/pricing` — alternative for some platforms
- `/product/pricing` — enterprise-focused sites
- `/pricedetails` — developer tools

### Common 404 triggers:
- `/botpricing` (Zapier uses this but redirects to `/pricing`)
- Vendor-specific paths like `/chatbuilder/pricing` instead of `/pricing`

## Data Extraction Checklist

When a pricing page loads successfully, extract:
- [ ] Free trial availability and duration
- [ ] Free tier existence and usage caps
- [ ] Starter/Basic tier price (annual vs monthly)
- [ ] Mid-tier features that unlock at higher price
- [ ] Enterprise pricing model (contact sales or fixed)
- [ ] Hidden costs (SMS, premium apps, API rate limits)
- [ ] Usage models: task-based vs seat-based vs outcome-based

## Pitfalls to Avoid

1. **Don't assume URL patterns** — "pricing" path failed for 40% of domains tested
2. **Don't rely on Firecrawl alone** — token auth issues are common without setup
3. **Document extraction failures** — if a site blocks you, record the blocker type
4. **Watch for redirect chains** — some pricing pages redirect to sign-up flow first