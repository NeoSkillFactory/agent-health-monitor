# agent-health-monitor

![Audit](https://img.shields.io/badge/audit%3A%20PASS-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![OpenClaw](https://img.shields.io/badge/OpenClaw-skill-orange)

> Automatically monitors and restarts crashed or unresponsive OpenClaw agents with configurable alerts and self-healing capabilities

## Features

- **Continuous Monitoring**: Polls agent health at configurable intervals
- **Auto-Restart**: Automatically restarts crashed or unresponsive agents
- **Alerting**: Sends notifications when agents fail or recover
- **Statistics Tracking**: Tracks uptime, restart counts, and failure history
- **CLI Interface**: Manual health checks, status display, and control commands
- **Configuration**: Customizable intervals, thresholds, and alert channels

## Requirements

- **js-yaml**: YAML configuration parsing
- **Node.js >= 16**: Runtime requirement

## Configuration

See `references/config.yaml` for the full configuration schema. Key fields:

- `monitor.interval` - Polling interval in seconds (default: 30)
- `monitor.timeout` - Agent response timeout in seconds (default: 10)
- `monitor.max_retries` - Max restart attempts before alerting (default: 3)
- `alerts.channels` - List of notification channels
- `agents` - List of agent IDs or patterns to monitor

## GitHub

Source code: [github.com/NeoSkillFactory/agent-health-monitor](https://github.com/NeoSkillFactory/agent-health-monitor)

## License

MIT © NeoSkillFactory