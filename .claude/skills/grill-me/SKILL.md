---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

Ask ALL remaining questions in one batch per round instead of one-at-a-time — only grill further on follow-ups after the user answers the batch.

Match the user's language (Vietnamese by default for this user, regardless of what language other files/notes happen to be in — "switch to English" from this user means UI copy/product strings, not how you talk to them, unless they say otherwise explicitly). Use emoji/icons liberally to keep it lively.

For each question, use this format:
- Question header: "❓ Câu N:" followed by the question text
- Each option its own block, marked with a circled-letter icon (🅰️, 🅱️, 🅲️, 🅳️...) — add a 3rd/4th option only when a question genuinely has more than 2 viable paths
- Under each option, a `↳ Trade-off:` line with a full explanation (don't over-compress — thorough explanations are preferred over short ones)
- Mark the recommended option's icon with ⭐, and add a line under it: `↳ **đây là lựa chọn mình recommend**, vì...` with 1-2 full sentences of actual reasoning/opinion, not a neutral recap

If a question can be answered by exploring the codebase, explore the codebase instead of asking.
