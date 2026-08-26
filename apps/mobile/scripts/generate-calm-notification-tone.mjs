import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// NotesChain's sound is intentionally short and unobtrusive: a low G–D–G
// chime with a soft, bell-like overtone. Keeping this generator beside the
// checked-in WAV makes the sound reproducible instead of leaving an opaque
// binary asset that nobody can safely adjust later.
const sampleRate = 48_000;
const durationSeconds = 1.85;
const samples = Math.floor(sampleRate * durationSeconds);
const notes = [
  { frequency: 196.0, start: 0.0, duration: 1.15, amplitude: 0.24 },
  { frequency: 293.66, start: 0.28, duration: 1.05, amplitude: 0.2 },
  { frequency: 392.0, start: 0.61, duration: 0.96, amplitude: 0.17 },
];

const data = Buffer.alloc(samples * 2);
for (let index = 0; index < samples; index += 1) {
  const time = index / sampleRate;
  let value = 0;

  for (const note of notes) {
    const elapsed = time - note.start;
    if (elapsed < 0 || elapsed > note.duration) continue;

    const attack = Math.min(elapsed / 0.035, 1);
    const release = Math.max((note.duration - elapsed) / 0.24, 0);
    const envelope = attack * Math.min(release, 1) * Math.exp(-elapsed * 1.25);
    const fundamental = Math.sin(2 * Math.PI * note.frequency * elapsed);
    const overtone = 0.14 * Math.sin(2 * Math.PI * note.frequency * 2 * elapsed);
    value += note.amplitude * envelope * (fundamental + overtone);
  }

  const pcm = Math.round(Math.max(-1, Math.min(1, value)) * 32_767);
  data.writeInt16LE(pcm, index * 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, "..", "assets", "sounds", "noteschain_calm_signal.wav");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, Buffer.concat([header, data]));
