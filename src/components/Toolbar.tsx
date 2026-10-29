import Icon from './Icon';

interface Props {
  query: string;
  onQuery: (q: string) => void;
  tab: 'bookmarks' | 'curated' | 'stats';
  onTab: (t: 'bookmarks' | 'curated' | 'stats') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  minimized: boolean;
  onToggleMinimized: () => void;
  shortcutLabel: string;
  onPalette: () => void;
  onAdd: () => void;
  onImport: () => void;
  onRules: () => void;
  onGlossary: () => void;
  onVideo: () => void;
  onSettings: () => void;
}

export default function Toolbar({
  query,
  onQuery,
  tab,
  onTab,
  theme,
  onToggleTheme,
  minimized,
  onToggleMinimized,
  shortcutLabel,
  onPalette,
  onAdd,
  onImport,
  onRules,
  onGlossary,
  onVideo,
  onSettings,
}: Props) {
  return (
    <div className="toolbar">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'bookmarks'} className={tab === 'bookmarks' ? 'active' : ''} onClick={() => onTab('bookmarks')}>
          Lesezeichen
        </button>
        <button role="tab" aria-selected={tab === 'curated'} className={tab === 'curated' ? 'active' : ''} onClick={() => onTab('curated')}>
          Empfehlungen
        </button>
        <button role="tab" aria-selected={tab === 'stats'} className={tab === 'stats' ? 'active' : ''} onClick={() => onTab('stats')}>Statistik</button>
      </div>
      <div className="search-wrap">
        <Icon name="search" size={14} className="search-icon" />
        <input
          className="search"
          type="search"
          placeholder="Suchen — Titel, URL, Tags, Kategorien …"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Lesezeichen durchsuchen"
        />
      </div>
      <button className="btn icon" onClick={onPalette} title={`Schnellzugriff öffnen (${shortcutLabel})`}>
        <Icon name="command" size={15} />
      </button>
      <button className="btn primary" onClick={onAdd} title="Lesezeichen hinzufügen">
        <Icon name="plus" size={14} /> Hinzufügen
      </button>
      <button className="btn" onClick={onImport} title="Browser-Export oder JSON importieren">
        <Icon name="upload" size={14} /> Import
      </button>
      <button className="btn" onClick={onGlossary} title="Glossar: eigene Begriffsketten verwalten">
        <Icon name="book" size={14} /> Glossar
      </button>
      <button className="btn" onClick={onRules} title="Kategorisierungs-Regeln anzeigen und bearbeiten">
        <Icon name="settings" size={14} /> Regeln
      </button>
      <button className="btn icon" onClick={onVideo} title="Video-Studio: Lesezeichen als 16:9-Walkthrough oder 9:16-Short präsentieren (Remotion)">
        <Icon name="film" size={15} />
        <span className="visually-hidden">Video-Studio</span>
      </button>
      <button className="btn" onClick={onSettings} title="Einstellungen (Start, Favoriten, KI, Backup, Tastenkürzel)">
        <Icon name="layers" size={14} />
        <span className="visually-hidden">Einstellungen</span>
      </button>
      <button className="btn icon" onClick={onToggleMinimized} title={minimized ? 'Vollansicht öffnen' : 'In Kompaktmodus minimieren'}>
        <Icon name={minimized ? 'maximize' : 'minimize'} size={15} />
      </button>
      <button className="btn icon" onClick={onToggleTheme} title="Hell/Dunkel umschalten">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>
    </div>
  );
}
