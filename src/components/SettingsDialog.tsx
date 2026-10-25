import { useEffect, useState } from 'react';
import type { BookmarksApi } from '../hooks/useBookmarks';
import { getAiApiKey, setAiApiKey } from '../storage';
import { formatShortcut, type ShortcutCombo } from '../shortcut';
import Icon from './Icon';

interface Props {
  api: BookmarksApi;
  shortcut: ShortcutCombo;
  onShortcutChange: (combo: ShortcutCombo) => void;
  onClose: () => void;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

/** Einstellungen: Kompaktstart, Favoriten, Tastenkürzel (Standard Strg+F), KI-Routing. */
export default function SettingsDialog({ api, shortcut, onShortcutChange, onClose, notify }: Props) {
  const [settings, setSettings] = useState(api.state.settings);
  const [recording, setRecording] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => setApiKey(getAiApiKey()), []);

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

  const save = () => {
    api.updateSettings(settings);
    setAiApiKey(apiKey);
    notify('Einstellungen gespeichert', 'ok');
    onClose();
  };

  const toggleFavorite = (id: string) => {
    setSettings((s) => ({
      ...s,
      favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
    }));
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
                Modell
                <input
                  type="text"
                  placeholder="z. B. gpt-4o-mini"
                  value={settings.aiModel}
                  onChange={(e) => setSettings((s) => ({ ...s, aiModel: e.target.value.trim() }))}
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
              <p className="hint">Der Schlüssel bleibt ausschließlich lokal — er ist nie im JSON-Export enthalten.</p>
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
