export interface SseFrame {
  event?: string;
  data?: string;
}

/** Decode text/event-stream frames from a fetch body into `T`. */
export class SseReader<T> {
  readonly #decode: (frame: SseFrame) => T | undefined;

  constructor(decode: (frame: SseFrame) => T | undefined) {
    this.#decode = decode;
  }

  parse(buffer: string): { rest: string; frames: SseFrame[] } {
    const parts = buffer.split("\n\n");
    const rest = parts.pop() ?? "";
    const sseFrames = parts.map((part) => {
      const eventLine = part.split("\n").find((line) => line.startsWith("event:"));
      const dataLine = part.split("\n").find((line) => line.startsWith("data:"));

      return {
        event: eventLine?.slice("event:".length).trim(),
        data: dataLine?.slice("data:".length).trim(),
      };
    });

    return { rest, frames: sseFrames };
  }

  async read(body: ReadableStream<Uint8Array>, onEvent: (event: T) => void, signal?: AbortSignal): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    const consume = async (buffer: string): Promise<void> => {
      if (signal?.aborted) {
        return;
      }

      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      const parsed = this.parse(buffer + decoder.decode(value, { stream: true }));
      parsed.frames.forEach((frame) => {
        if (signal?.aborted) {
          return;
        }

        const event = this.#decode(frame);

        if (event !== undefined) {
          onEvent(event);
        }
      });
      await consume(parsed.rest);
    };

    await consume("");
  }
}
