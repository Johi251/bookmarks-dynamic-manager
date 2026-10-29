import { useEffect, useRef, useState } from 'react';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { getAiApiKey, setAiApiKey, isWebUrl, storageKind } from '../storage';
import { formatShortcut, type ShortcutCombo } from '../shortcut';
import { deleteSnapshot, exportCsv, importCsv, listSnapshots, writeSnapshot, type BackupSnapshot } from '../backup';
import { downloadFile, exportJson } from '../exporter';
import Icon from './Icon';

interface Props {
  api: BookmarksApi;
  shortcut: ShortcutCombo;
  onShortcutChange: (combo: ShortcutCombo) => void;
  onClose: () => void;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

/** Einstellungen: Kompaktstart, Favoriten, Tastenkürzel, KI-Routing, 1Clicker,
    Favicons, Vision-Verschlagwortung und das Backup-Zentrum (JSON/CSV, Wochen-Snapshots). */
export default function SettingsDialog({ api, shortcut, onShortcutChange, onClose, notify }: Props) {
  const [settings, setSettings] = useState(api.state.settings);
  const [recording, setRecording] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const csvInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  useEffect(() => { void getAiApiKey().then(setApiKey).catch(() => notify('KI-Schlüssel konnte nicht geladen werden', 'warn')); }, []);
  useEffect(() => {
    void listSnapshots().then(setSnapshots);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (recording) setRecording(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, recording]);

  const recordKey = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setRecording(false);
      return;
    }
    const key = e.key.toLowerCase();
    if (['control', 'shift', 'alt', 'meta'].includes(key)) return; // nur Modifikatoren gedrückt
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return; // Kürzel braucht mindestens einen Modifikator
    const combo: ShortcutCombo = { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, key };
    onShortcutChange(combo);
    setRecording(false);
  };

  const save = async () => {
    if (settings.aiProvider === 'api') {
      if (!isWebUrl(settings.aiEndpoint)) { notify('Gültigen HTTP-/HTTPS-KI-Endpunkt ohne Zugangsdaten eingeben', 'warn'); return; }
      if (storageKind() === 'extension' && !await chrome.permissions.request({ origins: [`${new URL(settings.aiEndpoint).origin}/*`] }).catch(() => false)) {
        notify('Zugriff auf den KI-Endpunkt wurde nicht erlaubt', 'warn'); return;
      }
    }
    try { await setAiApiKey(apiKey); } catch { notify('KI-Schlüssel nicht gespeichert', 'warn'); return; }
    api.updateSettings(settings);
    notify('Einstellungen übernommen', 'ok');
    onClose();
  };

  const toggleFavorite = (id: string) => {
    setSettings((s) => ({
      ...s,
      favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
    }));
  };

  const backupNow = async () => {
    try {
      const snap = await writeSnapshot(api.state);
      setSnapshots(await listSnapshots());
      notify(`Snapshot „${snap.date}" angelegt`, 'ok', `${snap.bookmarkCount} Lesezeichen gesichert`);
    } catch (err) {
      notify('Snapshot fehlgeschlagen', 'warn', String(err instanceof Error ? err.message : err));
    }
  };

  const restoreSnapshot = (snap: BackupSnapshot) => {
    if (!confirm(`Snapshot vom ${snap.date} wiederherstellen?\n\nAktueller Bestand (${api.state.bookmarks.length} Lesezeichen) wird ERSETZT.`)) return;
    api.importState(snap.state, 'replace');
    notify('Snapshot wiederhergestellt', 'ok', `${snap.bookmarkCount} Lesezeichen`);
  };

  const downloadSnapshot = (snap: BackupSnapshot) => {
    downloadFile(`bdm-backup-${snap.date}.json`, exportJson(snap.state), 'application/json');
  };

