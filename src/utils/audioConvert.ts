/**
 * Audio conversion helpers shared by the LOCAL (in-house) STT + TTS providers.
 *
 * Twilio Media Streams always use μ-law (G.711), 8000 Hz, mono.
 * The in-house voice server (Piper TTS / faster-whisper STT):
 * - TTS returns 16-bit PCM WAV (typically 22050 Hz from Piper)
 * - STT accepts any WAV upload
 *
 * So we need:
 * - wavToMulaw8k:     WAV (any PCM16 rate/channels) → μ-law 8 kHz mono (for Twilio playback)
 * - mulawBufferToWav: μ-law 8 kHz mono → PCM16 WAV (for STT uploads)
 * - chunkMulaw:       split μ-law audio into 160-byte (20 ms) Twilio frames
 *
 * Pure JS/TS, no ffmpeg or native dependencies.
 */

const MULAW_BIAS = 0x84; // 132
const MULAW_CLIP = 32635;

/**
 * Encode a single 16-bit linear PCM sample to 8-bit μ-law (G.711).
 */
function linearToMulawSample(sample: number): number {
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > MULAW_CLIP) sample = MULAW_CLIP;

  sample += MULAW_BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) {
    exponent--;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/**
 * Decode a single 8-bit μ-law (G.711) byte to a 16-bit linear PCM sample.
 */
function mulawToLinearSample(mulawByte: number): number {
  const inverted = ~mulawByte & 0xff;
  const sign = inverted & 0x80;
  const exponent = (inverted >> 4) & 0x07;
  const mantissa = inverted & 0x0f;

  let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
  sample -= MULAW_BIAS;

  return sign !== 0 ? -sample : sample;
}

/**
 * Decode a μ-law buffer into an Int16Array of linear PCM samples.
 */
export function mulawToPcm16(mulaw: Buffer): Int16Array {
  const samples = new Int16Array(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) {
    samples[i] = mulawToLinearSample(mulaw[i]);
  }
  return samples;
}

/**
 * Encode linear PCM16 samples into a μ-law buffer.
 */
export function pcm16ToMulaw(samples: Int16Array): Buffer {
  const out = Buffer.allocUnsafe(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = linearToMulawSample(samples[i]);
  }
  return out;
}

interface ParsedWav {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Int16Array; // mono PCM16 (downmixed if source was multi-channel)
}

/**
 * Parse a PCM WAV buffer (RIFF), returning mono PCM16 samples.
 * Walks RIFF chunks to find "fmt " and "data" (Piper writes canonical
 * 44-byte-header WAVs, but we don't rely on the exact layout).
 */
export function parseWav(wav: Buffer): ParsedWav {
  if (wav.length < 12 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Invalid WAV: missing RIFF/WAVE header');
  }

  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString('ascii', offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      audioFormat = wav.readUInt16LE(offset + 8);
      channels = wav.readUInt16LE(offset + 10);
      sampleRate = wav.readUInt32LE(offset + 12);
      bitsPerSample = wav.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, wav.length - dataOffset);
    }

    // Chunks are word-aligned (pad byte if odd size).
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0) throw new Error('Invalid WAV: no data chunk found');
  if (audioFormat !== 1) throw new Error(`Unsupported WAV format ${audioFormat} (only PCM is supported)`);
  if (bitsPerSample !== 16) throw new Error(`Unsupported WAV bit depth ${bitsPerSample} (only 16-bit is supported)`);
  if (channels < 1) throw new Error('Invalid WAV: zero channels');

  const frameCount = Math.floor(dataLength / (2 * channels));
  const samples = new Int16Array(frameCount);

  if (channels === 1) {
    for (let i = 0; i < frameCount; i++) {
      samples[i] = wav.readInt16LE(dataOffset + i * 2);
    }
  } else {
    // Downmix to mono by averaging channels.
    for (let i = 0; i < frameCount; i++) {
      let acc = 0;
      for (let c = 0; c < channels; c++) {
        acc += wav.readInt16LE(dataOffset + (i * channels + c) * 2);
      }
      samples[i] = Math.round(acc / channels);
    }
  }

  return { sampleRate, channels, bitsPerSample, samples };
}

/**
 * Linear-interpolation resampler. Good enough for 22050/16000 → 8000 Hz
 * narrowband telephony audio without pulling in ffmpeg.
 */
export function resamplePcm16(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate || samples.length === 0) return samples;

  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Int16Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const s0 = samples[idx];
    const s1 = idx + 1 < samples.length ? samples[idx + 1] : s0;
    out[i] = Math.round(s0 + (s1 - s0) * frac);
  }

  return out;
}

/**
 * Convert a PCM16 WAV buffer (any sample rate, mono or multi-channel)
 * into raw μ-law 8 kHz mono bytes ready for Twilio media events.
 */
export function wavToMulaw8k(wav: Buffer): Buffer {
  const parsed = parseWav(wav);
  const resampled = resamplePcm16(parsed.samples, parsed.sampleRate, 8000);
  return pcm16ToMulaw(resampled);
}

/**
 * Wrap raw μ-law audio (Twilio inbound frames) into a PCM16 WAV buffer,
 * suitable for multipart upload to the in-house /stt endpoint.
 */
export function mulawBufferToWav(mulaw: Buffer, sampleRate: number = 8000): Buffer {
  const samples = mulawToPcm16(mulaw);
  const dataSize = samples.length * 2;
  const wav = Buffer.allocUnsafe(44 + dataSize);

  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16); // fmt chunk size
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28); // byte rate
  wav.writeUInt16LE(2, 32); // block align
  wav.writeUInt16LE(16, 34); // bits per sample
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    wav.writeInt16LE(samples[i], 44 + i * 2);
  }

  return wav;
}

/**
 * Split μ-law audio into fixed-size chunks (default 160 bytes = 20 ms @ 8 kHz).
 */
export function chunkMulaw(mulaw: Buffer, chunkSize: number = 160): Buffer[] {
  const chunks: Buffer[] = [];
  for (let off = 0; off < mulaw.length; off += chunkSize) {
    chunks.push(mulaw.subarray(off, Math.min(off + chunkSize, mulaw.length)));
  }
  return chunks;
}

/**
 * Average absolute amplitude of a μ-law chunk (0..32767).
 * Used for cheap energy-based speech detection in the buffered STT adapter.
 */
export function mulawChunkEnergy(mulaw: Buffer): number {
  if (mulaw.length === 0) return 0;
  let acc = 0;
  for (let i = 0; i < mulaw.length; i++) {
    acc += Math.abs(mulawToLinearSample(mulaw[i]));
  }
  return acc / mulaw.length;
}
