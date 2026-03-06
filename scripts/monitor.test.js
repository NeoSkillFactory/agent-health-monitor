#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { Logger } = require("./logger");
const { loadConfig, validateConfig, DEFAULTS, deepMerge } = require("./config");
const { AlertManager, SEVERITY_LEVELS } = require("./alert");
const { RestartManager } = require("./restart");
const { AgentMonitor } = require("./monitor");

describe("Logger", () => {
  it("should create log entries", () => {
    const logger = new Logger({ level: "debug" });
    logger.info("test message", { key: "value" });
    const entries = logger.getEntries();
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].message, "test message");
    assert.strictEqual(entries[0].level, "info");
    assert.deepStrictEqual(entries[0].data, { key: "value" });
  });

  it("should filter by log level", () => {
    const logger = new Logger({ level: "error" });
    logger.info("should not appear");
    logger.debug("should not appear");
    logger.error("should appear");
    const entries = logger.getEntries();
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].level, "error");
  });

  it("should clear entries", () => {
    const logger = new Logger({ level: "debug" });
    logger.info("test");
    assert.strictEqual(logger.getEntries().length, 1);
    logger.clear();
    assert.strictEqual(logger.getEntries().length, 0);
  });
});

describe("Config", () => {
  it("should load defaults when no config file exists", () => {
    const config = loadConfig("/nonexistent/path/config.yaml");
    assert.deepStrictEqual(config, DEFAULTS);
  });

  it("should load and merge config from file", () => {
    const config = loadConfig();
    assert.strictEqual(config.monitor.interval, 30);
    assert.strictEqual(config.monitor.timeout, 10);
    assert.deepStrictEqual(config.alerts.channels, ["stdout"]);
  });

  it("should validate valid config", () => {
    const result = validateConfig(DEFAULTS);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("should reject invalid config", () => {
    const bad = deepMerge(DEFAULTS, { monitor: { interval: -1 } });
    const result = validateConfig(bad);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("interval")));
  });

  it("should deep merge objects", () => {
    const a = { x: { y: 1, z: 2 }, a: 3 };
    const b = { x: { y: 10 }, b: 4 };
    const merged = deepMerge(a, b);
    assert.strictEqual(merged.x.y, 10);
    assert.strictEqual(merged.x.z, 2);
    assert.strictEqual(merged.a, 3);
    assert.strictEqual(merged.b, 4);
  });
});

describe("AlertManager", () => {
  it("should send and record alerts", () => {
    const logger = new Logger({ level: "error" });
    const alerter = new AlertManager(
      { alerts: { enabled: true, channels: ["stdout"], severity_threshold: "info" } },
      logger
    );
    const entry = alerter.send("agent-1", "error", "Agent crashed");
    assert.strictEqual(entry.agentId, "agent-1");
    assert.strictEqual(entry.severity, "error");
    assert.strictEqual(entry.message, "Agent crashed");
  });

  it("should filter alerts below threshold", () => {
    const logger = new Logger({ level: "error" });
    const alerter = new AlertManager(
      { alerts: { enabled: true, channels: ["stdout"], severity_threshold: "error" } },
      logger
    );
    alerter.send("agent-1", "info", "Low priority");
    alerter.send("agent-1", "error", "High priority");
    const history = alerter.getHistory("agent-1");
    assert.strictEqual(history.length, 2);
  });

  it("should skip alerts when disabled", () => {
    const logger = new Logger({ level: "error" });
    const alerter = new AlertManager(
      { alerts: { enabled: false, channels: ["stdout"], severity_threshold: "info" } },
      logger
    );
    alerter.send("agent-1", "critical", "Should be skipped");
    assert.strictEqual(alerter.getHistory().length, 1);
  });

  it("should filter history by agent", () => {
    const logger = new Logger({ level: "error" });
    const alerter = new AlertManager(
      { alerts: { enabled: true, channels: [], severity_threshold: "info" } },
      logger
    );
    alerter.send("agent-1", "info", "msg1");
    alerter.send("agent-2", "info", "msg2");
    assert.strictEqual(alerter.getHistory("agent-1").length, 1);
    assert.strictEqual(alerter.getHistory("agent-2").length, 1);
    assert.strictEqual(alerter.getHistory().length, 2);
  });
});

describe("RestartManager", () => {
  it("should track restart history", () => {
    const logger = new Logger({ level: "error" });
    const manager = new RestartManager({ monitor: { max_retries: 3 } }, logger);
    const result = manager.restart("agent-1");
    assert.strictEqual(result.agentId, "agent-1");
    assert.strictEqual(result.success, true);
    assert.strictEqual(manager.getRestartCount("agent-1"), 1);
    assert.strictEqual(manager.getSuccessfulRestarts("agent-1"), 1);
    assert.strictEqual(manager.getFailedRestarts("agent-1"), 0);
  });

  it("should track exceeded retries", () => {
    const logger = new Logger({ level: "error" });
    const manager = new RestartManager({ monitor: { max_retries: 2 } }, logger);
    assert.strictEqual(manager.hasExceededRetries("agent-1"), false);
  });

  it("should support force restart mode", () => {
    const logger = new Logger({ level: "error" });
    const manager = new RestartManager({ monitor: { max_retries: 3 } }, logger);
    const result = manager.restart("agent-1", { mode: "force" });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.mode, "force");
  });
});

describe("AgentMonitor", () => {
  it("should initialize with valid config", () => {
    const config = deepMerge(DEFAULTS, { agents: ["test-agent"] });
    const monitor = new AgentMonitor({ config });
    assert.strictEqual(monitor.isRunning(), false);
  });

  it("should throw on invalid config", () => {
    const config = deepMerge(DEFAULTS, { monitor: { interval: -1 } });
    assert.throws(() => new AgentMonitor({ config }), /Invalid configuration/);
  });

  it("should check agent health", () => {
    const config = deepMerge(DEFAULTS, { agents: ["nonexistent-agent-xyz"] });
    const logger = new Logger({ level: "error" });
    const monitor = new AgentMonitor({ config, logger });
    const state = monitor.checkAgent("nonexistent-agent-xyz");
    assert.strictEqual(state.status, "unhealthy");
    assert.strictEqual(state.consecutiveFailures, 1);
  });

  it("should start and stop monitoring", () => {
    const config = deepMerge(DEFAULTS, { agents: [], monitor: { interval: 60 } });
    const logger = new Logger({ level: "error" });
    const monitor = new AgentMonitor({ config, logger });
    monitor.start();
    assert.strictEqual(monitor.isRunning(), true);
    monitor.stop();
    assert.strictEqual(monitor.isRunning(), false);
  });

  it("should return status for all agents", () => {
    const config = deepMerge(DEFAULTS, { agents: ["a1", "a2"] });
    const logger = new Logger({ level: "error" });
    const monitor = new AgentMonitor({ config, logger });
    monitor.checkAgent("a1");
    monitor.checkAgent("a2");
    const status = monitor.getStatus();
    assert.ok("a1" in status);
    assert.ok("a2" in status);
    assert.strictEqual(monitor.getStatus("a1").agentId, "a1");
    assert.strictEqual(monitor.getStatus("nonexistent"), null);
  });
});
