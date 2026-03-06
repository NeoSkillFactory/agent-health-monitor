#!/usr/bin/env node
"use strict";

const { AgentMonitor } = require("./monitor");
const { loadConfig, validateConfig } = require("./config");
const { Logger } = require("./logger");

function printUsage() {
  console.log(`
Agent Health Monitor CLI

Usage:
  node scripts/cli.js <command> [options]

Commands:
  start                    Start the monitoring daemon
  status                   Show status of all monitored agents
  check <agent-id>         Run a single health check on an agent
  restart <agent-id>       Manually restart an agent
  config                   Show current configuration
  help                     Show this help message

Options:
  --config=<path>          Path to config file (default: references/config.yaml)
  --interval=<seconds>     Override monitoring interval
  --log-level=<level>      Log level: debug, info, warn, error (default: info)
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.find((a) => !a.startsWith("--")) || "help";
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = {};

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      flags[key] = value || true;
    }
  }

  return { command, positional, flags };
}

function runStart(config, flags) {
  const logger = new Logger({ level: flags["log-level"] || "info" });

  if (flags.interval) {
    config.monitor.interval = parseInt(flags.interval, 10);
  }

  const monitor = new AgentMonitor({ config, logger, logLevel: flags["log-level"] });
  monitor.start();

  process.on("SIGINT", () => {
    monitor.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    monitor.stop();
    process.exit(0);
  });
}

function runStatus(config) {
  const logger = new Logger({ level: "warn" });
  const monitor = new AgentMonitor({ config, logger });

  if (config.agents.length === 0) {
    console.log("No agents configured for monitoring.");
    return;
  }

  console.log("Agent Health Status:");
  console.log("─".repeat(60));

  for (const agentId of config.agents) {
    const state = monitor.checkAgent(agentId);
    const statusIcon = state.status === "healthy" ? "[OK]" : "[!!]";
    console.log(`  ${statusIcon} ${agentId}: ${state.status} (failures: ${state.consecutiveFailures})`);
  }

  console.log("─".repeat(60));
}

function runCheck(config, agentId) {
  if (!agentId) {
    console.error("Error: agent-id is required for check command");
    process.exit(1);
  }

  const logger = new Logger({ level: "info" });
  const monitor = new AgentMonitor({ config, logger });
  const state = monitor.checkAgent(agentId);

  console.log(`\nHealth Check Result for ${agentId}:`);
  console.log(`  Status: ${state.status}`);
  console.log(`  Consecutive Failures: ${state.consecutiveFailures}`);
  console.log(`  Last Seen: ${state.lastSeen || "never"}`);
}

function runRestart(config, agentId) {
  if (!agentId) {
    console.error("Error: agent-id is required for restart command");
    process.exit(1);
  }

  const logger = new Logger({ level: "info" });
  const { RestartManager } = require("./restart");
  const manager = new RestartManager(config, logger);
  const result = manager.restart(agentId);

  if (result.success) {
    console.log(`Agent ${agentId} restarted successfully.`);
  } else {
    console.error(`Failed to restart agent ${agentId}: ${result.error}`);
    process.exit(1);
  }
}

function runConfig(config) {
  console.log("Current Configuration:");
  console.log(JSON.stringify(config, null, 2));
}

function main() {
  const { command, positional, flags } = parseArgs(process.argv);

  if (command === "help") {
    printUsage();
    return;
  }

  const configPath = flags.config || undefined;
  let config;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    console.error(`Error loading configuration: ${err.message}`);
    process.exit(1);
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error(`Invalid configuration: ${validation.errors.join(", ")}`);
    process.exit(1);
  }

  switch (command) {
    case "start":
      runStart(config, flags);
      break;
    case "status":
      runStatus(config);
      break;
    case "check":
      runCheck(config, positional[1]);
      break;
    case "restart":
      runRestart(config, positional[1]);
      break;
    case "config":
      runConfig(config);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
