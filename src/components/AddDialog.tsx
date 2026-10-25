import { useEffect, useMemo, useState } from 'react';
import type { Bookmark } from '../types';
import type { BookmarksApi } from '../hooks/useBookmarks';
import Icon from './Icon';

interface Props {
  api: BookmarksApi;
  bookmark?: Bookmark;
  onClose: () => void;
}

/** Dialog zum Hinzufügen und Bearbeiten; zeigt Live-Auto-Kategorisierung + KI-Tag-Vorschläge. */
export default function AddDialog({ api, bookmark, onClose }: Props) {
  const [title, setTitle] = useState(bookmark?.title ?? '');
  const [url, setUrl] = useState(bookmark?.url ?? '');
  const [tags, setTags] = useState(bookmark?.tags.join(', ') ?? '');
  const [note, setNote] = useState(bookmark?.note ?? '');
  const [pinned, setPinned] = useState(bookmark?.pinned ?? false);
  const [selected, setSelected] = useState<string[]>(bookmark?.categoryIds ?? []);
  const [newCat, setNewCat] = useState('');
  const [takeTags, setTakeTags] = useState<string[]>([]);

  const suggestion = useMemo(() => {
    if (!url.trim()) return [];
    return api.suggestCategories(url.trim(), title.trim());
  }, [url, title, api]);

  const tagSuggestion = useMemo(() => {
    if (!url.trim()) return [];
    return api.suggestTags(url.trim(), title.trim()).filter((t) => !tags.toLowerCase().includes(t));
  }, [url, title, tags, api]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleCat = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const tagList = [
      ...tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      ...takeTags,
    ];
    const catIds = [...selected];
    if (newCat.trim()) {
      const cat = api.addCategory(newCat.trim());
      if (!catIds.includes(cat.id)) catIds.push(cat.id);
    }
    if (bookmark) {
      api.updateBookmark(bookmark.id, { title: title.trim() || url, url, tags: [...new Set(tagList)], pinned, note: note.trim() || undefined, categoryIds: catIds });
    } else {
      api.addBookmark({ title: title.trim() || url, url: url.trim(), tags: [...new Set(tagList)], categoryIds: catIds, pinned, note: note.trim() || undefined });
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} aria-label="Lesezeichen bearbeiten">
        <h2>{bookmark ? 'Lesezeichen bearbeiten' : 'Lesezeichen hinzufügen'}</h2>
        <label>
          URL *
          <input
            autoFocus
            required
            type="text"
            inputMode="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label>
          Titel
          <input type="text" placeholder="optional — sonst wird die URL verwendet" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {suggestion.length > 0 && (
          <p className="suggest">
            <Icon name="sparkles" size={14} /> Auto-Kategorisierung: <strong>{suggestion.join(' · ')}</strong> — wird beim Speichern ergänzt.
          </p>
        )}
        {tagSuggestion.length > 0 && (
          <div className="suggest tag-suggest">
            <Icon name="tag" size={14} /> Vorgeschlagene Meta-Tags:
            {tagSuggestion.map((t) => (
              <button
                key={t}
                type="button"
                className={`tag-chip ${takeTags.includes(t) ? 'active' : ''}`}
                onClick={() => setTakeTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        <label>
          Tags (Komma-getrennt)
          <input type="text" placeholder="ki, tools, kostenlos" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label>
          Notiz
          <input type="text" placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <fieldset className="cat-select">
          <legend>Kategorien (Mehrfachauswahl + automatisch)</legend>
          {api.state.categories.length === 0 && <p className="hint">Noch keine Kategorien vorhanden.</p>}
          <div className="cat-options">
            {api.state.categories.map((c) => (
              <label key={c.id} className={`chip-option ${selected.includes(c.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleCat(c.id)} /> {c.name}
              </label>
            ))}
          </div>
          <div className="new-cat-row">
            <input type="text" placeholder="Neue Kategorie anlegen …" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          </div>
        </fieldset>
        <label className="check-row">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Anpinnen (steht oben)
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn primary">
            Speichern
          </button>
        </div>
      </form>
    </div>
  );
}
