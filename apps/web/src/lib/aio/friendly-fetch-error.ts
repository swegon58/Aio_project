// Shared client-side helper: turns a failed fetch response into a plain-
// language message instead of the raw `status ${res.status}` strings that
// used to leak straight to the user (R11.5b, product-ux-guardian finding).
// ponytail: a flat status-code lookup, not a full i18n/error-catalog system —
// add a code here if a new one needs a specific message.
const STATUS_MESSAGES: Record<number, string> = {
  400: "That didn't go through. Please check your input and try again.",
  401: "You've been signed out. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find that.",
  408: "That took too long. Please try again.",
  409: "That doesn't match what's saved anymore — please refresh and try again.",
  413: "That's too large to send.",
  429: "Too many requests — please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again.",
  502: "Something went wrong on our end. Please try again.",
  503: "Aio is temporarily unavailable. Please try again shortly.",
  504: "That took too long. Please try again.",
};

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** Plain-language message for a failed fetch response's HTTP status code. */
export function friendlyFetchError(status: number): string {
  return STATUS_MESSAGES[status] ?? FALLBACK_MESSAGE;
}
