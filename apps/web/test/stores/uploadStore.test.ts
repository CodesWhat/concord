import assert from "node:assert/strict";
import test from "node:test";

import { useUploadStore } from "../../src/stores/uploadStore.ts";

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
  private listeners = new Map<string, () => void>();

  constructor() {
    MockXHR.instances.push(this);
  }

  open(): void {}

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  send(): void {}

  emit(type: "load" | "error"): void {
    this.listeners.get(type)?.();
  }
}

function resetUploadState() {
  useUploadStore.setState({
    pendingFiles: [],
    uploadProgress: {},
    isUploading: false,
  });
}

test("addFiles/removeFile/clearFiles manage previews", () => {
  resetUploadState();
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const revoked: string[] = [];

  (URL as { createObjectURL: typeof URL.createObjectURL }).createObjectURL = ((file: File) =>
    `blob:${file.name}`) as typeof URL.createObjectURL;
  (URL as { revokeObjectURL: typeof URL.revokeObjectURL }).revokeObjectURL = ((url: string) => {
    revoked.push(url);
  }) as typeof URL.revokeObjectURL;

  try {
    const image = new File(["img"], "image.png", { type: "image/png" });
    const text = new File(["txt"], "notes.txt", { type: "text/plain" });
    useUploadStore.getState().addFiles([image, text]);

    const [first, second] = useUploadStore.getState().pendingFiles;
    assert.equal(first?.preview, "blob:image.png");
    assert.equal(second?.preview, undefined);

    if (first) useUploadStore.getState().removeFile(first.id);
    assert.deepEqual(revoked, ["blob:image.png"]);

    useUploadStore.getState().clearFiles();
    assert.deepEqual(useUploadStore.getState().pendingFiles, []);
    assert.deepEqual(useUploadStore.getState().uploadProgress, {});
  } finally {
    (URL as { createObjectURL: typeof URL.createObjectURL }).createObjectURL =
      originalCreateObjectURL;
    (URL as { revokeObjectURL: typeof URL.revokeObjectURL }).revokeObjectURL =
      originalRevokeObjectURL;
  }
});

test("uploadFiles returns early when there are no pending files", async () => {
  resetUploadState();
  const result = await useUploadStore.getState().uploadFiles("c1");
  assert.deepEqual(result, []);
});

test("uploadFiles uploads files, tracks progress, and clears state", async () => {
  resetUploadState();
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalXHR = globalThis.XMLHttpRequest;
  const revoked: string[] = [];

  (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
    MockXHR as unknown as typeof XMLHttpRequest;
  MockXHR.instances = [];

  (URL as { createObjectURL: typeof URL.createObjectURL }).createObjectURL = ((file: File) =>
    `blob:${file.name}`) as typeof URL.createObjectURL;
  (URL as { revokeObjectURL: typeof URL.revokeObjectURL }).revokeObjectURL = ((url: string) => {
    revoked.push(url);
  }) as typeof URL.revokeObjectURL;

  try {
    const image = new File(["img"], "image.png", { type: "image/png" });
    const text = new File(["txt"], "notes.txt", { type: "text/plain" });
    useUploadStore.getState().addFiles([image, text]);

    const promise = useUploadStore.getState().uploadFiles("c1");
    assert.equal(useUploadStore.getState().isUploading, true);

    const xhr = MockXHR.instances[0]!;
    xhr.upload.emitProgress({ lengthComputable: true, loaded: 3, total: 4 });
    assert.equal(Object.keys(useUploadStore.getState().uploadProgress).length, 2);

    xhr.status = 200;
    xhr.responseText = JSON.stringify([
      { id: "a1", filename: "image.png", contentType: "image/png", size: 3, url: "/a1" },
    ]);
    xhr.emit("load");

    const attachments = await promise;
    assert.equal(attachments.length, 1);
    assert.equal(useUploadStore.getState().isUploading, false);
    assert.deepEqual(useUploadStore.getState().pendingFiles, []);
    assert.deepEqual(useUploadStore.getState().uploadProgress, {});
    assert.deepEqual(revoked, ["blob:image.png"]);
  } finally {
    (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      originalXHR;
    (URL as { createObjectURL: typeof URL.createObjectURL }).createObjectURL =
      originalCreateObjectURL;
    (URL as { revokeObjectURL: typeof URL.revokeObjectURL }).revokeObjectURL =
      originalRevokeObjectURL;
  }
});

test("uploadFiles clears isUploading and rethrows on upload failure", async () => {
  resetUploadState();
  const originalCreateObjectURL = URL.createObjectURL;
  const originalXHR = globalThis.XMLHttpRequest;

  (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
    MockXHR as unknown as typeof XMLHttpRequest;
  MockXHR.instances = [];

  (URL as { createObjectURL: typeof URL.createObjectURL }).createObjectURL = ((file: File) =>
    `blob:${file.name}`) as typeof URL.createObjectURL;

  try {
    const image = new File(["img"], "image.png", { type: "image/png" });
    useUploadStore.getState().addFiles([image]);

    const promise = useUploadStore.getState().uploadFiles("c1");
    MockXHR.instances[0]?.emit("error");

    await assert.rejects(promise);
    assert.equal(useUploadStore.getState().isUploading, false);
    assert.equal(useUploadStore.getState().pendingFiles.length, 1);
  } finally {
    (globalThis as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      originalXHR;
    (URL as { createObjectURL: typeof URL.createObjectURL }).createObjectURL =
      originalCreateObjectURL;
  }
});
