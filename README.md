# @intrvls/n8n-nodes-google-gemini

[![npm version](https://img.shields.io/npm/v/@intrvls/n8n-nodes-google-gemini.svg)](https://www.npmjs.com/package/@intrvls/n8n-nodes-google-gemini)

An n8n community node that exposes a **Google Gemini Chat Model** as an AI Language Model sub-node, built on
[`@intrvls/langchain-google-genai`](https://www.npmjs.com/package/@intrvls/langchain-google-genai) — the standalone port of
`@langchain/google-genai` re-based onto the new `@google/genai` SDK and pinned to the `@langchain/core` line n8n ships
(`1.1.x`).

It is a feature-complete equivalent of n8n's built-in `LmChatGoogleGemini` node, packaged for standalone/community
installation and wired to the port instead of the upstream LangChain package.

## Features

- Outputs an `ai_languageModel` connection — drop it onto any **AI Agent** or **Chain** node.
- **Model selector** populated live from the Gemini API (`GET /v1beta/models`), filtering out embedding/imagen models
  **and anything older than Gemini 2.5** (1.x, 2.0, and unversioned aliases), sorted alphabetically.
- Node **versions `1` and `1.1`** with version-appropriate default models
  (`models/gemini-2.5-flash` for v1, `models/gemini-3-flash-preview` for v1.1+).
- **Thinking / reasoning controls**:
  - **Thinking Level** (`Minimal` / `Low` / `Medium` / `High`) — the reasoning-effort knob for **Gemini 3+**.
  - **Thinking Budget** (token integer; `-1` dynamic, `0` off) — the equivalent control for **Gemini 2.5**.
  - **Include Thoughts** — return the model's thought summaries when available.
  - These are sent as `thinkingConfig` and omitted entirely when unset (the API rejects them on non-thinking models).
- **Options**: maximum output tokens, sampling temperature, top-K, top-P, stop sequences (up to 5),
  maximum retries, and JSON-only output.
- **Safety settings** (`fixedCollection`): per-`HarmCategory` block thresholds, mapped to `@google/genai`'s
  `HarmCategory` / `HarmBlockThreshold` enums.
- Uses the standard `googlePalmApi` credential (API key + host).

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter `@intrvls/n8n-nodes-google-gemini`.

## Compatibility

- **n8n**: requires a version on the `@langchain/core@1.1.x` line (the node and its underlying port are pinned to it).
- **Node.js**: `>=20`.
- **Underlying library**: [`@intrvls/langchain-google-genai@^3.0.0-alpha.0`](https://www.npmjs.com/package/@intrvls/langchain-google-genai).

## Local development

```bash
npm install
npm run build   # tsc && gulp build:icons — compiles to dist/ and copies the SVG icon
npm run dev     # tsc --watch
npm run lint    # tsc --noEmit (type-check only)
```

The compiled `dist/credentials` and `dist/nodes` entries are referenced from the `n8n` block in `package.json`.
`dist/` is gitignored and rebuilt automatically on publish via the `prepublishOnly` script.

## Credentials

Create a **Google Gemini(PaLM) Api** (`googlePalmApi`) credential:

| Field   | Description                                                              |
| ------- | ------------------------------------------------------------------------ |
| Host    | API base URL (default `https://generativelanguage.googleapis.com`)       |
| API Key | Your Google Generative Language / AI Studio API key                      |

The credential authenticates by appending `?key=<apiKey>` and is tested against `/v1beta/models`.

## Links

- Repository: <https://github.com/intrvls/n8n-nodes-google-gemini>
- Issues: <https://github.com/intrvls/n8n-nodes-google-gemini/issues>
- Underlying library: <https://www.npmjs.com/package/@intrvls/langchain-google-genai>

## License

MIT
