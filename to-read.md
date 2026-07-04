# Voice AI API Server (TTS + STT)

A production-ready, CPU-only **Voice AI** API built with **FastAPI**, combining:

- **Text-to-Speech** via **[Piper TTS](https://github.com/OHF-Voice/piper1-gpl)** —
  streams synthesized speech as raw WAV, multiple voices preloaded in memory and
  switchable per request.
- **Speech-to-Text** via **[faster-whisper](https://github.com/SYSTRAN/faster-whisper)** —
  upload audio (wav/mp3/webm/m4a), get back transcribed text.

Everything runs **offline on CPU**, models are **cached in memory** (no
per-request reloading), and **nothing is stored on disk** — TTS renders WAV in
memory and streams it; STT decodes the upload from an in-memory buffer.

> 📘 **Integrating from another codebase or agent?** See **[API.md](API.md)** for
> the full GET/POST/STT reference with every parameter, response header, and error code.

```
POST /tts   {"text": "hello world", "voice": "male1"}   ->  streamed WAV
GET  /tts?text=hello world&voice=male1                  ->  streamed WAV
POST /stt   form-data: file=@audio.wav                  ->  {"text": "hello world"}
```

## Folder structure

```
tts-server/
├── main.py                 # FastAPI app: routes, CORS, startup wiring
├── voices.py               # TTS voice registry (load / resolve / synthesize)
├── stt.py                  # faster-whisper STT engine
├── requirements.txt        # Python dependencies
├── .env.example            # Copy to .env to override defaults
├── .gitignore
├── tts-server.service      # systemd unit for production
├── README.md · API.md      # setup/ops · API contract
├── models/                 # Preloaded at startup
│   ├── en_US-lessac-medium.onnx(.json)   # male1
│   ├── en_US-ryan-medium.onnx(.json)     # male2
│   ├── en_US-amy-medium.onnx(.json)      # female1
│   ├── en_US-kathleen-low.onnx(.json)    # female2
│   └── whisper/            # cached faster-whisper model (STT)
└── .venv/                  # Python virtual environment
```

## 1. System setup (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip ffmpeg curl git
mkdir -p ~/tts-server && cd ~/tts-server
```

## 2. Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 3. Download models

### TTS voices

Models live in `models/`. **Every `.onnx` file there is loaded at startup**, so
download as many voices as you want. The four that back the default aliases:

```bash
python3 -m piper.download_voices en_US-lessac-medium --data-dir models  # male1
python3 -m piper.download_voices en_US-ryan-medium   --data-dir models  # male2
python3 -m piper.download_voices en_US-amy-medium    --data-dir models  # female1
python3 -m piper.download_voices en_US-kathleen-low  --data-dir models  # female2
```

Any Piper voice works — run `python3 -m piper.download_voices` (no args) to list
them. `PIPER_VOICE` in `.env` sets the *default* voice; callers can override it
per request via the `voice` field.

### STT model (faster-whisper)

The Whisper model downloads automatically on first startup into
`models/whisper/` (default size `base`, ~140 MB). Pre-fetch it if you like:

```bash
python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8', download_root='models/whisper')"
```

Change the size with `WHISPER_MODEL` in `.env` (`tiny`/`base`/`small`/`medium`;
larger = more accurate but slower on CPU).

## 4. Configuration

All configuration is via environment variables (see `.env.example`). Nothing is
hardcoded and there are no secrets in the code.

```bash
cp .env.example .env   # optional — defaults work out of the box
```

## 5. Run the server

Development / quick start:

```bash
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

Background with `nohup`:

```bash
nohup .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > tts.log 2>&1 &
```

Production with **systemd**:

```bash
sudo cp tts-server.service /etc/systemd/system/tts-server.service
# edit User=/WorkingDirectory= inside the unit if needed
sudo systemctl daemon-reload
sudo systemctl enable --now tts-server
sudo systemctl status tts-server
```

> Keep `--workers 1`. Each worker loads its own copy of the model into RAM, and
> a single worker already serves concurrent requests (synthesis runs in a thread
> pool). Scale out with more workers only if you have the RAM and CPU headroom.

## 6. Test the API

```bash
# --- TTS: POST with a JSON body (pick a voice dynamically) ---
curl -s -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello this is a voice test", "voice": "male1"}' \
  -o out.wav
file out.wav          # -> RIFF (little-endian) WAV audio ...

# --- TTS: GET convenience form ---
curl -s "http://localhost:8000/tts?text=hello%20world&voice=female1" -o out2.wav

# --- STT: upload audio, get text back ---
curl -s -X POST http://localhost:8000/stt -F "file=@out.wav"
# -> {"text":"Hello this is a voice test.","language":"en",...}

# List loaded voices / health
curl -s http://localhost:8000/voices
curl -s http://localhost:8000/health
```

The `voice` field accepts an **alias** (`male1`), an **exact name**
(`en_US-lessac-medium`), or an **unambiguous prefix** (`en_US-lessac`). Omit it
to use the server default. The TTS response is raw `audio/wav` (no JSON wrapper);
the chosen voice is echoed in the `X-Voice` header. STT accepts any
ffmpeg-decodable format (wav/mp3/webm/m4a/…) and returns JSON.

Play TTS output back (needs an audio device / ffmpeg):

```bash
ffplay -autoexit out.wav        # or: aplay out.wav
```

Interactive docs are at `http://localhost:8000/docs`.

## Endpoints

| Method | Path      | Description                                             |
|--------|-----------|---------------------------------------------------------|
| POST   | `/tts`    | JSON `{text, voice?}` → streamed `audio/wav`            |
| GET    | `/tts`    | `?text=...&voice=...` → streamed `audio/wav`            |
| POST   | `/stt`    | multipart `file=<audio>` → `{"text", "language", ...}`  |
| GET    | `/voices` | List loaded voices, default, and aliases                |
| GET    | `/health` | Liveness/readiness (`200` when TTS + STT ready)         |

Full parameter/response/error reference: **[API.md](API.md)**.

### Voice aliases

Callers may use friendly names instead of full model names:

| Alias     | Voice                  |
|-----------|------------------------|
| `male1`   | `en_US-lessac-medium`  |
| `male2`   | `en_US-ryan-medium`    |
| `female1` | `en_US-amy-medium`     |
| `female2` | `en_US-kathleen-low`   |

Aliases are configurable via `VOICE_ALIASES` in `.env`; `GET /voices` lists the
active set.

> **Note on `male2`:** the project spec listed `en_GB-ryan`, which Piper does not
> publish — the closest available voice, `en_US-ryan-medium`, is used instead.
> Swap it in `.env` (`VOICE_ALIASES`) if you prefer a British voice such as
> `en_GB-alan-medium`.

## External / public access

The server binds to `0.0.0.0:8000`, so it is reachable at
`http://SERVER_IP:8000` from browsers, frontends, mobile apps, and other
backends. **CORS is wide open by default** (`Access-Control-Allow-Origin: *`)
so browser apps can call it directly.

**To reach it from outside the host, port 8000 must be open at every layer:**

1. **OS firewall (ufw).** Rules for SSH + 8000 are pre-staged. If you enable ufw,
   do it in this order so you don't lock yourself out of SSH:
   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 8000/tcp
   sudo ufw enable
   ```
   (ufw is currently **inactive**, so 8000 is already reachable.)
2. **Cloud firewall.** On DigitalOcean, open TCP 8000 in your droplet's Cloud
   Firewall (Networking → Firewalls) — this is separate from ufw and not
   controllable from inside the box.

Verify from your laptop:
```bash
curl "http://SERVER_IP:8000/tts?text=hello&voice=male1" -o out.wav
```

### Client examples

**Browser / React / Next.js (fetch):**
```js
const res = await fetch("http://SERVER_IP:8000/tts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "hello world", voice: "male1" }),
});
const blob = await res.blob();
new Audio(URL.createObjectURL(blob)).play();
```

**Node.js backend:**
```js
const res = await fetch("http://SERVER_IP:8000/tts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "hello world", voice: "female1" }),
});
const buf = Buffer.from(await res.arrayBuffer());
require("fs").writeFileSync("out.wav", buf);
```

**Python:**
```python
import requests
# TTS
r = requests.post("http://SERVER_IP:8000/tts",
                  json={"text": "hello world", "voice": "male1"})
