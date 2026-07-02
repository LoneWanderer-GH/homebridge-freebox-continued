<p align="center">
  <img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>

<span align="center">

# homebridge-freebox-continued

**Homebridge plugin for Freebox Home devices**  
Alarm · Motion Sensors · Door/Window Sensors · Shutters · Cameras

[![npm](https://img.shields.io/npm/v/homebridge-freebox-continued)](https://www.npmjs.com/package/homebridge-freebox-continued)
[![Build and Lint](https://github.com/LoneWanderer-GH/homebridge-freebox-continued/actions/workflows/build.yml/badge.svg)](https://github.com/LoneWanderer-GH/homebridge-freebox-continued/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![homebridge](https://img.shields.io/badge/homebridge-%5E1.8.0%20%7C%7C%20%5E2.0.0-blueviolet)](https://homebridge.io)

</span>

---

## Description

`homebridge-freebox-continued` is a community-maintained Homebridge plugin that exposes **Freebox Home** devices (from Free, the French ISP) to Apple HomeKit via the [Freebox Home API](https://dev.freebox.fr/sdk/os/home/).

It is a continuation of the original (now unmaintained) [`homebridge-freebox-home`](https://github.com/fbx/homebridge-freebox-home).

### Supported devices

| Device type | HomeKit Service | Status |
|---|---|---|
| Freebox alarm system | `SecuritySystem` | ✅ Working |
| Motion sensors (PIR) | `MotionSensor` | ✅ Working |
| Door/window contact sensors | `ContactSensor` | ✅ Working |
| Window shutters / blinds | `WindowCovering` | ✅ Working |
| IP Cameras (RTSP) | `CameraRTPStreamManagement` | ✅ Working |

---

## Requirements

- **Homebridge** v1.8.0 or v2.0.0+
- **Node.js** v22 or v24
- A **Freebox** router with **Freebox Home** features (Freebox Delta, Freebox Ultra, etc.)
- `ffmpeg` installed on the host (for camera streaming) — [`ffmpeg-for-homebridge`](https://www.npmjs.com/package/ffmpeg-for-homebridge) is bundled

---

## Installation

### Via Homebridge UI (recommended)

Search for `homebridge-freebox-continued` in the Homebridge UI plugin store and click **Install**.

### Via CLI

```bash
npm install -g homebridge-freebox-continued
```

---

## Configuration

Add the platform to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "FreeboxHome",
      "name": "FreeboxHome",
      "freeBoxAddress": "mafreebox.freebox.fr",
      "apiVersion": "v8",
      "useHTTPS": true,
      "shuttersRefreshRateMilliSeconds": 20000,
      "alarmRefreshRateMilliSeconds": 30000
    }
  ]
}
```

### Configuration parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `platform` | `string` | `FreeboxHome` | **Required.** Must be `FreeboxHome`. |
| `name` | `string` | `FreeboxHome` | Display name in Homebridge logs. |
| `freeBoxAddress` | `string` | `mafreebox.freebox.fr` | Hostname or IP address of your Freebox. |
| `apiVersion` | `string` | `v8` | Freebox API version to use (e.g. `v8`, `v12`). |
| `useHTTPS` | `boolean` | `true` | Use HTTPS with the Freebox's domain name for API calls. Recommended. |
| `shuttersRefreshRateMilliSeconds` | `number` | `20000` | Poll interval for shutter positions (ms). |
| `alarmRefreshRateMilliSeconds` | `number` | `30000` | Poll interval for alarm state (ms). |

---

## First-time authorization

On first launch, the plugin will request authorization from the Freebox. You must **physically press the arrow button on the front of your Freebox** within 30 seconds to grant access.

The resulting app token is saved to `freebox-auth.json` in your Homebridge storage directory and reused on subsequent launches. You only need to authorize once.

---

## HTTPS / TLS

When `useHTTPS` is `true`, the plugin uses the official **Freebox ECC Root CA** certificate (bundled as `FBXCerts.crt`) to verify TLS connections to the Freebox API. This is the same public CA certificate distributed by Free.

If you encounter TLS errors, ensure that:
- Your Freebox firmware is up to date.
- The `freeBoxAddress` field matches the hostname in the Freebox TLS certificate (usually the auto-generated `*.fbxos.fr` domain, resolved automatically).

---

## Camera streaming

Camera support relies on **RTSP streams** from Freebox-connected cameras. The plugin uses `ffmpeg` to transcode streams for HomeKit.

> [!NOTE]
> Camera RTSP activation is performed automatically at startup. If a camera is inactive or unreachable, it will still appear in HomeKit but may not stream.

---

## Architecture overview

```
FreeboxPlatform (DynamicPlatformPlugin)
├── FreeboxController       — API version discovery
├── FreeboxSession          — OAuth-like app token + session management
├── FreeboxRequest          — Authenticated HTTP request dispatcher
│   └── Network             — node-fetch wrapper (HTTP/HTTPS)
├── Controllers
│   ├── AlarmController     — Alarm state & commands
│   ├── SensorsController   — Motion & contact sensor state
│   ├── ShuttersController  — Shutter position control
│   └── CameraController    — RTSP stream & camera state
└── Platform Accessories
    ├── FBXAlarm            — SecuritySystem service
    ├── FBXSecuritySensors  — MotionSensor / ContactSensor service
    ├── FBXShutters         — WindowCovering service
    └── FBXCamera           — Camera RTP streaming
```

---

## Development

### Prerequisites

```bash
node -v   # v22 or v24
npm -v    # v10+
```

### Setup

```bash
git clone https://github.com/LoneWanderer-GH/homebridge-freebox-continued.git
cd homebridge-freebox-continued
npm install
```

### Build

```bash
npm run build
```

### Link to local Homebridge for testing

```bash
npm link
homebridge -D
```

### Watch mode (auto-rebuild + restart Homebridge)

First, create a test config at `test/hbConfig/config.json`:

```json
{
  "bridge": {
    "name": "Homebridge Dev",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51826,
    "pin": "031-45-154"
  },
  "platforms": [
    {
      "platform": "FreeboxHome",
      "name": "FreeboxHome",
      "freeBoxAddress": "mafreebox.freebox.fr",
      "apiVersion": "v8",
      "useHTTPS": true,
      "shuttersRefreshRateMilliSeconds": 20000,
      "alarmRefreshRateMilliSeconds": 30000
    }
  ]
}
```

Then run:

```bash
npm run watch
```

### Lint

```bash
npm run lint        # check only
npm run lintLocal   # check + auto-fix
```

---

## Publishing to npm

1. Set `"private": false` in `package.json`.
2. Bump the version: `npm version patch|minor|major`.
3. Run `npm run prepublishOnly` (lints + builds).
4. Publish: `npm publish`.

The plugin must be [verified by the Homebridge team](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) to appear in the Homebridge UI plugin store.

---

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/LoneWanderer-GH/homebridge-freebox-continued/issues).

Please:
- Follow the existing TypeScript code style (ESLint enforced).
- Target the latest stable Node.js LTS version.
- Test on real hardware if possible before submitting a camera or sensor fix.

---

## Credits

- Original plugin: [`homebridge-freebox-home`](https://github.com/fbx/homebridge-freebox-home) by the Freebox team.
- Built with the [Homebridge Plugin Template](https://github.com/homebridge/homebridge-plugin-template).

---

## License

[MIT](LICENSE)
