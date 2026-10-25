interface Props {
  query: string;
  onQuery: (q: string) => void;
  tab: 'bookmarks' | 'curated';
  onTab: (t: 'bookmarks' | 'curated') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onAdd: () => void;
  onImport: () => void;
  onRules: () => void;
}

export default function Toolbar({ query, onQuery, tab, onTab, theme, onToggleTheme, onAdd, onImport, onRules }: Props) {
  return (
    <div className="toolbar">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'bookmarks'} className={tab === 'bookmarks' ? 'active' : ''} onClick={() => onTab('bookmarks')}>
          Lesezeichen
        </button>
        <button role="tab" aria-selected={tab === 'curated'} className={tab === 'curated' ? 'active' : ''} onClick={() => onTab('curated')}>
          Empfehlungen
        </button>
      </div>
      <input
        className="search"
        type="search"
        placeholder="Suchen — Titel, URL, Tags, Kategorien …"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        aria-label="Lesezeichen durchsuchen"
      />
      <button className="btn primary" onClick={onAdd} title="Lesezeichen hinzufügen">
        + Hinzufügen
      </button>
      <button className="btn" onClick={onImport} title="Browser-Export oder JSON importieren">
        ⬆ Import
      </button>
      <button className="btn" onClick={onRules} title="Kategorisierungs-Regeln anzeigen und bearbeiten">
        ⚙ Regeln
      </button>
      <button className="btn icon" onClick={onToggleTheme} title="Hell/Dunkel umschalten">
        {theme === 'dark' ? '☀' : '🌙'}
      </button>
    </div>
  );
}
