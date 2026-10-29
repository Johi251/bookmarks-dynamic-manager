import { urlKey } from '../host';
import { useEffect, useRef, useState } from 'react';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { parseNetscapeHtml } from '../parser/netscape';
import type { AppState } from '../types';
import { analyzeBatch } from '../ai/router';
import { suggestGlossaryTerms, type SmartAnalysis, type TermCandidate } from '../ai/engine';
import Icon from './Icon';

interface Props {
  api: BookmarksApi;
  onClose: () => void;
  onLearnGlossary: (candidates: TermCandidate[]) => void;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

/**
 * Import mit KI-Strukturierung: Netscape-HTML (Chrome/Firefox/Brave/Edge) oder
 * JSON-Backup. Beim HTML-Import analysiert die Engine (lokal oder eigene API)
 * jeden Link: Meta-Tags, Glossar-Kategorien, Cross-Verlinkungs-Basis.
 */
export default function ImportDialog({ api, onClose, onLearnGlossary, notify }: Props) {
  const [mode, setMode] = useState<'html' | 'json' | null>(null);
  const [smart, setSmart] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TermCandidate[] | null>(null);
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
    setCandidates(null);
    try {
      const text = await file.text();
      if (/\.json$/i.test(file.name) || file.type.includes('json')) {
        const parsed = JSON.parse(text) as Omit<Partial<AppState>, 'version'> & { version?: number; bookmarks?: unknown };
        if ((parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) || !Array.isArray(parsed.bookmarks)) {
          setResult('Ungültiges JSON — keine App-Datensicherung (Version 1, 2 oder 3 erwartet).');
        } else {
          const replace = confirm(
            `${parsed.bookmarks.length} Lesezeichen gefunden.\n\nOK = Bestand ERSETZEN\nAbbrechen = zusammenführen`
          );
          api.importState(parsed as AppState, replace ? 'replace' : 'merge');
          setResult(`JSON importiert: ${parsed.bookmarks.length} Lesezeichen (${replace ? 'ersetzt' : 'zusammengeführt'}).`);
          notify('JSON-Import abgeschlossen', 'ok');
        }
      } else {
        const parsed = parseNetscapeHtml(text);
        if (parsed.bookmarks.length === 0) {
          setResult('Keine Lesezeichen in der Datei gefunden (Netscape-HTML erwartet).');
        } else {
          const existing = new Set(api.state.bookmarks.map((b) => urlKey(b.url)));
          const fresh = parsed.bookmarks.filter((b) => !existing.has(urlKey(b.url)));

          // KI-Routing: lokale Engine (Standard) oder eigene API. Die Ergebnisse
          // werden dem Import übergeben (Map URL → Analyse) und dort angewendet.
          let usedProvider = 'lokal';
          let analyses: Map<string, SmartAnalysis> | undefined;
          if (smart) {
            const { results, info } = await analyzeBatch(
              fresh.map((b) => ({ url: b.url, title: b.title, existingTags: b.tags })),
              api.state.settings,
              api.state.glossary
            );
            usedProvider = info.used === 'api' ? 'API' : 'lokal';
            if (info.fallbackReason) notify('KI-API nicht erreichbar — lokale Engine übernimmt', 'warn', info.fallbackReason);
            analyses = new Map(fresh.map((b, i) => [urlKey(b.url), results[i]]));
          }
          api.importNetscape(parsed, { smart, analyses });

          // Unbekannte markante Begriffe für das Glossar vorschlagen („Was genau meinst du damit?").
          const nextBookmarks = [...fresh.map((b) => ({ ...b })), ...api.state.bookmarks];
          const cand = smart ? suggestGlossaryTerms(nextBookmarks, api.state.glossary) : [];
          setCandidates(cand);
          setResult(
            `Import fertig: ${fresh.length} neu übernommen, ${parsed.bookmarks.length - fresh.length} bereits vorhanden` +
              (smart ? ` · KI-Strukturierung (${usedProvider}): Meta-Tags + Glossar angewendet` : '') +
              (cand.length > 0 ? ` · ${cand.length} unbekannte Begriffe erkannt` : '')
          );
          notify('Import abgeschlossen', 'ok', smart ? `KI-Strukturierung: ${usedProvider}` : undefined);
        }
      }
    } catch (err) {
      setResult(`Fehler beim Lesen: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Import">
        <h2>
          <Icon name="upload" size={17} /> Import
        </h2>
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
        {mode === 'html' && (
          <label className="check-row suggest-row">
            <input type="checkbox" checked={smart} onChange={(e) => setSmart(e.target.checked)} />
            <span>
              <strong>KI-Strukturierung</strong> — Links automatisch analysieren, mit Meta-Tags versehen und ans
              Glossar anbinden ({api.state.settings.aiProvider === 'api' ? 'eigene API' : 'lokale Engine'})
            </span>
          </label>
        )}
        {mode && (
          <>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept={mode === 'html' ? '.html,.htm,text/html' : '.json,application/json'}
            aria-label="Importdatei"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            className="dropzone"
            aria-label={mode === 'html' ? 'Lesezeichen-HTML auswählen' : 'JSON-Sicherung auswählen'}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f && !busy) void handleFile(f);
            }}
          >
            {mode === 'html' ? 'Lesezeichen-HTML hierher ziehen oder klicken' : 'JSON-Backup hierher ziehen oder klicken'}
          </button>
          </>
        )}
        {busy && <p className="busy-row"><span className="spinner" /> Verarbeite — KI-Strukturierung läuft …</p>}
        {result && <p className="import-result">{result}</p>}
        {candidates && candidates.length > 0 && (
          <button className="btn primary" onClick={() => onLearnGlossary(candidates)}>
            <Icon name="sparkles" size={14} /> {candidates.length} unbekannte Begriffe definieren — „Was genau meinst du damit?"
          </button>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
