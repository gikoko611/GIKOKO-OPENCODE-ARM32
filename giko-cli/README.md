# G.I KO KO Code CLI

Lightweight phone-first coding agent for Termux/ARMv7.

Features:
- interactive coding-agent shell
- one-shot run
- OpenCode model catalog lookup
- session IDs and project working directory
- @file context and !shell
- /models, /model, /doctor, /clear, /exit
- local configuration and OpenAI-compatible providers

Termux install:
  bash giko-cli/install.sh
  gcode --version
  gcode models
  gcode

Config: ~/.config/gcode-koko/config.json

Note: the model catalog is separate from inference access. OpenCode may restrict its hosted free inference to its official client. This CLI does not bypass that server-side policy.

Build target: ARMv7 / 32-bit Android. Node.js is supplied by Termux.
