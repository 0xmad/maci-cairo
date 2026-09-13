import { describe, expect, it, vi } from "vitest";

import { SseReader, type SseFrame } from "..";

function asFrame(frame: SseFrame): SseFrame {
  return frame;
}

describe("SseReader", () => {
  it("parses complete frames and keeps an incomplete tail", () => {
    const parsed = new SseReader(asFrame).parse('event: step\ndata: {"seq":1}\n\nevent: completed\ndata: {"ok":true}');

    expect(parsed.frames).toEqual([{ event: "step", data: '{"seq":1}' }]);
    expect(parsed.rest).toBe('event: completed\ndata: {"ok":true}');
  });

  it("uses an empty rest when split yields no parts", () => {
    const split = vi.spyOn(String.prototype, "split").mockReturnValueOnce([]);

    try {
      expect(new SseReader(asFrame).parse("unused")).toEqual({ rest: "", frames: [] });
    } finally {
      split.mockRestore();
    }
  });

  it("reads a stream of decoded events then stops", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(new TextEncoder().encode("event: ping\ndata: 1\n\nevent: ping\ndata: skip\n\n"));
        controller.close();
      },
    });
    const received: number[] = [];

    await new SseReader((frame): number | undefined => {
      if (frame.data === "skip") {
        return undefined;
      }

      return Number(frame.data);
    }).read(stream, (event) => {
      received.push(event);
    });

    expect(received).toEqual([1]);
  });

  it("stops reading when the signal aborts", async () => {
    const abort = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(new TextEncoder().encode('event: step\ndata: {"seq":1}\n\n'));
        controller.enqueue(new TextEncoder().encode("event: completed\ndata: {}\n\n"));
        controller.close();
      },
    });
    const received: SseFrame[] = [];

    await new SseReader(asFrame).read(
      stream,
      (frame) => {
        received.push(frame);
        abort.abort();
      },
      abort.signal,
    );

    expect(received).toEqual([{ event: "step", data: '{"seq":1}' }]);
  });

  it("skips remaining frames in a chunk after abort", async () => {
    const abort = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(new TextEncoder().encode("event: ping\ndata: 1\n\nevent: ping\ndata: 2\n\n"));
        controller.close();
      },
    });
    const received: SseFrame[] = [];

    await new SseReader(asFrame).read(
      stream,
      (frame) => {
        received.push(frame);
        abort.abort();
      },
      abort.signal,
    );

    expect(received).toEqual([{ event: "ping", data: "1" }]);
  });
});
