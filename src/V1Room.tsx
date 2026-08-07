import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { SuperDoc } from 'superdoc-v1';
import { BLANK_DOCX_BASE64 } from 'superdoc-v1/super-editor';
import * as Y from 'yjs';
import { COLLAB_URL } from './config';
import { statusMessages } from './status-messages';

// Hosts the editable or archived SuperDoc V1 collaboration room.
export function V1Room({ roomId, readOnly, blank }: {
  roomId: string;
  readOnly: boolean;
  blank?: boolean;
}) {
  const [synced, setSynced] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [seedFile, setSeedFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [actionsRoot, setActionsRoot] = useState<HTMLElement | null>(null);
  const instance = useRef<SuperDoc | null>(null);
  const uploadInput = useRef<HTMLInputElement | null>(null);
  const collaboration = useMemo(() => {
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: roomId,
      document: ydoc,
      connect: false,
      onStateless: ({ payload }) => {
        try {
          const message = JSON.parse(payload) as { type?: string };
          if (message.type === 'room-view-only') {
            instance.current?.setLocked(true);
            instance.current?.setDocumentMode('viewing');
            statusMessages.message('V1 room read-only');
          }
        } catch {
          // Ignore unrelated stateless messages.
        }
      },
    });
    return { ydoc, provider };
  }, [roomId]);

  // Finds the top-bar portal target after the application mounts.
  useEffect(() => {
    setActionsRoot(document.getElementById('document-actions'));
  }, []);

  // Connects the Yjs provider and reports its synchronization state.
  useEffect(() => {
    statusMessages.message('V1 room connecting');
    const onSynced = () => setSynced(true);
    const reportSynced = () => statusMessages.message('V1 room connected');
    collaboration.provider.on('synced', onSynced);
    collaboration.provider.on('synced', reportSynced);
    collaboration.provider.connect();
    return () => {
      collaboration.provider.off('synced', onSynced);
      collaboration.provider.off('synced', reportSynced);
      collaboration.provider.destroy();
      collaboration.ydoc.destroy();
    };
  }, [collaboration]);

  // Loads either the blank template or the demo seed DOCX.
  useEffect(() => {
    if (blank) {
      const bytes = Uint8Array.from(atob(BLANK_DOCX_BASE64), (character) => character.charCodeAt(0));
      setSeedFile(new File([bytes], 'blank.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }));
      return;
    }
    let cancelled = false;
    void fetch('/seed.docx')
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load seed document (${response.status})`);
        return response.blob();
      })
      .then((blob) => {
        if (!cancelled) setSeedFile(new File([blob], 'seed.docx', { type: blob.type }));
      });
    return () => {
      cancelled = true;
    };
  }, [blank]);

  // Creates SuperDoc after both collaboration state and the seed file are ready.
  useEffect(() => {
    if (!synced || !seedFile) return;
    instance.current = new SuperDoc({
      selector: '#v1-superdoc',
      document: seedFile,
      documentMode: readOnly ? 'viewing' : 'editing',
      role: readOnly ? 'viewer' : 'editor',
      isLocked: readOnly,
      comments: { visible: true },
      trackChanges: { visible: true },
      modules: {
        collaboration,
        comments: {},
        trackChanges: { visible: true, mode: 'review', enabled: true },
      },
      user: { name: 'Migration demo user', email: 'demo@superdoc.dev' },
      rulers: true,
      onReady: () => {
        setEditorReady(true);
        if (readOnly) {
          statusMessages.message('V1 room opened read-only');
          statusMessages.message('Click "Go to V2 room"');
        } else {
          statusMessages.message('V1 room editor ready');
        }
      },
    });
    return () => {
      instance.current?.destroy();
      instance.current = null;
    };
  }, [collaboration, readOnly, seedFile, synced]);

  if (!synced || !seedFile) return <div className="centered">Connecting to v1 room…</div>;
  return (
    <>
      <div className="connection-status">
        <span>{replacing ? 'Replacing document…' : editorReady ? 'V1 editor ready' : 'Opening v1 document…'}</span>
      </div>
      {actionsRoot && createPortal(<div className="document-controls">
        {!readOnly && <button onClick={() => uploadInput.current?.click()}>Upload DOCX</button>}
        <button onClick={() => void instance.current?.export({ exportedName: 'v1-room', triggerDownload: true })}>Export DOCX</button>
        <input
          ref={uploadInput}
          hidden
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !instance.current?.activeEditor) return;
            setReplacing(true);
            void instance.current.activeEditor.replaceFile(file).catch(() => setReplacing(false));
            window.setTimeout(() => setReplacing(false), 1_000);
            event.target.value = '';
          }}
        />
      </div>, actionsRoot)}
      <div id="v1-superdoc" className="superdoc-container" />
    </>
  );
}
