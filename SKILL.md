---
name: agent-health-monitor
description: Automatically monitors and restarts crashed or unresponsive OpenClaw agents with configurable alerts and self-healing capabilities
---

# Agent Health Monitor

## Purpose

This skill provides automated health monitoring and self-healing for OpenClaw agents. It continuously checks agent responsiveness, automatically restarts crashed or hanging agents, and sends configurable alerts when failures occur.

## Core Capabilities

- **Continuous Monitoring**: Polls agent health at configurable intervals
- **Auto-Restart**: Automatically restarts crashed or unresponsive agents
- **Alerting**: Sends notifications when agents fail or recover
- **Statistics Tracking**: Tracks uptime, restart counts, and failure history
- **CLI Interface**: Manual health checks, status display, and control commands
- **Configuration**: Customizable intervals, thresholds, and alert channels

## Directory Layout

```
.
├── SKILL.md              # This file
├── scripts/
│   ├── monitor.js        # Agent health monitoring engine
│   ├── cli.js            # Command line interface
│   ├── restart.js        # Agent restart logic
│   ├── alert.js          # Notification system
│   ├── config.js         # Configuration handler
│   └── logger.js         # Logging utility
├── references/
│   ├── api.md            # CLI and API documentation
│   └── config.yaml       # Configuration schema example
└── package.json
```

## Configuration Guide

See `references/config.yaml` for the full configuration schema. Key fields:

- `monitor.interval` - Polling interval in seconds (default: 30)
- `monitor.timeout` - Agent response timeout in seconds (default: 10)
- `monitor.max_retries` - Max restart attempts before alerting (default: 3)
- `alerts.channels` - List of notification channels
- `agents` - List of agent IDs or patterns to monitor

## Trigger Logic

The monitor detects agent failures through:

1. **Process Check**: Verifies the agent process is running
2. **Heartbeat Check**: Sends a ping and waits for a response within timeout
3. **Consecutive Failures**: Tracks failures and triggers restart after threshold

## Alert System

Alerts are sent when:
- An agent crashes or becomes unresponsive
- An agent is restarted (success or failure)
- Maximum restart retries are exceeded
- An agent recovers after being restarted

Alert severity levels: `info`, `warning`, `error`, `critical`

## CLI Reference

```bash
# Start monitoring
node scripts/cli.js start

# Check status of all agents
node scripts/cli.js status

# Restart a specific agent
node scripts/cli.js restart <agent-id>

# Run a single health check
node scripts/cli.js check <agent-id>

# Stop monitoring
node scripts/cli.js stop
```

## Dependencies

- **js-yaml**: YAML configuration parsing
- **Node.js >= 16**: Runtime requirement
