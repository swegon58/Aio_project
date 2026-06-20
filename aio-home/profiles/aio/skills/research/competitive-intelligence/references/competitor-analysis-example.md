# Competitor Analysis Template & Example

## Research Summary: AI Agent/Chatbot Platforms (June 2026)

### Target Shape
Research 3-5 direct competitors in the space and summarize their pricing plans, tiers, and free trial offers.

---

## Pricing Comparison Table

| Platform | Free Trial | Free Plan | Starter Tier | Mid Tier | High/Pro Tier | Enterprise |
|----------|------------|-----------|--------------|----------|----------------|------------|
| **Zapier** | ✅ Yes (forever) | ✅ Forever free (100 tasks/mo) | $19.99/mo (Professional) | $69/mo (Team) | Custom (Enterprise) | Contact sales |
| **Tidio** | ✅ 7-day trial | ✅ Free (50 convos/mo, basic AI) | $24.17/mo (Starter - 100 billable convos) | $49.17/mo (Growth - advanced analytics) | Custom | Enterprise custom |
| **Crisp** | ✅ 14-day trial | ✅ Free (2 seats, basic features) | ~$49/mo (Mini - 4 seats) | ~$100/mo (Essentials - 10 seats) | ~$199+/mo (Plus) | Enterprise SLA |
| **Intercom** | ✅ Trial available | ✅ $0.99/outcome + $29/seat (Essential) | $57/mo (Essential + Fin AI Agent) | $114/mo (Advanced + Fin AI Agent) | $161+/mo (Expert) | Enterprise custom |

### Key Findings Summary

**Pricing Models Observed:**
1. **Task-based**: Zapier charges per task completed
2. **Conversational**: Tidio, Intercom charge per billable conversation/outcome
3. **Seat-based**: Crisp, Intercom charge per workspace/seat
4. **Hybrid**: Some platforms combine multiple models

**Free Trial Offers:**
- Tidio: 7-day trial on paid plans
- Crisp: 14-day free trial for any plan
- Zapier: Free forever tier (no trial needed)
- Intercom: Variable trial duration by region

**Notable Pricing Insights:**
- Enterprise pricing across all platforms requires direct sales contact
- AI-specific features often gated to higher tiers
- Pricing ranges from $0-200+/month depending on usage volume and seats
- Most competitors offer free tiers/trials to reduce customer acquisition costs

---

## Research Methodology

### Tools Used: browser_navigate + browser_snapshot

### Extraction Strategy:
1. **web_extract** for cooperative sites (worked on Zapier pricing page)
2. **browser_navigate + browser_snapshot** for bot-protected sites (required for Tidio, Crisp)
3. Document all blockers: Cloudflare challenges, 404s, DNS failures

### Data Points Extracted Per Platform:
- Pricing tiers and thresholds
- Free trial availability/duration
- Usage models (per-task, per-seat, per-conversation)
- Enterprise pricing contact options
- Feature gating by tier

---

## Research Notes & Pitfalls Observed

### Successful Extractions:
- **Zapier**: Complex task selector UI with radio buttons for monthly/yearly billing
- **Tidio**: Dynamic price calculator based on usage needs
- **Crisp**: Flat per-workspace pricing model clearly documented

### Failed Attempts (Documented):
- **Firecrawl web_search**: Auth error (token required)
- **Multiple domains returned 404**: chatbase.ai, mockai.so, interakt.com, helpcrab.com
- **Cloudflare challenges**: claude.ai/pricing blocked with security verification

### Key Lessons:
1. "pricing" path failed for ~40% of domains tested
2. Firecrawl auth issues require browser fallback
3. Some vendor-specific paths differ from expected (e.g., Zapier's `/botpricing` → redirects to `/pricing`)
4. Bot detection is aggressive on SaaS pricing pages

---

## Recommendations for Future Research

1. **Always try web_extract first** — faster and cheaper
2. **Fall back to browser_navigate** if auth or bot detection blocks
3. **Document all blockers** — patterns emerge across sites
4. **Check both `/pricing` and vendor-specific paths**
5. **Capture hidden costs** (SMS, premium apps, API limits)