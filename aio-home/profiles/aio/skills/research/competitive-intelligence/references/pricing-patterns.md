# Pricing Pattern Library

## SaaS Pricing Models Observed

### 1. Task-Based Pricing (Zapier)
- **Model**: Charge per unit of work completed
- **Units**: Tasks, API calls, executions
- **Typical structure:**
  - Free: 100 tasks/mo cap
  - Starter: $19.99/mo (yearly), unlimited Zaps, tables, forms
  - Team: $69/mo → collaboration features
  - Enterprise: Contact sales
- **Pitfall**: "Task" definition varies — check what counts as a task

### 2. Conversational Pricing (Tidio)
- **Model**: Per billable conversation/outcome
- **Units**: Live conversations, AI handoffs, ticket creations
- **Typical structure:**
  - Free: 50 convos/mo
  - Starter: ~$24/mo @ 100 convos
  - Growth: ~$49/mo @ 250+ convos + advanced features
  - Enterprise: Custom
- **Pitfall**: "Billable" often excludes internal/testing conversations

### 3. Seat-Based Pricing (Crisp, Intercom)
- **Model**: Per workspace/seat/month
- **Units**: Team members, agents
- **Typical structure:**
  - Free: 2 seats included
  - Mini/Essential: $49-$100/mo @ 4-10 seats
  - Plus/Pro: ~$200+/mounlimited automation
  - Enterprise: Custom SLA
- **Pitfall**: "Per seat" may scale differently from raw headcount

### 4. Outcome-Based Pricing (Intercom Fin)
- **Model**: Per successful AI outcome
- **Units**: Resolved issues, outcomes achieved
- **Typical structure:**
  - $0.99/outcome + base fee per seat
  - Essential: ~$29/seat @ $0.99/outcome
  - Advanced: ~$85/seat
  - Expert: ~$132/seat + advanced features
- **Pitfall**: "Outcome" definition critical — check attribution logic

## Free Trial Patterns

| Duration | Typical Conditions | Best For |
|----------|-------------------|----------|
| 7 days   | Paid plan access, credit card required | Quick trials (Tidio) |
| 14 days  | Any plan trial, flexible upgrades | Exploration phase (Crisp) |
| Forever  | Free tier, no credit card | Low-risk entry (Zapier) |

## Common Data Extraction Fields

For each competitor, capture:
```yaml
platform_name: "Tidio"
pricing_url: "https://www.tidio.com/pricing/"
free_trial: true/false
trial_duration_days: 7/14/null
free_plan: true/false
  free_tiers_caps:
    - unit: conversations
      cap: 50
tier_1:
  name: "Starter"
  price_mtu_annual: 24.17
  usage_cap: 100 billable convos/mo
  features:
    - AI_agent_basic
    - flows_automation
tier_2:
  name: "Growth"
  price_mtu_annual: 49.17
  usage_cap: null (unlimited or higher cap)
  features:
    - advanced_analytics
    - user_permissions
enterprise_model: contact_sales
```

## Pricing Disclosure Notes

- Document any "billable vs non-billable" distinction
- Capture one-time credits vs recurring charges
- Note any hidden fees (SMS, WhatsApp, premium apps)
- Record free tier caps explicitly