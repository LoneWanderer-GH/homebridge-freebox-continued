# Copilot Instructions — homebridge-freebox-continued

Homebridge dynamic platform plugin (TypeScript, ESM) exposing **Freebox Home** devices to Apple HomeKit via the [Freebox Home API](https://dev.freebox.fr/sdk/os/home/).

## Architecture

```
FreeboxPlatform (DynamicPlatformPlugin)
├── FreeboxController       — API version discovery (src/freeboxOS/FreeboxApi.ts)
├── FreeboxSession          — App token + HMAC session auth (src/freeboxOS/FreeboxSession.ts)
├── FreeboxRequest          — Authenticated HTTP dispatcher + retry logic (src/freeboxOS/FreeboxRequest.ts)
│   └── Network             — node-fetch wrapper, HTTP/HTTPS (src/network/Network.ts)
├── Controllers             — One per device type (src/controllers/)
└── Platform Accessories    — One per device type (src/platformAccessory*.ts)
```

Key facts:
- Auth token persisted to `freebox-auth.json` in Homebridge storage path (`api.user.storagePath()`)
- TLS: Freebox public CA bundled at repo root as `FBXCerts.crt`, loaded via absolute path using `import.meta.url`
- Camera streaming: RTSP → ffmpeg → HomeKit via `ffmpeg-camera/streamingDelegate.ts`
- All polling intervals are user-configurable in `config.schema.json`

## Build & Dev

```bash
npm install          # install deps
npm run build        # rimraf dist && tsc
npm run lint         # eslint src/**/*.ts --max-warnings=0
npm run watch        # build + npm link + nodemon (requires test/hbConfig/config.json)
```

Test config lives at `test/hbConfig/config.json`. The `dist/` folder is the published artifact.

## Code Conventions

- **ESM only** (`"type": "module"`) — always use `.js` extensions in imports even for `.ts` source files
- **Homebridge v2 async API** — use `async onGet/onSet` handlers; never use the deprecated `CharacteristicSetCallback`
- **PluginLogger** wrapper (`src/PluginLogger.ts`) — use it instead of `this.log` directly; it prefixes messages with the class namespace
- `RetryPolicy.AUTO_RETRY` for write operations, `RetryPolicy.NO_RETRY` for reads
- Hard limits on recursive retries — never allow unbounded recursion (see `MAX_API_DISCOVERY_RETRIES` in `FreeboxApi.ts`)

## HomeKit Constraints

- `SerialNumber` characteristic: **must be > 1 character** — always use `'FBX-<type>-<id>'` format
- `FirmwareRevision`: never set to empty string — use `'1.0.0'` as default
- Accessories must call `configureAccessory()` on restore from cache before registering new ones

## Security Rules

- Never log camera passwords, session tokens, or `app_token` values — even at debug level
- `FreeboxRequest.credentials` is **private** — do not expose it
- Validate `config.freeBoxAddress` before using it to construct URLs

## Roadmap

Open items tracked in `ROADMAP.md`. Update it when fixes are applied.
