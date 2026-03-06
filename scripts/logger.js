#!/usr/bin/env node
"use strict";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level || "info"] ?? LEVELS.info;
    this.prefix = options.prefix || "agent-health-monitor";
    this.entries = [];
  }

  _format(level, message, data) {
    const ts = new Date().toISOString();
    const entry = { timestamp: ts, level, message, data };
    this.entries.push(entry);
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${ts}] [${level.toUpperCase()}] [${this.prefix}] ${message}${dataStr}`;
  }

  debug(message, data) {
    if (this.level <= LEVELS.debug) {
      const line = this._format("debug", message, data);
      process.stdout.write(line + "\n");
    }
  }

  info(message, data) {
    if (this.level <= LEVELS.info) {
      const line = this._format("info", message, data);
      process.stdout.write(line + "\n");
    }
  }

  warn(message, data) {
    if (this.level <= LEVELS.warn) {
      const line = this._format("warn", message, data);
      process.stderr.write(line + "\n");
    }
  }

  error(message, data) {
    if (this.level <= LEVELS.error) {
      const line = this._format("error", message, data);
      process.stderr.write(line + "\n");
    }
  }

  getEntries() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
  }
}

module.exports = { Logger, LEVELS };
