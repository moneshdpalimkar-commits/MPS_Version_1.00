/* eslint-disable @typescript-eslint/no-explicit-any */
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  timestamp: string;
  msg: string;
  [key: string]: any;
}

class Logger {
  private isProduction = process.env.NODE_ENV === "production";

  private log(level: LogLevel, msg: string, meta?: Record<string, any>) {
    const payload: LogPayload = {
      level,
      timestamp: new Date().toISOString(),
      msg,
      ...meta,
    };

    if (this.isProduction) {
      console.log(JSON.stringify(payload));
    } else {
      const color = 
        level === "error" ? "\x1b[31m" :
        level === "warn" ? "\x1b[33m" :
        level === "info" ? "\x1b[36m" :
        "\x1b[90m";
      const reset = "\x1b[0m";
      console.log(
        `[${payload.timestamp}] ${color}${level.toUpperCase()}${reset}: ${msg}`,
        meta ? JSON.stringify(meta, null, 2) : ""
      );
    }
  }

  public debug(msg: string, meta?: Record<string, any>) {
    this.log("debug", msg, meta);
  }

  public info(msg: string, meta?: Record<string, any>) {
    this.log("info", msg, meta);
  }

  public warn(msg: string, meta?: Record<string, any>) {
    this.log("warn", msg, meta);
  }

  public error(msg: string, error?: Error | any, meta?: Record<string, any>) {
    const errMeta: Record<string, any> = {};
    if (error instanceof Error) {
      errMeta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error) {
      errMeta.error = error;
    }
    this.log("error", msg, { ...errMeta, ...meta });
  }
}

export const logger = new Logger();
