#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const { Logger } = require("./logger");
const { loadConfig, validateConfig } = require("./config");
const { AlertManager } = require("./alert");
const { RestartManager } = require("./restart");

class AgentMonitor {
  constructor(options = {}) {
    this.config = options.config || loadConfig(options.configPath);
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    this.logger = options.logger || new Logger({ level: options.logLevel || "info" });
    this.alertManager = options.alertManager || new AlertManager(this.config, this.logger);
    this.restartManager = options.restartManager || new RestartManager(this.config, this.logger);

    this.running = false;
    this.intervalHandle = null;
    this.agentStates = new Map();
  }

  start() {
    if (this.running) {
      this.logger.warn("Monitor is already running");
      return;
    }

    this.running = true;
    const intervalMs = this.config.monitor.interval * 1000;
    this.logger.info(`Starting agent health monitor (interval: ${this.config.monitor.interval}s)`);

    this._checkAll();
    this.intervalHandle = setInterval(() => this._checkAll(), intervalMs);
  }

  stop() {
    if (!this.running) {
      this.logger.warn("Monitor is not running");
      return;
    }

    this.running = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.info("Agent health monitor stopped");
  }

  _checkAll() {
    const agents = this.config.agents;
    if (agents.length === 0) {
      this.logger.info("No agents configured for monitoring");
      return;
    }

    this.logger.info(`Checking health of ${agents.length} agent(s)`);
    for (const agentId of agents) {
      this.checkAgent(agentId);
    }
  }

  checkAgent(agentId) {
    const state = this._getState(agentId);
    const healthy = this._isAgentHealthy(agentId);

    if (healthy) {
      if (state.consecutiveFailures > 0) {
        this.alertManager.send(agentId, "info", "Agent recovered", {
          previousFailures: state.consecutiveFailures,
        });
      }
      state.consecutiveFailures = 0;
      state.lastSeen = new Date().toISOString();
      state.status = "healthy";
      this.logger.info(`Agent ${agentId}: healthy`);
    } else {
      state.consecutiveFailures++;
      state.status = "unhealthy";
      this.logger.warn(`Agent ${agentId}: unhealthy (failures: ${state.consecutiveFailures})`);

      if (state.consecutiveFailures >= this.config.monitor.max_retries) {
        if (this.restartManager.hasExceededRetries(agentId)) {
          this.alertManager.send(agentId, "critical", "Max restart retries exceeded", {
            restartAttempts: this.restartManager.getRestartCount(agentId),
          });
          state.status = "failed";
        } else {
          this.alertManager.send(agentId, "error", "Agent unresponsive, restarting", {
            consecutiveFailures: state.consecutiveFailures,
          });
          const result = this.restartManager.restart(agentId);
          if (result.success) {
            this.alertManager.send(agentId, "info", "Agent restarted successfully");
            state.consecutiveFailures = 0;
            state.status = "restarted";
          } else {
            this.alertManager.send(agentId, "error", "Restart failed", { error: result.error });
          }
        }
      }
    }

    this.agentStates.set(agentId, state);
    return state;
  }

  _isAgentHealthy(agentId) {
    try {
      const output = execSync(`pgrep -f "[o]penclaw.*${agentId}" 2>/dev/null || true`, {
        encoding: "utf8",
        timeout: this.config.monitor.timeout * 1000,
      }).trim();
      return output.length > 0;
    } catch {
      return false;
    }
  }

  _getState(agentId) {
    if (!this.agentStates.has(agentId)) {
      this.agentStates.set(agentId, {
        agentId,
        status: "unknown",
        consecutiveFailures: 0,
        lastSeen: null,
        startedAt: new Date().toISOString(),
      });
    }
    return this.agentStates.get(agentId);
  }

  getStatus(agentId) {
    if (agentId) {
      return this.agentStates.get(agentId) || null;
    }
    const result = {};
    for (const [id, state] of this.agentStates) {
      result[id] = state;
    }
    return result;
  }

  isRunning() {
    return this.running;
  }
}

// CLI entrypoint: run monitor in daemon mode
if (require.main === module) {
  const args = process.argv.slice(2);
  const configPath = args.find((a) => a.startsWith("--config="))?.split("=")[1];

  try {
    const config = loadConfig(configPath);

    if (config.agents.length === 0) {
      console.log("Agent Health Monitor - No agents configured.");
      console.log("Add agents to references/config.yaml or pass --config=<path>");
      console.log("\nExample config.yaml:");
      console.log("  agents:");
      console.log('    - "my-agent-1"');
      console.log('    - "my-agent-2"');
      console.log("\nRun with: node scripts/monitor.js --config=path/to/config.yaml");
      process.exit(0);
    }

    const monitor = new AgentMonitor({ config });
    monitor.start();

    process.on("SIGINT", () => {
      monitor.stop();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      monitor.stop();
      process.exit(0);
    });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { AgentMonitor };
