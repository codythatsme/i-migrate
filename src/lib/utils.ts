import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a human-readable error message from Effect RPC errors.
 * Effect RPC errors are objects with _tag and schema fields (like message).
 * This function handles various error shapes to extract a useful message.
 */
export function getErrorMessage(err: unknown, fallback = 'An error occurred'): string {
  if (err === null || err === undefined) {
    return fallback
  }

  // Standard Error object
  if (err instanceof Error) {
    return err.message || fallback
  }

  // Effect RPC error object with message field
  if (typeof err === 'object') {
    const error = err as Record<string, unknown>

    // Check for message field (most common)
    if (typeof error.message === 'string' && error.message) {
      return error.message
    }

    // Check for nested error in cause
    if (error.cause && typeof error.cause === 'object') {
      const cause = error.cause as Record<string, unknown>
      if (typeof cause.message === 'string' && cause.message) {
        return cause.message
      }
    }

    // Fall back to _tag if available
    if (typeof error._tag === 'string') {
      return `Error: ${error._tag}`
    }
  }

  // String error
  if (typeof err === 'string') {
    return err
  }

  return fallback
}
