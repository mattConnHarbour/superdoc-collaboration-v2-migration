export interface StatusEntry {
  id: number;
  message: string;
  time: string;
}

class StatusMessagingController {
  private entries: StatusEntry[] = [];
  private listeners = new Set<() => void>();
  private nextId = 1;

  // Adds a timestamped message and notifies the status panel.
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

  // Removes all messages when the user navigates to another room.
  clear = () => {
    this.entries = [];
    this.notify();
  };

  // Registers a listener that is notified whenever the message list changes.
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // Returns the current immutable message list for React subscriptions.
  getSnapshot = () => this.entries;

  // Notifies every active subscriber that the message list changed.
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const statusMessages = new StatusMessagingController();
