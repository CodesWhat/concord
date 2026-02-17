// Snowflake ID generator
// 64-bit: timestamp (42 bits) + worker ID (10 bits) + sequence (12 bits)
// Custom epoch: 2026-01-01T00:00:00.000Z

const EPOCH = 1735689600000n;
const WORKER_ID = BigInt(process.env["WORKER_ID"] ?? "1");
const WORKER_SHIFT = 12n;
const TIMESTAMP_SHIFT = 22n;
const SEQUENCE_MASK = 0xFFFn;

let lastTimestamp = 0n;
let sequence = 0n;

export function generateSnowflake(): string {
  let now = BigInt(Date.now()) - EPOCH;

  if (now === lastTimestamp) {
    sequence = (sequence + 1n) & SEQUENCE_MASK;
    if (sequence === 0n) {
      // Wait for next millisecond
      while (now <= lastTimestamp) {
        now = BigInt(Date.now()) - EPOCH;
      }
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = now;

  const id = (now << TIMESTAMP_SHIFT) | (WORKER_ID << WORKER_SHIFT) | sequence;
  return id.toString();
}
