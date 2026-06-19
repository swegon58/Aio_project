---
name: user-identification-management
description: "Manage user identity identification and persistent naming preferences."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  category: user-preferences
  tags: [identity, name, profile, language-pref]
---

# User Identification & Naming Management

**This skill handles capturing and persisting user identity information** — including preferred names, language preferences, and other persistent identifiers that should be maintained across sessions.

## When to Use

Trigger signals for creating/updating this skill:

1. **"Remember you're my name X"** / explicit renaming requests
2. **Language preference declarations** (e.g., Vietnamese user, Chinese user, etc.)
3. **User identity corrections** ("I'm not who you think I am")
4. **Persistent persona/preferences that span multiple sessions**

## Workflow

### Capturing New Identity Information

When a user explicitly states their preferred name or identity:

1. **Confirm the preference**: "Đã nhớ! Tôi sẽ gọi bạn là [Tên]." (Acknowledged!)
2. **Capture in memory**: `memory(action='add', target='user', content=...)`
3. **Create/update skill** to make it persistent across sessions

### Language Preference Handling

For non-English users:

1. Detect language from conversation
2. Store in user memory with language context
3. Document in skill for future sessions

## Implementation Pattern

```python
# Example: User says "Call me Aio"
memory(
    action='add',
    target='user',
    content='User prefers name "Aio". Vietnamese speaker.'
)

skill_manage(
    action='create',
    name='user-identification-management',
    # Add preference details to SKILL.md
)
```

## Storage Format

Memory should contain:
- **Who the user is** (names, roles, preferred identifiers)
- **Language preferences** (primary and secondary)
- **Communication style preferences** (tone, verbosity, format)

Skills capture:
- **How to manage these preferences** across sessions
- **Default behavior when not explicitly set**
- **Edge cases and corrections** from previous sessions

## Pitfalls

1. **Don't conflate memory vs skill**: Memory = current state; Skill = persistent procedure
2. **Language detection**: Always store in target language (Vietnamese → Vietnamese, not translation)
3. **Identity persistence**: Use skills for preferences that should survive profile resets
4. **Explicit confirmation**: Always acknowledge before storing ("Đã nhớ!")

## Quick Reference

| Signal | Tool | Action |
|--------|------|--------|
| "Remember you're my name X" | memory + skill_manage | Store in user profile |
| Language declaration | memory | Record language preference |
| Style/format correction | skill_manage | Update relevant skill doc |
| "Just give me the answer" | memory/skill | Capture brevity preference |

## Related Skills

- `hermes-agent`: For Hermes-specific configuration preferences
- Session-specific tasks should use **memory**, not skills