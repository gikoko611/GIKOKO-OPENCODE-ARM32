# OpenCode Skills support on Termux ARMv7

## Status

OpenCode already has a native Agent Skills feature. Skills are reusable, on-demand instructions loaded through OpenCode's built-in `skill` tool. This ARMv7 repository is a Termux packaging/port layer, not a separate reimplementation of the OpenCode application source, so the correct approach is to preserve the upstream Skills implementation and its tool registration rather than add a second, incompatible skill engine.

The ARMv7 port is not yet a complete runnable OpenCode build. Therefore, Skills support is a required compatibility gate, not a feature claimed as device-verified today.

## Supported upstream skill locations

The upstream runtime discovers skills from these locations:

| Scope | Path |
|---|---|
| Global OpenCode | `~/.config/opencode/skills/<skill-id>/SKILL.md` |
| Project OpenCode | `.opencode/skills/<skill-id>/SKILL.md` |
| Global Claude compatibility | `~/.claude/skills/<skill-id>/SKILL.md` |
| Project Claude compatibility | `.claude/skills/<skill-id>/SKILL.md` |
| Global Agent compatibility | `~/.agents/skills/<skill-id>/SKILL.md` |
| Project Agent compatibility | `.agents/skills/<skill-id>/SKILL.md` |

On Termux, `~` is the Termux home directory (normally `/data/data/com.termux/files/home`). Do not hardcode another user's home path.

A skill directory can include `SKILL.md` plus supporting `references/`, `scripts/`, and `assets/` files. The skill ID is derived from its path, not the frontmatter display name.

## Minimal example

Create:

```text
~/.config/opencode/skills/termux-helper/SKILL.md
```

Contents:

```markdown
---
name: Termux Helper
description: Diagnose and maintain Android Termux environments
---

# Termux Helper

1. Check Android and Termux architecture before installing binaries.
2. Prefer packages built for the device ABI.
3. Explain commands before destructive operations.
4. Never assume GNU/Linux glibc binaries run on Android Bionic.
```

OpenCode should discover this skill automatically when the Skills subsystem is available. Agents can load it through the native `skill` tool by its path-derived ID (`termux-helper`), or a user can refer to it as `@termux-helper`.

## Additional skill sources

OpenCode configuration can add local folders or an HTTP skill catalog:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": [
    "./team-skills",
    "~/shared/opencode-skills",
    "https://example.com/opencode/skills/"
  ]
}
```

HTTP catalogs require an `index.json` and same-origin, safe relative file paths. Use the upstream Skills documentation for the complete catalog format and validation rules.

## ARMv7 port preservation requirements

The ARMv7 build must retain all upstream Skills behavior:

- skill discovery from all six locations above;
- `SKILL.md` frontmatter parsing and path-derived IDs;
- native `skill` tool registration and model-visible skill descriptions;
- on-demand skill loading, including skill body and supporting-file context;
- skill permission rules (`allow`, `ask`, `deny`) and agent-level permissions;
- explicit `skills` config entries, local directories, and HTTP catalogs;
- compatibility with existing OpenCode, Claude, and Agent skill folders.

Do not replace this with a prompt-only approximation, a static list of built-in skills, or a custom command that bypasses permission checks.

## Required release tests

Once the complete ARMv7 CLI bundle is available, run these tests on the actual Android/Termux target:

1. Create a global skill under `~/.config/opencode/skills/armv7-smoke/SKILL.md`; verify it is discovered.
2. Create a project skill under `.opencode/skills/project-smoke/SKILL.md`; verify it is discovered.
3. Verify a skill with no description is not advertised for automatic discovery, but can be explicitly loaded where upstream behavior allows it.
4. Load each skill and confirm the exact Markdown body and relative supporting-file paths are available.
5. Verify duplicate-ID precedence matches upstream behavior.
6. Verify `allow`, `ask`, and `deny` permissions are enforced, including agent-specific rules.
7. Verify configured local and HTTP catalog sources load correctly.
8. Verify skill discovery and loading do not regress agents, providers, sessions, tools, MCP, LSP, plugins, or the TUI.

A successful cross-build alone is not sufficient. Mark Skills as ARMv7 verified only after these tests pass on the target device.

## Upstream reference

- Official documentation: https://opencode.ai/docs/skills/
- Upstream implementation source: https://github.com/anomalyco/opencode

