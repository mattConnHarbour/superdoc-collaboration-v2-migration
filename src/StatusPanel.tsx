import { useSyncExternalStore } from 'react';
import { statusMessages } from './status-messages';

// Maps each status message to the dot color shown in the activity panel.
function entryKind(message: string) {
  if (message.startsWith('Click ')) return 'prompt';
  if (/migration|frozen|DOCX|seeded|activating/.test(message)) return 'migration';
  return message.startsWith('V2') ? 'v2' : 'v1';
}

// Renders migration activity from the central messaging controller.
export function StatusPanel() {
  const entries = useSyncExternalStore(statusMessages.subscribe, statusMessages.getSnapshot);
  return (
    <details className="status-panel" open>
      <summary>Migration activity</summary>
      <div className="status-key">
        <span><i className="status-dot" />V1 room operation</span>
        <span><i className="status-dot v2" />V2 room operation</span>
        <span><i className="status-dot migration" />Migration operation</span>
        <span><i className="status-dot prompt" />Info</span>
      </div>
      <div className="status-log">
        {entries.length === 0 && <p className="status-empty">Waiting for activity…</p>}
        {[...entries].reverse().map((entry) => (
          <div className="status-entry" key={entry.id}>
            <span className={`status-dot ${entryKind(entry.message)}`} />
            <div>
              <div>{entry.message}</div>
              <time>{entry.time}</time>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
