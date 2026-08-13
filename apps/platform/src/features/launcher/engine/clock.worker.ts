/// <reference lib="webworker" />

// Clock worker — timer independen dari main thread agar playback tidak
// tersendat saat tab tidak fokus (NFR-03). Main thread mendengarkan 'tick'.
const TICK_MS = 25;

self.onmessage = (event: MessageEvent) => {
  const message = event.data as { type: string };
  if (message.type === 'start') {
    self.setInterval(() => {
      self.postMessage({ type: 'tick' });
    }, TICK_MS);
  }
};

export {};