  const handleCsvImport = async (file: File) => {
    try {
      const text = await file.text();
      const res = importCsv(text);
      if (res.fullState && !confirm('Vollständige CSV-Sicherung wiederherstellen? Der aktuelle Bestand wird ersetzt.')) return;
      api.importState(res.state, res.fullState ? 'replace' : 'merge');
      notify(
        'CSV importiert',
        'ok',
        `${res.bookmarks.length} Lesezeichen übernommen${res.skipped > 0 ? `, ${res.skipped} übersprungen (ungültig/Duplikat)` : ''}`
      );
    } catch (err) {
      notify('CSV-Import fehlgeschlagen', 'warn', String(err instanceof Error ? err.message : err));
    }
  };

  const handleJsonRestore = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { version?: number; bookmarks?: unknown };
      if (!Array.isArray(parsed.bookmarks)) throw new Error('Keine Lesezeichen in der Datei');
      if (!confirm(`JSON-Sicherung wiederherstellen (${(parsed.bookmarks as unknown[]).length} Lesezeichen)?\n\nAktueller Bestand wird ERSETZT.`)) return;
      api.importState(parsed as never, 'replace');
      notify('JSON-Sicherung wiederhergestellt', 'ok');
    } catch (err) {
      notify('JSON-Rückspielung fehlgeschlagen', 'warn', String(err instanceof Error ? err.message : err));
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Einstellungen">
        <h2>
          <Icon name="layers" size={17} /> Einstellungen
        </h2>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.startMinimized}
            onChange={(e) => setSettings((s) => ({ ...s, startMinimized: e.target.checked }))}
          />
          <span>
            <strong>Minimiert starten</strong> — schlanke Schnellzugriffs-Leiste mit den Favoriten-Kategorien
          </span>
        </label>

        <div className="setting-row">
          <span className="setting-label">Schnellzugriff (Palette)</span>
          <button className={`btn small ${recording ? 'recording' : ''}`} onClick={() => setRecording((r) => !r)}>
            {recording ? 'Tastenkombination drücken …' : formatShortcut(shortcut)}
          </button>
        </div>
        <input
          className="shortcut-recorder"
          autoFocus={recording}
          value=""
          onChange={() => undefined}
          onKeyDown={recordKey}
          aria-hidden="true"
          tabIndex={recording ? 0 : -1}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />

        <fieldset className="cat-select">
          <legend>Favoriten-Kategorien (Kompaktmodus-Leiste)</legend>
          <div className="cat-options">
            {api.state.categories.length === 0 && <p className="hint">Noch keine Kategorien vorhanden.</p>}
            {api.state.categories.map((c) => (
              <label key={c.id} className={`chip-option ${settings.favorites.includes(c.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={settings.favorites.includes(c.id)} onChange={() => toggleFavorite(c.id)} /> {c.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="cat-select">
          <legend>1Clicker-Status-Engine &amp; Favicons</legend>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.clickerEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, clickerEnabled: e.target.checked }))}
            />
            <span>
              <strong>1Clicker-Analyse</strong> — Software-/Repository-Links erhalten eine Status-Badge:
              🟠 <em>Checking</em> (Analyse läuft), 🟢 <em>Online</em> (1 Klick Web-App), 🔵 <em>Lokal</em> (Docker/
              portable Assets/START-1CLICKER). Repositories werden gedrosselt über die öffentliche GitHub-API geprüft.
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.faviconsEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, faviconsEnabled: e.target.checked }))}
            />
            <span>
              <strong>Echte Webseiten-Logos laden</strong> — Favicon-Kette (Google S2 → Icon.horse, 64×64);
              aus = private Buchstaben-Avatare ohne Netzwerk-Anfragen.
            </span>
          </label>
        </fieldset>

        <fieldset className="cat-select">
          <legend>KI-Strukturierung beim Import</legend>
          <label className="check-row">
            <input
              type="radio"
              name="ai-provider"
              checked={settings.aiProvider !== 'api'}
              onChange={() => setSettings((s) => ({ ...s, aiProvider: 'local' }))}
            />
            <span>
              <strong>Lokale Engine</strong> (Standard) — offline, kostenlos, deterministisch
            </span>
          </label>
          <label className="check-row">
            <input
              type="radio"
              name="ai-provider"
              checked={settings.aiProvider === 'api'}
              onChange={() => setSettings((s) => ({ ...s, aiProvider: 'api' }))}
            />
            <span>
              <strong>Eigene API</strong> — OpenAI-kompatibler Endpunkt (fällt bei Fehlern auf lokal zurück)
            </span>
          </label>
          {settings.aiProvider === 'api' && (
            <div className="ai-api-fields">
              <label>
                Endpunkt (Basis-URL)
                <input
                  type="text"
                  placeholder="https://api.example.com/v1"
                  value={settings.aiEndpoint}
                  onChange={(e) => setSettings((s) => ({ ...s, aiEndpoint: e.target.value.trim() }))}
                />
              </label>
              <label>
                Modell (Text-Import)
                <input
                  type="text"
                  placeholder="z. B. gpt-4o-mini"
                  value={settings.aiModel}
                  onChange={(e) => setSettings((s) => ({ ...s, aiModel: e.target.value.trim() }))}
                />
              </label>
              <label>
                Vision-Modell (Screenshot-Verschlagwortung im Add-on)
                <input
                  type="text"
                  placeholder="glm-5.3-flash"
                  value={settings.visionModel}
                  onChange={(e) => setSettings((s) => ({ ...s, visionModel: e.target.value.trim() }))}
                />
              </label>
              <label>
                API-Schlüssel
                <input
                  type="password"
                  placeholder="wird nur lokal auf diesem Gerät gespeichert"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <p className="hint">
                Der Schlüssel bleibt ausschließlich lokal — er ist nie im JSON-Export enthalten. Das Vision-Modell
                (Standard <strong>GLM-5.3 Flash</strong>) analysiert im Browser-Add-on optional einen Screenshot der
                gespeicherten Seite und verschlagwortet das Lesezeichen anhand des visuellen Inhalts.
              </p>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={settings.visionOnSave}
                  onChange={(e) => setSettings((s) => ({ ...s, visionOnSave: e.target.checked }))}
                />
                <span>
                  <strong>Vision beim Speichern (Add-on)</strong> — Screenshot der sichtbaren Seite ziehen und
                  automatisch verschlagworten lassen
                </span>
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="cat-select">
          <legend>Backup &amp; Export</legend>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.autoBackup}
              onChange={(e) => setSettings((s) => ({ ...s, autoBackup: e.target.checked }))}
            />
            <span>
              <strong>Wöchentliche Auto-Sicherung</strong> — rein lokal: Snapshots in IndexedDB, die letzten 8 Sicherungen (Prüfung bei geöffneter App)
            </span>
          </label>
          <div className="export-row">
            <button className="btn small" onClick={backupNow}>
              <Icon name="shield" size={13} /> Jetzt sichern
            </button>
            <button
              className="btn small"
              onClick={() => downloadFile(`bookmarks-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJson(api.state), 'application/json')}
            >
              JSON
            </button>
            <button
              className="btn small"
              onClick={() => downloadFile(`bookmarks-${new Date().toISOString().slice(0, 10)}.csv`, exportCsv(api.state), 'text/csv')}
            >
              CSV
            </button>
            <button className="btn small" onClick={() => jsonInput.current?.click()}>
              JSON zurückspielen
            </button>
            <button className="btn small" onClick={() => csvInput.current?.click()}>
              CSV importieren
            </button>
            <input
              ref={csvInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleCsvImport(f);
                e.target.value = '';
              }}
            />
            <input
              ref={jsonInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleJsonRestore(f);
                e.target.value = '';
              }}
            />
          </div>
          {snapshots.length > 0 && (
            <div className="backup-list">
              {snapshots.map((s) => (
                <div key={s.date} className="backup-row">
                  <span className="backup-date">
                    {s.date} · {s.bookmarkCount} Lesezeichen
                  </span>
                  <span className="backup-actions">
                    <button className="btn small" onClick={() => restoreSnapshot(s)}>
                      Wiederherstellen
                    </button>
                    <button className="btn small" onClick={() => downloadSnapshot(s)}>
                      <Icon name="download" size={12} />
                    </button>
                    <button
                      className="btn small danger"
                      title="Snapshot löschen"
                      onClick={() => {
                        void deleteSnapshot(s.date).then(() => listSnapshots().then(setSnapshots));
                      }}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
