# Agent Health Monitor API Reference

## CLI Commands

### start

Start the monitoring daemon. Runs continuously until stopped with SIGINT/SIGTERM.

```bash
node scripts/cli.js start [--config=<path>] [--interval=<seconds>] [--log-level=<level>]
```

**Options:**
- `--config=<path>` - Path to YAML configuration file
- `--interval=<seconds>` - Override monitoring interval
- `--log-level=<level>` - Set log verbosity: debug, info, warn, error

### status

Display current health status of all configured agents.

```bash
node scripts/cli.js status [--config=<path>]
```

### check

Run a single health check on a specific agent.

```bash
node scripts/cli.js check <agent-id> [--config=<path>]
```

### restart

Manually restart a specific agent.

```bash
node scripts/cli.js restart <agent-id> [--config=<path>]
```

### config

Display the current merged configuration.

```bash
node scripts/cli.js config [--config=<path>]
```

## Programmatic API

### AgentMonitor

```javascript
const { AgentMonitor } = require("./scripts/monitor");

const monitor = new AgentMonitor({
  configPath: "path/to/config.yaml",
  logLevel: "info",
});

monitor.start();          // Start monitoring loop
monitor.stop();           // Stop monitoring
monitor.checkAgent(id);   // Check single agent
monitor.getStatus();      // Get all agent states
monitor.isRunning();      // Check if monitor is active
```

### AlertManager

```javascript
const { AlertManager } = require("./scripts/alert");

const alerter = new AlertManager(config);
alerter.send(agentId, "error", "Agent crashed");
alerter.getHistory(agentId);
```

### RestartManager

```javascript
const { RestartManager } = require("./scripts/restart");

const restarter = new RestartManager(config);
restarter.restart(agentId, { mode: "graceful" });
restarter.getRestartCount(agentId);
restarter.hasExceededRetries(agentId);
```

## Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `monitor.interval` | number | 30 | Polling interval in seconds |
| `monitor.timeout` | number | 10 | Agent response timeout in seconds |
| `monitor.max_retries` | number | 3 | Max restart attempts before escalating |
| `alerts.enabled` | boolean | true | Enable/disable alerts |
| `alerts.channels` | string[] | ["stdout"] | Notification channels |
| `alerts.severity_threshold` | string | "warning" | Minimum alert severity |
| `agents` | string[] | [] | List of agent IDs to monitor |
