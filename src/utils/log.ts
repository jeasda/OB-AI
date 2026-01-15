import { logEvent as baseLogEvent, type LogLevel } from "../lib/logger";

export function logEvent(level: LogLevel, event: string, data: Record<string, unknown> = {}) {
  baseLogEvent({
    level,
    event,
    ...data,
  });
}
