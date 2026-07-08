// Shared state machine types and helpers. Reused across aio state machines.
// Provides generic type-safe transition validation without coupling to any domain.

export const STATE_ERROR_CODE = {
  /** The `from -> to` edge is not in the allowed set. */
  INVALID_TRANSITION: "INVALID_TRANSITION",
  /** The state is already terminal; no normal transition is allowed. */
  ALREADY_TERMINAL: "ALREADY_TERMINAL",
} as const;

export type StateErrorCode = keyof typeof STATE_ERROR_CODE;

/** Generic transition result type - domain state machines extend this */
export type TransitionResult<TStatus extends string> =
  | { ok: true; from: TStatus; to: TStatus }
  | {
      ok: false;
      from: TStatus;
      to: TStatus;
      code: StateErrorCode;
      message: string;
    };

/**
 * Generic transition validator. Extracts the common pattern:
 * 1. Check if `from` is terminal → return ALREADY_TERMINAL
 * 2. Check if `from -> to` is in allowed edges → return success
 * 3. Otherwise → return INVALID_TRANSITION
 */
export function createTransitionValidator<TStatus extends string>(
  terminalStates: ReadonlySet<TStatus>,
  allowedTransitions: Record<TStatus, readonly TStatus[]>,
) {
  return function transition(from: TStatus, to: TStatus): TransitionResult<TStatus> {
    if (terminalStates.has(from)) {
      return {
        ok: false,
        from,
        to,
        code: STATE_ERROR_CODE.ALREADY_TERMINAL,
        message: `State is already terminal ("${String(from)}"); no transition allowed.`,
      };
    }
    if (allowedTransitions[from]?.includes(to)) {
      return { ok: true, from, to };
    }
    return {
      ok: false,
      from,
      to,
      code: STATE_ERROR_CODE.INVALID_TRANSITION,
      message: `Transition "${String(from)}" -> "${String(to)}" is not allowed.`,
    };
  };
}
