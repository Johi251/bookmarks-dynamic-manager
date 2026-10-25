import { useEffect, useRef, useState } from 'react';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { parseNetscapeHtml } from '../parser/netscape';
import type { AppState } from '../types';

interface Props {
  api: BookmarksApi;
  onClose: () => void;
}

/**
 * Import: Netscape-Bookmark-HTML (Chrome/Firefox/Brave/Edge-Export) oder
 * JSON-Backup dieser App (modus: zusammenführen oder ersetzen).
 */
export default function ImportDialog({ api, onClose }: Props) {
  const [mode, setMode] = useState<'html' | 'json' | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      if (/\.json$/i.test(file.name) || file.type.includes('json')) {
        const parsed = JSON.parse(text) as AppState;
        if (parsed.version !== 1 || !Array.isArray(parsed.bookmarks)) {
          setResult('❌ Ungültiges JSON — keine App-Datensicherung (Version 1 erwartet).');
        } else {
          const replace = confirm(
            `${parsed.bookmarks.length} Lesezeichen gefunden.\n\nOK = Bestand ERSETZEN\nAbbrechen = zusammenführen`
          );
          api.importState(parsed, replace ? 'replace' : 'merge');
          setResult(`✅ JSON importiert: ${parsed.bookmarks.length} Lesezeichen (${replace ? 'ersetzt' : 'zusammengeführt'}).`);
        }
      } else {
        const parsed = parseNetscapeHtml(text);
        if (parsed.bookmarks.length === 0) {
          setResult('❌ Keine Lesezeichen in der Datei gefunden (Netscape-HTML erwartet).');
        } else {
          // Statistik vorab gegen den aktuellen Bestand berechnen (Reducer läuft gebatcht).
          const existing = new Set(api.state.bookmarks.map((b) => b.url.toLowerCase().replace(/\/$/, '')));
          const fresh = parsed.bookmarks.filter((b) => !existing.has(b.url.toLowerCase().replace(/\/$/, '')));
          api.importNetscape(parsed);
          setResult(
            `✅ Import fertig: ${fresh.length} neu übernommen, ${
              parsed.bookmarks.length - fresh.length
            } bereits vorhanden (übersprungen). Kategorien und Auto-Kategorisierung angewendet.`
          );
        }
      }
    } catch (err) {
      setResult(`❌ Fehler beim Lesen: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Import">
        <h2>⬆ Import</h2>
        <p className="hint">
          <strong>Browser-Export:</strong> In Chrome/Brave: Menü → Lesezeichen und Listen → Lesezeichen-Manager → ⋮ →
          „Lesezeichen exportieren". In Firefox: Lesezeichen verwalten → „Importieren und Sichern" → „Lesezeichen nach
          HTML exportieren". Die entstandene HTML-Datei hier wählen.
        </p>
        <div className="import-choices">
          <button className={`btn ${mode === 'html' ? 'primary' : ''}`} onClick={() => setMode('html')}>
            Lesezeichen-HTML (Browser)
          </button>
          <button className={`btn ${mode === 'json' ? 'primary' : ''}`} onClick={() => setMode('json')}>
            JSON-Sicherung dieser App
          </button>
        </div>
        {mode && (
          <div
            className="dropzone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
          >
            {mode === 'html' ? '📁 Lesezeichen-HTML hierher ziehen oder klicken' : '📁 JSON-Backup hierher ziehen oder klicken'}
            <input
              ref={inputRef}
              type="file"
              accept=".html,.htm,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>
        )}
        {busy && <p>⏳ Verarbeite …</p>}
        {result && <p className="import-result">{result}</p>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
