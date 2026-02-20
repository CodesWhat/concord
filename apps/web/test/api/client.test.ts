import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, api, uploadMultipart } from "../../src/api/client.ts";

type MockResponseInit = {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
  json?: unknown;
  jsonThrows?: boolean;
};

function mockResponse(init: MockResponseInit): Response {
  return {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText,
    json: async () => {
      if (init.jsonThrows) throw new Error("bad json");
      return init.json;
    },
    text: async () => init.text,
  } as unknown as Response;
}

test("api.get returns parsed JSON response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    mockResponse({
      ok: true,
      status: 200,
      statusText: "OK",
      text: JSON.stringify({ value: 42 }),
    })) as typeof fetch;

  try {
    const result = await api.get<{ value: number }>("/ok");
    assert.deepEqual(result, { value: 42 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api.delete returns undefined for empty body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    mockResponse({
      ok: true,
      status: 204,
      statusText: "No Content",
      text: "",
    })) as typeof fetch;

  try {
    const result = await api.delete("/no-content");
    assert.equal(result, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api.post throws ApiError with API error payload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    mockResponse({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: JSON.stringify({ error: { code: "BAD", message: "Invalid" } }),
      json: { error: { code: "BAD", message: "Invalid" } },
    })) as typeof fetch;

  try {
    await assert.rejects(
      api.post("/bad", { a: 1 }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 400 &&
        err.code === "BAD" &&
        err.message === "Invalid",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api.get falls back to UNKNOWN/statusText on non-JSON errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    mockResponse({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: "oops",
      jsonThrows: true,
    })) as typeof fetch;

  try {
    await assert.rejects(
      api.get("/down"),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 503 &&
        err.code === "UNKNOWN" &&
        err.message === "Service Unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

type ProgressListener = (event: {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}) => void;

class MockXHRUpload {
  private listeners = new Map<string, ProgressListener>();

  addEventListener(type: string, listener: ProgressListener) {
    this.listeners.set(type, listener);
  }

  emitProgress(event: { lengthComputable: boolean; loaded: number; total: number }) {
    this.listeners.get("progress")?.(event);
  }
}

class MockXHR {
  static instances: MockXHR[] = [];

  upload = new MockXHRUpload();
  withCredentials = false;
  status = 0;
  responseText = "";
  method = "";
  path = "";
  sentBody: FormData | null = null;
  private listeners = new Map<string, () => void>();

  constructor() {
    MockXHR.instances.push(this);
  }

  open(method: string, path: string): void {
    this.method = method;
    this.path = path;
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  send(body: FormData): void {
    this.sentBody = body;
  }

  emit(type: "load" | "error"): void {
    this.listeners.get(type)?.();
  }
}

test("uploadMultipart resolves on successful upload and reports progress", async () => {
  const originalXHR = globalThis.XMLHttpRequest;
  (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
    MockXHR as unknown as typeof XMLHttpRequest;
  MockXHR.instances = [];

  try {
    const progress: number[] = [];
    const promise = uploadMultipart<{ ok: boolean }>(
      "/upload",
      new FormData(),
      (percent) => progress.push(percent),
    );

    const xhr = MockXHR.instances[0]!;
    xhr.upload.emitProgress({ lengthComputable: true, loaded: 5, total: 10 });
    xhr.status = 201;
    xhr.responseText = JSON.stringify({ ok: true });
    xhr.emit("load");

    const result = await promise;
    assert.deepEqual(result, { ok: true });
    assert.equal(xhr.method, "POST");
    assert.equal(xhr.path, "/upload");
    assert.equal(xhr.withCredentials, true);
    assert.deepEqual(progress, [50]);
  } finally {
    (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      originalXHR;
  }
});

test("uploadMultipart rejects with ApiError on server failure", async () => {
  const originalXHR = globalThis.XMLHttpRequest;
  (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
    MockXHR as unknown as typeof XMLHttpRequest;
  MockXHR.instances = [];

  try {
    const promise = uploadMultipart("/upload", new FormData());
    const xhr = MockXHR.instances[0]!;
    xhr.status = 500;
    xhr.emit("load");

    await assert.rejects(
      promise,
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 500 &&
        err.code === "UPLOAD_FAILED",
    );
  } finally {
    (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      originalXHR;
  }
});

test("uploadMultipart rejects with network error", async () => {
  const originalXHR = globalThis.XMLHttpRequest;
  (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
    MockXHR as unknown as typeof XMLHttpRequest;
  MockXHR.instances = [];

  try {
    const promise = uploadMultipart("/upload", new FormData());
    const xhr = MockXHR.instances[0]!;
    xhr.emit("error");

    await assert.rejects(
      promise,
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 0 &&
        err.code === "NETWORK_ERROR",
    );
  } finally {
    (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      originalXHR;
  }
});
