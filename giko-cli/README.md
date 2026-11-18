# G.I KO KO CLI

Lightweight phone-first coding agent for Termux/ARMv7.

Features:
- interactive agent shell
- one-shot `run`
- live OpenCode free-model catalog from models.dev
- session IDs and project working directory
- `@file` context
- `!shell`
- `/models`, `/model`, `/doctor`, `/clear`, `/exit`
- local configuration
- OpenAI-compatible endpoint

No OpenCode account is stored by this CLI. OpenCode documents free models as available without an account. The hosted free tier is enforced server-side and can reject non-OpenCode clients; this project does not bypass or spoof that enforcement.

Termux:
  bash giko-cli/install.sh
  giko --version
  giko models
  giko

Config: ~/.config/giko-koko/config.json
