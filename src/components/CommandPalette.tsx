import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookmarksApi } from '../hooks/useBookmarks';
import type { Selection } from '../types';
import Icon from './Icon';
import { describeNewCrossLinks } from '../crosslink';

interface Props {
  api: BookmarksApi;
  onClose: () => void;
  onSelect: (s: Selection) => void;
  notify: (text: string, kind?: 'ok' | 'info' | 'warn', detail?: string) => void;
}

type Row =
  | { kind: 'command'; id: string; label: string; hint: string; run: () => void }
  | { kind: 'bookmark'; id: string; label: string; hint: string; url: string; bookmarkId: string };

/**
 * Command-Palette (Standard Strg+F, konfigurierbar in den Einstellungen):
 * durchsucht Befehle und Lesezeichen; „Zuordnen" (Taste A oder Klick) legt
 * einen Link in eine Kategorie/Gruppe — inkl. Cross-Verlinkungs-Hinweis.
 */
export default function CommandPalette({ api, onClose, onSelect, notify }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [assignTarget, setAssignTarget] = useState<string | null>(null); // bookmarkId im Zuordnen-Modus
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [query, assignTarget]);

  const groupById = useMemo(() => new Map(api.state.dynamicGroups.map((g) => [g.id, g])), [api.state.dynamicGroups]);

  const doAssign = (bookmarkId: string, categoryId: string, kind: 'category' | 'group', targetName: string) => {
    const bm = api.state.bookmarks.find((b) => b.id === bookmarkId);
    if (!bm) return;
    if (kind === 'category') {
      api.assignToCategory(bookmarkId, categoryId);
      if (bm.categoryIds.includes(categoryId)) {
        notify(`Bereits in „${targetName}"`, 'info');
      } else {
        const nextState = { ...api.state, bookmarks: api.state.bookmarks.map((b) => (b.id === bookmarkId ? { ...b, categoryIds: [...b.categoryIds, categoryId] } : b)) };
        const cross = describeNewCrossLinks({ ...bm, categoryIds: [...bm.categoryIds, categoryId] }, nextState);
        notify(`„${bm.title}" → ${targetName}`, 'ok', cross ? `Verknüpft mit: ${cross}` : undefined);
      }
    } else {
      for (const tag of groupById.get(categoryId)?.terms ?? []) {
        if (tag.startsWith('#')) api.addTag(bookmarkId, tag.slice(1));
      }
      notify(`„${bm.title}" → ${targetName}`, 'ok', 'Gruppen-Tags ergänzt');
    }
    onClose();
  };

  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (assignTarget) {
      const targets: Row[] = [
        ...api.state.categories.map((c): Row => ({
          kind: 'command',
          id: `cat-${c.id}`,
          label: c.name,
          hint: 'Kategorie',
          run: () => doAssign(assignTarget, c.id, 'category', c.name),
        })),
        ...api.state.dynamicGroups.map((g): Row => ({
          kind: 'command',
          id: `grp-${g.id}`,
          label: g.name,
          hint: 'Dynamische Gruppe',
          run: () => doAssign(assignTarget, g.id, 'group', g.name),
        })),
      ];
      return q ? targets.filter((t) => t.label.toLowerCase().includes(q)) : targets;
    }

    const bmMatches = api.state.bookmarks
      .filter((b) => !q || `${b.title} ${b.url} ${b.tags.join(' ')}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map((b): Row => ({
        kind: 'bookmark',
        id: b.id,
        label: b.title,
        hint: new URL(b.url.startsWith('http') ? b.url : `https://${b.url}`).hostname.replace(/^www\./, ''),
        url: b.url,
        bookmarkId: b.id,
      }));

    const commands: Row[] = ([
      {
        kind: 'command',
        id: 'cmd-theme',
        label: 'Design umschalten (hell/dunkel)',
        hint: 'Befehl',
        run: () => document.dispatchEvent(new CustomEvent('bdm-toggle-theme')),
      },
      { kind: 'command', id: 'cmd-all', label: 'Alle Lesezeichen öffnen', hint: 'Ansicht', run: () => onSelect({ type: 'all' }) },
      {
        kind: 'command',
        id: 'cmd-pinned',
        label: 'Angepinnte anzeigen',
        hint: 'Ansicht',
        run: () => onSelect({ type: 'smart', key: 'pinned' }),
      },
      ...api.state.categories.slice(0, 30).map((c): Row => ({
        kind: 'command',
        id: `open-${c.id}`,
        label: `Kategorie öffnen: ${c.name}`,
        hint: 'Ansicht',
        run: () => onSelect({ type: 'category', categoryId: c.id }),
      })),
    ] as Row[]).filter((c) => !q || c.label.toLowerCase().includes(q));

    return [...commands.slice(0, 5), ...bmMatches];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, assignTarget, api.state]);

  const activate = (row: Row) => {
    if (row.kind === 'command') row.run();
    else { api.markOpened(row.bookmarkId); window.open(row.url, '_blank', 'noreferrer noopener'); }
    if (!(row.kind === 'bookmark')) onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (assignTarget) setAssignTarget(null);
      else onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) activate(row);
    } else if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const row = rows[active];
      if (row?.kind === 'bookmark') {
        e.preventDefault();
        setAssignTarget(row.bookmarkId);
        setQuery('');
      }
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.palette-row.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const assignBm = assignTarget ? api.state.bookmarks.find((b) => b.id === assignTarget) : null;

  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Schnellzugriff">
        <div className="palette-head">
          <Icon name="command" size={15} />
          {assignBm && (
            <span className="palette-title">
              „{assignBm.title}" zuordnen zu … <button className="link-btn" onClick={() => setAssignTarget(null)}>abbrechen</button>
            </span>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={assignBm ? 'Kategorie oder Gruppe suchen …' : 'Suchen — Lesezeichen, Kategorien, Befehle …'}
            aria-label="Palette-Suche"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-rows" ref={listRef}>
          {rows.length === 0 && <p className="palette-empty">Keine Treffer</p>}
          {rows.map((row, i) => (
            <button
              key={`${row.kind}-${row.id}`}
              className={`palette-row ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => activate(row)}
            >
              <Icon name={row.kind === 'bookmark' ? 'bookmark' : row.hint === 'Kategorie' ? 'folder' : row.hint === 'Dynamische Gruppe' ? 'hash' : 'arrowRight'} size={15} />
              <span className="palette-label">{row.label}</span>
              <span className="palette-hint">
                {row.kind === 'bookmark' ? (
                  <>
                    {row.hint} · <kbd className="inline">A</kbd> zuordnen
                  </>
                ) : (
                  row.hint
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="palette-foot">
          <span><kbd>↑↓</kbd> navigieren</span>
          <span><kbd>Enter</kbd> {assignTarget ? 'zuordnen' : 'öffnen'}</span>
          {!assignTarget && <span><kbd>A</kbd> Link zuordnen</span>}
          <span><kbd>Esc</kbd> schließen</span>
        </div>
      </div>
    </div>
  );
}
