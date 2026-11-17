# ARMv7 Custom Provider compatibility

This document records the upstream OpenCode V2 provider contract that the
Termux/ARMv7 port must preserve. It is a compatibility target, not a claim
that the current ARMv7 test release already runs the full CLI.

## OpenAI-compatible provider

OpenCode V2 uses the `providers` map (plural), a provider runtime package,
provider settings, and a model map. The supported upstream runtime package
for OpenAI-compatible chat-completions APIs is
`@opencode/ai/providers/openai-compatible`.

Example `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "my-gateway/qwen-coder",
  "providers": {
    "my-gateway": {
      "name": "My Gateway",
      "env": ["MY_GATEWAY_API_KEY"],
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "https://gateway.example.com/v1"
      },
      "models": {
        "qwen-coder": {
          "name": "Qwen Coder",
          "modelID": "vendor/qwen-coder"
        }
      }
    }
  }
}
```

Set `MY_GATEWAY_API_KEY` in the Termux environment before starting
OpenCode. Do not commit real credentials to the repository or place them in
the example config. The model map key (`qwen-coder`) is the local OpenCode
model ID; `modelID` is the ID sent to the upstream API.

For an API that implements the OpenAI Responses API rather than
`/chat/completions`, select the matching upstream Responses runtime package
instead of assuming the chat-completions package is interchangeable.

## Expected CLI behavior

The ARMv7 port must retain the upstream commands and provider machinery:

1. `/connect` for provider credentials where supported.
2. `/models` to choose a configured provider/model.
3. Provider credentials resolved through OpenCode's credential integration,
   environment variables, or supported provider-specific mechanisms.
4. Model-specific settings, headers, request body overrides, capabilities,
   context/output limits, and provider errors.
5. Multiple configured providers must coexist with built-in providers.

A custom provider declaration does not automatically imply dynamic model
discovery. The upstream custom-provider recipe requires an explicit `models`
map. Discovery is available only for runtimes/providers that implement it,
or through a compatible plugin. The ARMv7 port must not silently promise
`GET /models` discovery for every arbitrary endpoint.

## ARMv7 validation requirements

A future device acceptance test must use a local mock OpenAI-compatible
endpoint and verify:

- provider config parses and is loaded;
- the model appears under the exact `provider-id/model-id` reference;
- the API key is sent as a bearer credential and is not printed in logs;
- a chat-completions request reaches the configured `baseURL`;
- streaming and non-streaming responses are handled;
- tool calls are preserved when the model advertises/supports them;
- a failed connection reports a useful error without corrupting sessions;
- a second custom provider can be configured without replacing the first.

These checks are separate from cross-compilation and must eventually run on
the Redmi 9A / Android 10 / 32-bit Termux target.

## Upstream reference

- https://opencode.ai/docs/providers
