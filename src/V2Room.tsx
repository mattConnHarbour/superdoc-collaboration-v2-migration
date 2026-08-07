import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SuperDoc } from 'superdoc';
import { statusMessages } from './status-messages';

const WS_URL = import.meta.env.VITE_COLLAB_URL ?? 'ws://127.0.0.1:1234';

export function V2Room({
  documentId,
  roomId,
  mode,
  onReady,
}: {
  documentId: string;
  roomId: string;
  mode: 'create' | 'join';
  onReady?: () => void;
}) {
  const instance = useRef<SuperDoc | null>(null);
  const uploadInput = useRef<HTMLInputElement | null>(null);
  const onReadyRef = useRef(onReady);
  const [status, setStatus] = useState('Opening migrated v2 room…');
  const [replacing, setReplacing] = useState(false);
  const [actionsRoot, setActionsRoot] = useState<HTMLElement | null>(null);
  onReadyRef.current = onReady;

  useEffect(() => {
    setActionsRoot(document.getElementById('document-actions'));
  }, []);

  useEffect(() => {
    statusMessages.message(mode === 'create' ? 'V2 room DOCX retrieval' : 'V2 room opening');
    statusMessages.message('V2 room connecting');
    instance.current = new SuperDoc({
      selector: '#v2-superdoc',
      documentMode: 'editing',
      document: {
        id: roomId,
        type: 'docx',
        url: `/api/rooms/${documentId}/migration.docx`,
        v2Collaboration: {
          providerType: 'hocuspocus',
          documentId: roomId,
          serverUrl: WS_URL,
          token: 'demo',
          roomMode: mode,
        },
      },
      user: { name: 'Migration demo user', email: 'demo@superdoc.dev' },
      onCollaborationReady: () => {
        setStatus(mode === 'create' ? 'V2 room seeded' : 'Connected to migrated v2 room');
        statusMessages.message(mode === 'create' ? 'V2 room seeded' : 'V2 room joined');
        onReadyRef.current?.();
      },
      onContentError: ({ error }) => {
        setStatus(`Could not open migrated v2 room: ${error instanceof Error ? error.message : String(error)}`);
      },
    });

    return () => {
      instance.current?.destroy();
      instance.current = null;
    };
  }, [documentId, mode, roomId]);

  return (
    <>
      <div className="connection-status">
        <span>{replacing ? 'Replacing document…' : status}</span>
      </div>
      {actionsRoot && createPortal(<div className="document-controls">
        <button onClick={() => uploadInput.current?.click()}>Upload DOCX</button>
        <button onClick={() => void instance.current?.export({ exportedName: 'v2-room', triggerDownload: true })}>Export DOCX</button>
        <input
          ref={uploadInput}
          hidden
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !instance.current) return;
            setReplacing(true);
            try {
              await instance.current.replaceFile(file);
            } finally {
              setReplacing(false);
              event.target.value = '';
            }
          }}
        />
      </div>, actionsRoot)}
      <div id="v2-superdoc" className="superdoc-container" />
    </>
  );
}
