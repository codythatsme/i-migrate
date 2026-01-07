import { Effect, Layer, Data, Tracer, Context, Exit, Cause, Option } from "effect";
import { db } from "../db/client";
import { traces, spans, type NewTrace, type NewSpan } from "../db/schema";
import { eq, desc } from "drizzle-orm";

// ---------------------
// Domain Errors
// ---------------------

export class TraceStoreError extends Data.TaggedError("TraceStoreError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// ---------------------
// Types
// ---------------------

export type SpanEvent = {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
};

export type StoredSpan = {
  id: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  status: "ok" | "error" | "running";
  kind: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  errorCause: string | null;
};

export type StoredTrace = {
  id: string;
  name: string;
  status: "ok" | "error" | "running";
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  spans: StoredSpan[];
};

export type TraceSummary = {
  id: string;
  name: string;
  status: "ok" | "error" | "running";
  startTime: number;
  durationMs: number | null;
  createdAt: string;
  spanCount: number;
  errorMessage: string | null;
};

// ---------------------
// Span Implementation with Persistence
// ---------------------

class PersistentSpan implements Tracer.Span {
  readonly _tag = "Span";
  readonly spanId: string;
  readonly traceId: string;
  readonly sampled = true;

  status: Tracer.SpanStatus;
  attributes: Map<string, unknown>;
  events: Array<SpanEvent> = [];
  links: Array<Tracer.SpanLink>;

  constructor(
    readonly name: string,
    readonly parent: Option.Option<Tracer.AnySpan>,
    readonly context: Context.Context<never>,
    links: Iterable<Tracer.SpanLink>,
    readonly startTime: bigint,
    readonly kind: Tracer.SpanKind,
    private readonly onEnd: (span: PersistentSpan) => void,
  ) {
    this.status = { _tag: "Started", startTime };
    this.attributes = new Map();
    this.traceId = Option.isSome(parent) ? parent.value.traceId : randomHexString(32);
    this.spanId = randomHexString(16);
    this.links = Array.from(links);
  }

  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    this.status = {
      _tag: "Ended",
      endTime,
      exit,
      startTime: this.status.startTime,
    };
    // Persist on end
    this.onEnd(this);
  }

  attribute(key: string, value: unknown): void {
    this.attributes.set(key, value);
  }

  event(name: string, startTime: bigint, attributes?: Record<string, unknown>): void {
    this.events.push({
      name,
      timestamp: Number(startTime / 1_000_000n), // Convert nanoseconds to ms
      attributes,
    });
  }

  addLinks(links: ReadonlyArray<Tracer.SpanLink>): void {
    this.links.push(...links);
  }
}

// ---------------------
// Helper Functions
// ---------------------