open("out.wav", "wb").write(r.content)
# STT
with open("out.wav", "rb") as f:
    r = requests.post("http://SERVER_IP:8000/stt", files={"file": f})
print(r.json()["text"])
```

**STT from the browser (record + transcribe):**
```js
// `blob` is audio captured via MediaRecorder (webm) or a File input
const fd = new FormData();
fd.append("file", blob, "audio.webm");
const res = await fetch("http://SERVER_IP:8000/stt", { method: "POST", body: fd });
const { text } = await res.json();
```

> **Security:** this configuration is intentionally open (no auth, `*` CORS) for
> development. Before exposing it long-term, put it behind a reverse proxy
> (nginx/Caddy) with TLS, restrict `CORS_ALLOW_ORIGINS`, and add auth/rate limits.

## Design notes

- **Everything cached in memory:** every `.onnx` voice and the Whisper model load
  once at startup and are reused across requests — no per-request cold start, no
  model reloading.
- **Dynamic voice switching:** each request selects a preloaded voice by alias,
  name, or prefix; switching voices costs nothing at request time.
- **No permanent storage:** TTS synthesizes into an in-memory buffer and streams
  raw `audio/wav`; STT decodes the upload from an in-memory buffer — nothing
  touches disk.
- **Concurrency-safe:** CPU-bound work runs in a thread pool; per-engine locks
  serialize the calls because Piper's espeak-ng and CTranslate2 (Whisper) are not
  reentrant.
- **CPU-only / offline:** onnxruntime + CTranslate2 CPU backends, no GPU and no
  network needed once models are downloaded.
- **Modular:** `voices.py` (TTS registry) and `stt.py` (Whisper engine) are
  independent of `main.py`'s HTTP layer.

## Common errors + fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `RuntimeError: No .onnx voice models found` on startup | `models/` empty / wrong `MODELS_DIR` | Run the download step (§3) or fix `MODELS_DIR` in `.env` |
| `Form data requires "python-multipart"` on startup | Dep missing | `pip install -r requirements.txt` (includes `python-multipart`) |
| `404 unknown voice` | Requested voice not in `models/` | `GET /voices` to see loaded names; download it or use a valid name |
| `400 ambiguous voice` | Prefix matches >1 voice | Use the full voice name |
| `422 could not decode/transcribe audio` (STT) | Corrupt/unsupported upload | Send a valid wav/mp3/webm/m4a; ensure `ffmpeg` is installed |
| `503 ... still loading` | Request hit during startup | Wait a moment and retry; check `/health` |
| First STT/startup is slow | Whisper model downloading | One-time download to `models/whisper/`; pre-fetch (§3) |
| `ModuleNotFoundError: piper` | venv not activated / deps missing | `source .venv/bin/activate && pip install -r requirements.txt` |
| `espeak-ng` / phonemize errors | Missing system audio libs | `sudo apt-get install -y espeak-ng ffmpeg` |
| `Address already in use` | Port 8000 taken | Use `--port 8001` or free it: `fuser -k 8000/tcp` |
| Garbled / empty WAV | Corrupt or half-downloaded model | Re-download the `.onnx` + `.onnx.json` pair |
