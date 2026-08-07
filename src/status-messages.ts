export interface StatusEntry {
  id: number;
  message: string;
  time: string;
}

class StatusMessagingController {
  private entries: StatusEntry[] = [];
  private listeners = new Set<() => void>();
  private nextId = 1;

  message = (message: string) => {
    if (this.entries.at(-1)?.message === message) return;
    this.entries = [...this.entries, {
      id: this.nextId++,
      message,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }].slice(-50);
    this.notify();
  };

  clear = () => {
    this.entries = [];
    this.notify();
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.entries;

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const statusMessages = new StatusMessagingController();
