#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const DEFAULTS = {
  monitor: {
    interval: 30,
    timeout: 10,
    max_retries: 3,
  },
  alerts: {
    enabled: true,
    channels: ["stdout"],
    severity_threshold: "warning",
  },
  agents: [],
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object"
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function loadConfig(configPath) {
  if (!configPath) {
    configPath = path.join(__dirname, "..", "references", "config.yaml");
  }

  let userConfig = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf8");
    userConfig = yaml.load(raw) || {};
  }

  return deepMerge(DEFAULTS, userConfig);
}

function validateConfig(config) {
  const errors = [];

  if (typeof config.monitor.interval !== "number" || config.monitor.interval < 1) {
    errors.push("monitor.interval must be a positive number");
  }
  if (typeof config.monitor.timeout !== "number" || config.monitor.timeout < 1) {
    errors.push("monitor.timeout must be a positive number");
  }
  if (typeof config.monitor.max_retries !== "number" || config.monitor.max_retries < 0) {
    errors.push("monitor.max_retries must be a non-negative number");
  }
  if (!Array.isArray(config.alerts.channels) || config.alerts.channels.length === 0) {
    errors.push("alerts.channels must be a non-empty array");
  }
  if (!Array.isArray(config.agents)) {
    errors.push("agents must be an array");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { loadConfig, validateConfig, DEFAULTS, deepMerge };
