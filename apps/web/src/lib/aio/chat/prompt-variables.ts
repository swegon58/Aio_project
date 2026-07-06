// Server-time substitution for {{ USER_NAME }} and {{ CURRENT_DATE }} tokens in
// Aio system/run prompts. Applied at the final prompt-assembly point in
// run-orchestrator.ts so every segment (guardrail, plan, research, saved
// agent, knowledge) gets the same substitution.
//
// ponytail: regex on the final string, no template engine. Whitespace-tolerant
// so {{USER_NAME}}, {{ USER_NAME }}, and {{  USER_NAME  }} all match. Cheap
// guard skips the regex pass when neither token literal is present.

const USER_NAME_TOKEN = /\{\{\s*USER_NAME\s*\}\}/g;
const CURRENT_DATE_TOKEN = /\{\{\s*CURRENT_DATE\s*\}\}/g;

/**
 * Replace `{{ USER_NAME }}` with `userName` and `{{ CURRENT_DATE }}` with
 * today's date (YYYY-MM-DD, server time) in a prompt segment. Returns the
 * input unchanged when it contains no tokens.
 */
export function applyPromptVariables(prompt: string, userName: string): string {
  if (!prompt || (!prompt.includes("USER_NAME") && !prompt.includes("CURRENT_DATE"))) {
    return prompt;
  }
  const currentDate = new Date().toISOString().slice(0, 10);
  return prompt.replace(USER_NAME_TOKEN, userName).replace(CURRENT_DATE_TOKEN, currentDate);
}