const randomHexString = (length: number): string => {
  const characters = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const bigintToMs = (ns: bigint): number => Number(ns / 1_000_000n);

const formatErrorCause = (exit: Exit.Exit<unknown, unknown>): string | null => {
  if (Exit.isSuccess(exit)) return null;
  return Cause.pretty(exit.cause, { renderErrorCause: true });
};

const getErrorMessage = (exit: Exit.Exit<unknown, unknown>): string | null => {
  if (Exit.isSuccess(exit)) return null;
  const errors = Cause.prettyErrors(exit.cause);
  return errors[0]?.message ?? "Unknown error";
};

// ---------------------
// Service Definition
// ---------------------

export class TraceStoreService extends Effect.Service<TraceStoreService>()(
  "app/TraceStoreService",
  {
    accessors: true,

    sync: () => {
      // ---------------------
      // Query Methods
      // ---------------------

      const listTraces = (limit: number = 50, offset: number = 0) =>
        Effect.try({
          try: () => {
            const traceRows = db
              .select()
              .from(traces)
              .orderBy(desc(traces.startTime))
              .limit(limit)
              .offset(offset)
              .all();

            // Get span counts for each trace
            return traceRows.map((trace): TraceSummary => {
              const spanCount = db
                .select()
                .from(spans)
                .where(eq(spans.traceId, trace.id))
                .all().length;

              return {
                id: trace.id,
                name: trace.name,
                status: trace.status as "ok" | "error" | "running",
                startTime: trace.startTime,
                durationMs: trace.durationMs,
                createdAt: trace.createdAt,
                spanCount,
                errorMessage: trace.errorMessage,
              };
            });
          },
          catch: (cause) => new TraceStoreError({ message: "Failed to list traces", cause }),
        });

      const getTrace = (traceId: string) =>
        Effect.try({
          try: () => {
            const traceRow = db.select().from(traces).where(eq(traces.id, traceId)).all()[0];

            if (!traceRow) return null;

            const spanRows = db
              .select()
              .from(spans)
              .where(eq(spans.traceId, traceId))
              .orderBy(spans.startTime)
              .all();

            const storedSpans: StoredSpan[] = spanRows.map((span) => ({
              id: span.id,
              traceId: span.traceId,
              parentSpanId: span.parentSpanId,
              name: span.name,
              status: span.status as "ok" | "error" | "running",
              kind: span.kind,
              startTime: span.startTime,
              endTime: span.endTime,
              durationMs: span.durationMs,
              attributes: span.attributes ? JSON.parse(span.attributes) : {},
              events: span.events ? JSON.parse(span.events) : [],
              errorCause: span.errorCause,
            }));

            return {
              id: traceRow.id,
              name: traceRow.name,
              status: traceRow.status as "ok" | "error" | "running",
              startTime: traceRow.startTime,
              endTime: traceRow.endTime,
              durationMs: traceRow.durationMs,
              errorMessage: traceRow.errorMessage,
              createdAt: traceRow.createdAt,
              spans: storedSpans,
            } satisfies StoredTrace;
          },
          catch: (cause) => new TraceStoreError({ message: "Failed to get trace", cause }),
        });

      const clearTraces = () =>
        Effect.try({
          try: () => {
            db.delete(spans).run();
            db.delete(traces).run();
          },
          catch: (cause) => new TraceStoreError({ message: "Failed to clear traces", cause }),
        });

      const deleteOldTraces = (olderThanMs: number) =>
        Effect.try({
          try: () => {
            const cutoff = Date.now() - olderThanMs;

            // Get trace IDs to delete
            const oldTraces = db
              .select({ id: traces.id })
              .from(traces)
              .where(eq(traces.startTime, cutoff))
              .all();

            const traceIds = oldTraces.map((t) => t.id);

            if (traceIds.length > 0) {
              // Delete spans for those traces
              for (const traceId of traceIds) {
                db.delete(spans).where(eq(spans.traceId, traceId)).run();
              }
              // Delete traces
              for (const traceId of traceIds) {
                db.delete(traces).where(eq(traces.id, traceId)).run();
              }
            }

            return traceIds.length;
          },
          catch: (cause) => new TraceStoreError({ message: "Failed to delete old traces", cause }),
        });

      // ---------------------
      // Return Service Implementation
      // ---------------------

      return {
        listTraces,
        getTrace,
        clearTraces,
        deleteOldTraces,
      };
    },
  },
) {
  // Static Test layer
  static Test = Layer.succeed(
    this,
    new TraceStoreService({
      listTraces: () => Effect.succeed([]),
      getTrace: () => Effect.succeed(null),
      clearTraces: () => Effect.succeed(undefined),
      deleteOldTraces: () => Effect.succeed(0),
    }),
  );
}

// ---------------------
// Layer that provides the custom tracer to Effect runtime
// ---------------------

export const TraceStoreServiceLive = TraceStoreService.Default;

// Create a tracer instance at module level for use in the layer
// This is simpler than trying to wire it through the service

// Only track spans representing external HTTP calls (not internal RPC/server spans)
const shouldTrackSpan = (name: string): boolean => {
  // Skip internal RpcServer and http.server spans
  if (name.startsWith("RpcServer.") || name.startsWith("http.server")) {
    return false;
  }
  // Track iMIS API calls and other external calls
  return true;
};

const createPersistentTracer = () => {
  const persistSpanSync = (span: PersistentSpan): void => {
    // Skip internal spans we don't care about
    if (!shouldTrackSpan(span.name)) {
      return;
    }

    const status = span.status as Extract<Tracer.SpanStatus, { _tag: "Ended" }>;
    const startMs = bigintToMs(status.startTime);
    const endMs = bigintToMs(status.endTime);
    const durationMs = endMs - startMs;

    const isError = Exit.isFailure(status.exit);

    const attributesObj: Record<string, unknown> = {};
    span.attributes.forEach((value, key) => {
      attributesObj[key] = value;
    });

    try {
      // Check if trace record already exists for this traceId
      // (External spans from Effect's HTTP layer mean isRootSpan is often false)
      const existingTrace = db
        .select({ id: traces.id })
        .from(traces)
        .where(eq(traces.id, span.traceId))
        .all()[0];

      if (!existingTrace) {
        const traceRecord: NewTrace = {
          id: span.traceId,
          name: span.name,
          status: isError ? "error" : "ok",
          startTime: startMs,
          endTime: endMs,
          durationMs,
          errorMessage: getErrorMessage(status.exit),
          createdAt: new Date().toISOString(),
        };
        db.insert(traces).values(traceRecord).run();
      }

      const spanRecord: NewSpan = {
        id: span.spanId,
        traceId: span.traceId,
        parentSpanId: Option.isSome(span.parent) ? span.parent.value.spanId : null,
        name: span.name,
        status: isError ? "error" : "ok",
        kind: span.kind,
        startTime: startMs,
        endTime: endMs,
        durationMs,
        attributes: JSON.stringify(attributesObj),
        events: JSON.stringify(span.events),
        errorCause: formatErrorCause(status.exit),
      };
      db.insert(spans).values(spanRecord).run();

      // Update trace: extend duration and set error status if needed
      if (existingTrace) {
        // Get current trace to check if we need to extend the duration
        const currentTrace = db.select().from(traces).where(eq(traces.id, span.traceId)).all()[0];

        if (currentTrace) {
          const updates: Partial<NewTrace> = {};

          // Extend trace endTime if this span ends later
          if (!currentTrace.endTime || endMs > currentTrace.endTime) {
            updates.endTime = endMs;
            updates.durationMs = endMs - currentTrace.startTime;
          }

          // Update error status if this span errored
          if (isError) {
            updates.status = "error";
            updates.errorMessage = getErrorMessage(status.exit);
          }

          if (Object.keys(updates).length > 0) {
            db.update(traces).set(updates).where(eq(traces.id, span.traceId)).run();
          }
        }
      }
    } catch (error) {
      console.error("[TraceStore] Failed to persist span:", error);
    }
  };

  return Tracer.make({
    span: (name, parent, context, links, startTime, kind) => {
      return new PersistentSpan(name, parent, context, links, startTime, kind, persistSpanSync);
    },
    context: (f) => f(),
  });
};

// Create the tracer once at module initialization
const persistentTracer = createPersistentTracer();

// Layer that provides our custom tracer to the Effect runtime
// Using both setTracer (for default services) and succeed (for explicit context)
export const TracerLive = Layer.mergeAll(
  Layer.setTracer(persistentTracer),
  Layer.succeed(Tracer.Tracer, persistentTracer),
);
