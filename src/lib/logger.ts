/**
 * Terminal logger utility for Veggie Wave
 * Color-coded logs with timestamps for debugging
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogOptions {
  level?: LogLevel;
  timestamp?: boolean;
  prefix?: string;
}

const DEFAULT_OPTIONS: Required<LogOptions> = {
  level: "info",
  timestamp: true,
  prefix: "",
};

// Color codes for terminal output
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.cyan,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

/**
 * Get current timestamp in HH:MM:SS format
 */
function getTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

/**
 * Format a log message with colors and prefix
 */
function formatMessage(message: unknown, level: LogLevel, options: Required<LogOptions>): string {
  const timestamp = options.timestamp ? `[${getTimestamp()}]` : "";
  const prefix = options.prefix ? `[${options.prefix}]` : "";
  const levelLabel = LEVEL_LABELS[level];
  const levelColor = LEVEL_COLORS[level];

  const stringMessage = typeof message === "string" ? message : JSON.stringify(message, null, 2);

  return `${COLORS.dim}${timestamp}${COLORS.reset} ${levelColor}${levelLabel}${COLORS.reset} ${prefix} ${stringMessage}`;
}

/**
 * Main logger function
 * @example
 * log("Order created", { level: "info", prefix: "Order" })
 * log("Invalid input", { level: "error" })
 */
export function log(message: unknown, options: LogOptions = {}): void {
  const mergedOptions: Required<LogOptions> = { ...DEFAULT_OPTIONS, ...options };

  // Only log debug messages in development
  if (mergedOptions.level === "debug" && process.env.NODE_ENV === "production") {
    return;
  }

  const formattedMessage = formatMessage(message, mergedOptions.level, mergedOptions);

  switch (mergedOptions.level) {
    case "debug":
      console.debug(formattedMessage);
      break;
    case "info":
      console.info(formattedMessage);
      break;
    case "warn":
      console.warn(formattedMessage);
      break;
    case "error":
      console.error(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
}

/**
 * Convenience methods for each log level
 */
export const logger = {
  debug: (message: unknown, options?: Omit<LogOptions, "level">) =>
    log(message, { ...options, level: "debug" }),

  info: (message: unknown, options?: Omit<LogOptions, "level">) =>
    log(message, { ...options, level: "info" }),

  warn: (message: unknown, options?: Omit<LogOptions, "level">) =>
    log(message, { ...options, level: "warn" }),

  error: (message: unknown, options?: Omit<LogOptions, "level">) =>
    log(message, { ...options, level: "error" }),
};

/**
 * Create a named logger for a specific module
 * @example
 * const mapLogger = createLogger("Map");
 * mapLogger.info("Route calculated");
 * mapLogger.error("Failed to load", { error: err });
 */
export function createLogger(prefix: string) {
  return {
    debug: (message: unknown, options?: Omit<LogOptions, "level" | "prefix">) =>
      log(message, { ...options, level: "debug", prefix }),

    info: (message: unknown, options?: Omit<LogOptions, "level" | "prefix">) =>
      log(message, { ...options, level: "info", prefix }),

    warn: (message: unknown, options?: Omit<LogOptions, "level" | "prefix">) =>
      log(message, { ...options, level: "warn", prefix }),

    error: (message: unknown, options?: Omit<LogOptions, "level" | "prefix">) =>
      log(message, { ...options, level: "error", prefix }),
  };
}

/**
 * Log a separator line for visual grouping
 */
export function logSeparator(label?: string): void {
  const line = "─".repeat(60);
  const timestamp = `[${getTimestamp()}]`;

  if (label) {
    const padding = " ".repeat(Math.max(0, (60 - label.length) / 2));
    console.log(`${COLORS.dim}${timestamp} ${COLORS.reset}${COLORS.bright}${line}${COLORS.reset}`);
    console.log(
      `${COLORS.dim}${timestamp} ${COLORS.reset}${COLORS.bright} ${padding}${label}${padding} ${COLORS.reset}`,
    );
    console.log(`${COLORS.dim}${timestamp} ${COLORS.reset}${COLORS.bright}${line}${COLORS.reset}`);
  } else {
    console.log(`${COLORS.dim}${timestamp} ${COLORS.reset}${COLORS.bright}${line}${COLORS.reset}`);
  }
}

/**
 * Log a group of related messages
 */
export function logGroup(label: string, messages: unknown[], level: LogLevel = "info"): void {
  logSeparator(label);
  messages.forEach((msg) => log(msg, { level }));
  logSeparator();
}

/**
 * Measure and log execution time
 * @example
 * const time = logTimeStart("API call");
 * await fetchData();
 * logTimeEnd(time);
 */
export function logTimeStart(label: string): number {
  logger.info(`${label}...`, { prefix: "Timer" });
  return performance.now();
}

export function logTimeEnd(startTime: number, label: string): void {
  const elapsed = performance.now() - startTime;
  logger.info(`${label} completed in ${elapsed.toFixed(2)}ms`, { prefix: "Timer" });
}
