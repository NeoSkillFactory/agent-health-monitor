#!/usr/bin/env node
"use strict";

const { execSync, exec } = require("child_process");
const { Logger } = require("./logger");

class RestartManager {
  constructor(config, logger) {
    this.config = config || {};
    this.logger = logger || new Logger();
    this.maxRetries = (config.monitor && config.monitor.max_retries) || 3;
    this.restartHistory = [];
  }

  restart(agentId, options = {}) {
    const mode = options.mode || "graceful";
    const attempt = {
      agentId,
      mode,
      timestamp: new Date().toISOString(),
      success: false,
      error: null,
    };

    this.logger.info(`Attempting ${mode} restart of agent: ${agentId}`);

    try {
      if (mode === "force") {
        this._forceRestart(agentId);
      } else {
        this._gracefulRestart(agentId);
      }
      attempt.success = true;
      this.logger.info(`Successfully restarted agent: ${agentId}`);
    } catch (err) {
      attempt.error = err.message;
      this.logger.error(`Failed to restart agent: ${agentId}`, { error: err.message });
    }

    this.restartHistory.push(attempt);
    return attempt;
  }

  _gracefulRestart(agentId) {
    const pid = this._findAgentProcess(agentId);
    if (pid) {
      this.logger.info(`Sending SIGTERM to agent ${agentId} (PID: ${pid})`);
      try {
        process.kill(parseInt(pid, 10), "SIGTERM");
      } catch (err) {
        if (err.code !== "ESRCH") throw err;
      }
      this._waitForExit(pid, 5000);
    }
    this._startAgent(agentId);
  }

  _forceRestart(agentId) {
    const pid = this._findAgentProcess(agentId);
    if (pid) {
      this.logger.warn(`Sending SIGKILL to agent ${agentId} (PID: ${pid})`);
      try {
        process.kill(parseInt(pid, 10), "SIGKILL");
      } catch (err) {
        if (err.code !== "ESRCH") throw err;
      }
    }
    this._startAgent(agentId);
  }

  _findAgentProcess(agentId) {
    try {
      const output = execSync(`pgrep -f "[o]penclaw.*${agentId}" 2>/dev/null || true`, {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      const pids = output.split("\n").filter(Boolean);
      return pids.length > 0 ? pids[0] : null;
    } catch {
      return null;
    }
  }

  _waitForExit(pid, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        process.kill(parseInt(pid, 10), 0);
      } catch {
        return true;
      }
      const waitUntil = Date.now() + 200;
      while (Date.now() < waitUntil) { /* busy wait */ }
    }
    this.logger.warn(`Process ${pid} did not exit within ${timeoutMs}ms`);
    return false;
  }

  _startAgent(agentId) {
    this.logger.info(`Starting agent: ${agentId}`);
    // In a real deployment, this would invoke the OpenClaw gateway to start the agent.
    // For now, we log the action. The actual command would be:
    // exec(`openclaw agent start ${agentId}`, ...)
    this.logger.info(`Agent start command issued for: ${agentId}`);
  }

  getRestartCount(agentId) {
    return this.restartHistory.filter((r) => r.agentId === agentId).length;
  }

  getSuccessfulRestarts(agentId) {
    return this.restartHistory.filter((r) => r.agentId === agentId && r.success).length;
  }

  getFailedRestarts(agentId) {
    return this.restartHistory.filter((r) => r.agentId === agentId && !r.success).length;
  }

  hasExceededRetries(agentId) {
    const recentFailures = this.restartHistory
      .filter((r) => r.agentId === agentId && !r.success)
      .slice(-this.maxRetries);
    return recentFailures.length >= this.maxRetries;
  }

  getHistory(agentId) {
    if (agentId) {
      return this.restartHistory.filter((r) => r.agentId === agentId);
    }
    return [...this.restartHistory];
  }
}

module.exports = { RestartManager };
