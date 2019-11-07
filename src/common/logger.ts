import * as dontenv from "dotenv";
dontenv.config();

// config
import { APP_NAME, HOST } from "../config";

import * as winston from "winston";
import chalk from "chalk";

// types
import { Format } from "logform";

// constants
const ENV: string = process.env.NODE_ENV || "production";
const DEBUG: boolean =
  process.env.NODE_DEBUG === "true" || process.env.NODE_DEBUG === "TRUE";

// logger configuration
const USE_PLAIN_TEXT: boolean =
  process.env.USE_PLAIN_TEXT === "true" ||
  process.env.USE_PLAIN_TEXT === "TRUE";
const USE_COLORIZED: boolean =
  process.env.USE_COLOR === "true" || process.env.USE_COLOR === "TRUE";
const LOG_LEVEL: string = DEBUG ? "debug" : process.env.LOG_LEVEL || "verbose";

// default fields
const defaultFields = {
  env: ENV,
  host: HOST || "",
  service: APP_NAME || ""
};

// this function returns the colorized log level
const returnLogColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case "info":
      return chalk.blue(level);
    case "debug":
      return chalk.cyan(level);
    case "error":
      return chalk.red(level);
    case "warn":
      return chalk.yellow(level);
    default:
      return chalk.blue(level);
  }
};

// This is a log formatter that prints to stdout a stringified log instead of json
const printF = winston.format.printf(info => {
  const ignoredFields: string[] = ["message", "level", "timestamp"];
  const keys = Object.keys(info).filter(key => !ignoredFields.includes(key));

  // additional logger fields
  const fields: string = keys
    .reduce(
      (prevString: string, currentValue: string) =>
        `${prevString} ${chalk.bold(currentValue)}="${info[currentValue]}"`,
      ""
    )
    .trim();

  // colorized log level
  const colorizedLogLevel: string = USE_COLORIZED
    ? returnLogColor(info.level.toUpperCase())
    : info.level.toUpperCase();

  // log message
  const message: string = `${chalk.bold("message")}="${info.message}"`;

  return `${info.timestamp} ${colorizedLogLevel} ${message} ${fields}\n`;
});

const errorFormatter = winston.format(info => {
  if (info.level === "error") {
    if (info.error instanceof Error) {
      const error = info.error;

      info = Object.assign(info, {
        error: error.message,
        error_name: error.name,
        stack_trace: error.stack.split(/\n/).join("")
      });
    }
  }

  return info;
});

const formatter: Format = USE_PLAIN_TEXT ? printF : winston.format.json();

export default winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: defaultFields,
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    errorFormatter(),
    winston.format.timestamp(),
    winston.format.splat(),
    formatter
  )
});
