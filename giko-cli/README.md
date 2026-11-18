# G.I KO KO Code CLI 0.2.0

Phone-first Claude-Code-style coding agent for Termux / Android ARMv7. Uses Node.js built-ins only; no npm dependencies.

## Install

```sh
bash giko-cli/install.sh
gcode --version
gcode
```

## Agent features

- Interactive chat-style terminal UI
- OpenAI-compatible chat completions and function/tool calling
- Project tools: list files, read files, search text, create/replace files, exact-text edits
- Shell command and Git status/diff tools
- Ask mode (approval for file writes and shell commands), Auto mode, Plan mode
- Persistent configuration and conversation session snapshots
- Project Skills discovery from `.gcode/skills/<name>/SKILL.md`
- Built-in task profiles: coder, reviewer, tester, planner
- Interactive `/settings` feature toggles, live provider model picker, free-model filter, provider/API-key configuration
- `@path` file context, `!command` shell shortcut
- Session controls: `/status`, `/context`, `/compact`, `/resume`, `/clear`

## Commands

| Command | Purpose |
|---|---|
| `/settings` | Interactive feature and provider settings |
| `/plan <task>` | One-shot plan without tool execution |
| `/plan` | Enable plan mode |
| `/ask` / `/auto` | Switch permission mode |
| `/agent coder <task>` | Coder task profile |
| `/agent reviewer <task>` | Review task profile |
| `/agent tester <task>` | Testing task profile |
| `/agent planner <task>` | Planning task profile |
| `/skills` | List project Skills |
| `/model` / `/models` | Open live provider model picker (free-only filter, refresh, manual ID) |
| `/model <id>` | Set model directly |
| `/doctor` | Environment/provider check |
| `/status` | Current session and enabled features |
| `/resume <session-id>` | Resume a saved session |
| `/clear` | Start a new session |
| `/exit` | Exit |

Non-interactive commands: `gcode run <task>`, `gcode settings`, `gcode doctor`, `gcode config`, `gcode set baseURL|model|apiKey <value>`.

## Configuration

Stored at `~/.config/gcode-koko/config.json`. Existing provider URL, model and API key are preserved when upgrading. Defaults for a fresh install target the Kilo OpenAI-compatible gateway; set your own provider with:

```sh
gcode set baseURL https://ai-gateway.kilo.ai/api/v1
gcode set model kilo-auto/free
gcode set apiKey YOUR_KEY
```

Project root is the current working directory. File tools reject paths outside that directory. In Ask mode, file writes and shell commands require explicit approval. Auto mode skips those confirmations; use it only in a project you trust.

## Runtime integration status

MCP, external plugin runtimes, LSP servers, lifecycle hooks, and independent parallel subagents are exposed as configuration/roadmap toggles but are **not yet wired to protocol runtimes** in this lightweight release. Agent tool use also depends on the selected provider supporting OpenAI-compatible function calling. No CLI can bypass provider-side rate limits or access policies.

## Target

Termux on Android 10, ARMv7 32-bit. Node.js 20+ (Termux Node.js supported). No PC build step; GitHub Actions packages the source bundle.
