# G.I KO KO CLI

Lightweight phone-first coding agent for Termux/ARMv7.

Features:
- interactive agent shell
- one-shot run
- live OpenCode free-model catalog
- session IDs and project working directory
- @file context
- !shell
- /models, /model, /doctor, /clear, /exit
- local configuration
- OpenAI-compatible endpoint
- GitHub Actions ARMv7/Termux bundle

No OpenCode account is stored by this CLI. OpenCode documents free models as available without an account. The hosted free tier is enforced server-side and may reject non-OpenCode clients; this project does not bypass or spoof that enforcement.

Termux:
  bash giko-cli/install.sh
  giko --version
  giko models
  giko

Config: ~/.config/giko-koko/config.json

Build target: ARMv7 / 32-bit Android. Node.js is supplied by Termux.
