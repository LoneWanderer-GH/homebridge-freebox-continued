# Roadmap — homebridge-freebox-continued

This document tracks the planned improvements before and after the first public release on npm.

---

## Status legend

| Icon | Meaning |
|---|---|
| 🔴 | Blocker for public release |
| 🟠 | High priority (security / stability) |
| 🟡 | Medium priority (quality / correctness) |
| 🟢 | Nice to have / future improvement |
| ✅ | Done |

---

## v0.1.0 — Pre-release stabilisation (blockers)

These items must be resolved before publishing to npm.

### 🔴 Build & publish readiness

- [x] Set `"private": false` in `package.json`
- [x] Widen `engines.node` to `">=18.20.0"` (was `^22.10.0 || ^24.0.0`)
- [x] Align CI matrix with supported Node versions (added 22.x, 24.x; kept 18.x, 20.x)
- [x] Remove unused dependency `homebridge-lib` from `package.json`
- [x] Remove redundant dependency `https` from `package.json` (native Node.js module)
- [ ] Remove dead-code files: `src/network/NetworkHTTPS.ts`, `src/network/WebSocket.ts`, `src/freeboxOS/FreeboxRequestsStrategy.ts`
- [ ] Remove legacy `.eslintrc` (conflicts with flat `eslint.config.js`)
- [x] Create `test/hbConfig/` directory referenced by `nodemon.json`

### 🔴 Security — critical

- [x] **Fix `FBXCerts.crt` path** in `Network.ts`: now uses absolute path via `import.meta.url` — works regardless of process working directory
- [x] **Add hard recursion limit** to `getActualApiUrl()` — capped at 10 attempts, throws a descriptive error
- [ ] **Add hard recursion limit** to `FreeboxSession.start()` during `Pending` state (current `Number.MAX_SAFE_INTEGER` guard is not practical)

### 🟠 Security — high priority

- [x] Make `FreeboxRequest.credentials` private (was exposed as a public property)
- [ ] Add basic validation of `config.freeBoxAddress` (reject clearly malformed hostnames/IPs)
- [ ] Avoid logging full camera credentials even at debug level

### 🟡 Correctness

- [ ] Replace deprecated `CharacteristicSetCallback` with async `onSet` handlers (Homebridge v2 API)
- [ ] Replace hardcoded `'Default-Manufacturer'` / `'Default-Model'` / `'Default-Serial'` with real Freebox node data where available
- [x] Fix `FreeboxRequest` class logger namespace name (was `'DataNotUpdatedError'`, now `'FreeboxRequest'`)

---

## v0.2.0 — Stability & user experience

- [ ] Add proper error boundary in `platform.didFinishLaunching` — a thrown error currently crashes the entire plugin silently
- [ ] Implement exponential backoff for API retries instead of fixed delays
- [ ] Surface a user-friendly error when Freebox authorization is denied/timeout (currently only logged, no UI feedback)
- [ ] Add a `sensorsRefreshRateMilliSeconds` config option (currently sensors are only read on demand)
- [ ] Unit tests for controllers (AlarmController, SensorsController) using mock network
- [ ] Integration smoke test: verify plugin loads without crashing with a mock Freebox API

---

## v0.3.0 — Homebridge UI & polish

- [ ] Add `homebridge-ui` custom UI for first-time authorization flow (guided pairing screen)
- [ ] Populate `Manufacturer`, `Model`, `SerialNumber` from `FBXApiVersion` data
- [ ] Add `FirmwareRevision` characteristic from Freebox firmware version
- [ ] Submit to [Homebridge Verified Plugin program](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

---

## v1.0.0 — Full feature parity + WebSocket support

- [ ] Implement WebSocket event subscription (real-time push from Freebox instead of polling) — `src/network/WebSocket.ts` was started but commented out
- [ ] Remove polling loops once WebSocket is stable
- [ ] Support Freebox Delta camera "détection de mouvement" natively through HomeKit motion sensor linked to camera

---

## Known limitations

- Camera streaming requires `ffmpeg` to be installed on the Homebridge host. It is bundled via `ffmpeg-for-homebridge` but may not be available on all architectures.
- RTSP URL construction falls back to a hardcoded pattern if not provided by the Freebox API; this may not work for all camera models.
- The plugin uses HTTP polling for device state; real-time events are not yet supported (see WebSocket roadmap item).
- Freebox delta firmware updates may change API behavior. The plugin targets API v8 by default.

---

## How to contribute

See [CONTRIBUTING](#) section in [README.md](README.md). For bugs or feature requests, open an [issue](https://github.com/LoneWanderer-GH/homebridge-freebox-continued/issues).
