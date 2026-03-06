#!/usr/bin/env node
"use strict";

const { Logger } = require("./logger");

const SEVERITY_LEVELS = { info: 0, warning: 1, error: 2, critical: 3 };

class AlertManager {
  constructor(config, logger) {
    this.config = config.alerts || { enabled: true, channels: ["stdout"], severity_threshold: "warning" };
    this.logger = logger || new Logger();
    this.history = [];
    this.thresholdLevel = SEVERITY_LEVELS[this.config.severity_threshold] ?? SEVERITY_LEVELS.warning;
  }

  send(agentId, severity, message, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      agentId,
      severity,
      message,
      details,
    };
    this.history.push(entry);

    if (!this.config.enabled) {
      this.logger.debug("Alerts disabled, skipping", entry);
      return entry;
    }

    const severityLevel = SEVERITY_LEVELS[severity] ?? 0;
    if (severityLevel < this.thresholdLevel) {
      this.logger.debug(`Alert below threshold (${severity} < ${this.config.severity_threshold})`, entry);
      return entry;
    }

    for (const channel of this.config.channels) {
      this._sendToChannel(channel, entry);
    }

    return entry;
  }

  _sendToChannel(channel, entry) {
    switch (channel) {
      case "stdout":
        this._sendToStdout(entry);
        break;
      case "file":
        this._sendToFile(entry);
        break;
      default:
        this.logger.warn(`Unknown alert channel: ${channel}`);
        this._sendToStdout(entry);
    }
  }

  _sendToStdout(entry) {
    const icon = this._severityIcon(entry.severity);
    const line = `${icon} [ALERT] [${entry.severity.toUpperCase()}] Agent ${entry.agentId}: ${entry.message}`;
    process.stdout.write(line + "\n");
  }

  _sendToFile(entry) {
    const fs = require("fs");
    const path = require("path");
    const logPath = path.join(__dirname, "..", "alerts.log");
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(logPath, line, "utf8");
    this.logger.debug(`Alert written to ${logPath}`);
  }

  _severityIcon(severity) {
    switch (severity) {
      case "info": return "[i]";
      case "warning": return "[!]";
      case "error": return "[X]";
      case "critical": return "[!!!]";
      default: return "[?]";
    }
  }

  getHistory(agentId) {
    if (agentId) {
      return this.history.filter((e) => e.agentId === agentId);
    }
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
  }
}

module.exports = { AlertManager, SEVERITY_LEVELS };
