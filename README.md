# Bookmarks Dynamic Manager

Eine lokale, private App zur Verwaltung von Lesezeichen mit **KI-Import-Strukturierung**,
**Glossar mit Cross-Verlinkung**, **dynamischen Hashtag-Gruppen**, automatischer
**Multi-Kategorisierung**, Live-Suche und **Kompaktmodus**. Alle Daten bleiben auf dem
eigenen Gerät (localStorage bzw. chrome.storage) — kein Account, kein Server, keine Kosten.

**Live (Stand v1.1.0):** <https://johi251.github.io/bookmarks-dynamic-manager/>

## Downloads & Installation

Die App gibt es in drei Formen — alle nutzen denselben Datenbestand (JSON-Import/Export
kompatibel; Kategorisierung identisch):

| Form | Download | Installation |
|---|---|---|
| **Web-App (PWA)** | <https://johi251.github.io/bookmarks-dynamic-manager/> | Direkt öffnen; im Browser „Installieren“ wählen → wirkt wie eine App, offlinefähig |
| **Windows-App** | Release-Bereich: `BookmarksDynamicManager.exe` (portabel) bzw. NSIS-Installer | EXE direkt starten bzw. Installer ausführen (nutzt WebView2, auf Windows 10/11 vorinstalliert) |
| **Browser-Add-on** | Release-Bereich: `bookmarks-dynamic-manager-chrome.zip` (Chrome/Brave/Edge) und `bookmarks-dynamic-manager-firefox.zip` | Entpacken → `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“; Firefox: `about:debugging` → „Add-on temporär laden“ |

Add-on-Funktionen: Popup-Button „Diese Seite speichern“, Rechtsklick-Kontextmenü
und Tastenkürzel **Strg+Shift+S** — jeder gespeicherte Link wird sofort automatisch
(multi-)kategorisiert; die komplette Verwaltung öffnet über „Manager öffnen“.

## Funktionen

### Neu in v1.2.0

- **KI-Strukturierung beim Import (Smart Import):** Importierte Links werden automatisch
  analysiert und mit intelligenten Meta-Tags/Schlagwörtern versehen (Titel-/URL-Token,
  Domain-Kern, Glossar-Begriffe und deren verwandte Themen). Standard ist die **lokale
  Engine** (offline, kostenlos, deterministisch). In den Einstellungen lässt sich stattdessen
  eine **eigene OpenAI-kompatible API** eintragen (Endpunkt + Modell + Schlüssel, nur lokal
  gespeichert, nie im JSON-Export); schlägt sie fehl, greift automatisch die lokale Engine.
- **Glossar & Begriffsketten:** Eigene Begriffe definieren — z. B.
  `SMMA → Social Media Marketing`, `JayTX → Musiker Business, SMMA, Lyric Videos, Musik-Vertrieb`,
  `ROFLnator.90 → MEME SMMA, Drive-Ordner, Auto-Posting`. Das Glossar steuert Tags,
  Kategorien und die Cross-Verlinkung. Unbekannte, markante Begriffe aus Importen werden
  proaktiv vorgeschlagen („**Was genau meinst du damit?**") und füttern das Glossar per Klick.
- **Intelligente Cross-Verlinkung (Cross-Mapping):** Wird ein Link per Drag & Drop, über
  den Schnellzugriff (**Strg+F**, konfigurierbar) oder manuell einer Gruppe zugeordnet,
  prüft das System die Glossar-Abhängigkeiten: Da „JayTX" das Thema „SMMA" enthält und
  „ROFLnator.90" ebenfalls „SMMA", erscheint der Link automatisch auch bei
  „ROFLnator.90" — gekennzeichnet als *verknüpft via SMMA* (gestrichelte Karte, ohne
  Duplikat im Datenbestand).
- **Dynamische Tag- & Gruppen-Sortierung (Hashtag-Manager):** Gruppen wie „#TOP KI"
  scannen den Bestand autonom und sammeln passende Links dynamisch ein — `#Tag` matcht
  Tags, freie Begriffe matchen Titel/URL/Kategorie (Wortgrenzen beachten: „ki" trifft
  nicht „Kino"). Tags in der Seitenleiste filtern direkt; Drag & Drop auf eine Gruppe
  ergänzt deren Gruppen-Tags.
- **UI-Modi:** „**Minimiert starten**" (Einstellungen) bzw. Minimieren-Button aktiviert den
  **Kompaktmodus** — eine schlanke Schnellzugriffs-Leiste mit den Favoriten-Kategorien
  (☆ an jeder Kategorie oder in den Einstellungen festlegen) inklusive Schnellsuche,
  Hinzufügen und Palette.
- **Command-Palette (Strg+F, konfigurierbar):** Durchsucht Befehle und Lesezeichen;
  Taste **A** ordnet einen Link einer Kategorie/Gruppe zu (mit Cross-Link-Hinweis als
  Toast). Navigation per ↑↓/Enter/Esc.
- **Design-Überarbeitung:** neues, cleanes Design mit eigenen SVG-Icons (kein Emoji-Look),
  raffinierter Typografie, feinen Borders, dunklem/hellem Modus und funktionierenden
  Mikro-Interaktionen (gestaffelte Listen-Animation, Hover-Lift, Drag-Feedback,
  Toast-Benachrichtigungen, Fokus-Ringe, `prefers-reduced-motion` wird respektiert).

### Bestand (v1.0/1.1)

- **Import** von Browser-Lesezeichen (Netscape-HTML aus Chrome, Firefox, Edge, Brave)
  und JSON-Backups — Ordnerstruktur wird als Kategorien übernommen; alte v1-Exporte
  werden automatisch migriert.
- **Auto-Kategorisierung** (transparent & editierbar): Domain-/Schlüsselwort-Regeln
  ordnen jeden Link automatisch zu. **Ein Link darf in mehreren Kategorien leben.**
  Passt keine Regel, wird automatisch eine neue Kategorie angelegt.
- **Dynamische Sammlungen**: „Neu heute", „Neu (7 Tage)", „GitHub", „KI-Tools",
  „Angepinnt", „Ohne Kategorie" — immer aktuell berechnet.
- **Live-Suche** über Titel, URL, Tags und Kategorienamen (mehrere Wörter = UND).
- **Sortierung**: Angepinnt zuerst, innerhalb der Gruppen stets jüngstes zuerst.
- **Empfehlungen**: kuratierte große Link-Datenbanken zum Ein-Klick-Übernehmen.
- **Export**: JSON (Backup, ohne API-Schlüssel), Netscape-HTML (Browser-Import), Markdown.
- **PWA**: installierbar und offlinefähig (Service Worker).

## Bedienung (Kurzfassung)

1. Im Browser Lesezeichen als HTML exportieren → in der App **Import → Lesezeichen-HTML**
   (KI-Strukturierung ist standardmäßig aktiv).
2. Nach dem Import: unbekannte Begriffe im Dialog „Was genau meinst du damit?" definieren —
   damit wachsen Tags, Kategorien und Cross-Verlinkungen sofort mit.
3. **Glossar** pflegen, **#Gruppen** anlegen (z. B. „#TOP KI"), Favoriten (☆) setzen und
   bei Bedarf „Minimiert starten" aktivieren.
4. Links per **Drag & Drop** auf Kategorien/Gruppen ziehen oder **Strg+F** → Taste A.

## Technik

| Baustein | Wahl |
|---|---|
| Build | Vite 7 |
| UI | React 19 + TypeScript (strikt), eigene SVG-Icons, handgeschriebenes CSS-Designsystem |
| Persistenz | localStorage (`bdm-state-v1`, versionierter Zustand v2) bzw. chrome.storage im Add-on |
| KI-Strukturierung | Lokale Engine (`src/ai/engine.ts`) + optionales API-Routing (`src/ai/router.ts`, OpenAI-kompatibel, Fallback lokal) |
| Glossar/Cross-Link | `src/glossary.ts`, `src/crosslink.ts` (gemeinsame Begriffe → automatische Verknüpfung) |
| Hashtag-Gruppen | `src/groups.ts` (dynamische Zuordnung, Wortgrenzen) |
| Offline | minimaler Service Worker (`public/sw.js`, Cache `bdm-v1.2.0`) + Manifest |
| Hosting | GitHub Pages (statisch, kostenlos) |

Keine externen Anfragen zur Laufzeit (außer der optional vom Nutzer konfigurierten
KI-API): keine Favicon-Dienste, keine Analysen, keine Cloud — die Lesezeichen
verlassen das Gerät nur, wenn selbst exportiert wird.

## Entwicklung

```bash
bun install
bun run dev       # Entwicklungsserver
bun run test      # Typ-Check + Logik-Tests (Cross-Link, Gruppen, Migration, Engine)
bun run build     # Typ-Check + Produktiv-Build nach dist/
bun run preview   # Build lokal ansehen
```

Struktur: `src/types.ts` (Datenmodell v2) · `src/rules.ts` (Standard-Regeln) ·
`src/categorizer.ts` (Regel-Zuordnung) · `src/ai/engine.ts` (lokale KI-Analyse +
Glossar-Lernvorschläge) · `src/ai/router.ts` (lokal/API-Routing mit Fallback) ·
`src/glossary.ts` / `src/crosslink.ts` (Glossar & Cross-Mapping) · `src/groups.ts`
(dynamische Hashtag-Gruppen) · `src/shortcut.ts` (konfigurierbarer Shortcut) ·
`src/applyBookmark.ts` (gemeinsame Speicher-Logik) · `src/parser/netscape.ts`
(Browser-Import) · `src/exporter.ts` (JSON/HTML/Markdown) ·
`src/hooks/useBookmarks.ts` (State) · `src/storage.ts` (localStorage/chrome.storage,
Migration v1→v2) · `src/components/*` (UI inkl. Palette, Glossar, Einstellungen) ·
`extension/` (Add-on) · `src-tauri/` (Windows-Wrapper) ·
`scripts/test-logic.ts` (Logik-Tests).

```bash
bun run build        # Web-App (dist/)
bun run build:ext    # Browser-Add-on + ZIPs (dist-ext/, releases/)
bun run build:desktop && bunx tauri build   # Windows-EXE + Installer
```

## Grenzen (bewusst)

- Daten liegen pro Browser-Gerät; Sync zwischen Geräten erfolgt über JSON-Export/-Import.
- Die lokale KI-Engine ist heuristisch (deterministisch, offline, kostenlos) — kein
  Sprachmodell. Wer mehr will, trägt in den Einstellungen eine eigene API ein.
- Cross-Verlinkungen werden aus dem Glossar **berechnet** (abgeleitet), nicht kopiert —
  ändern sich die Begriffsketten, aktualisieren sich die Verknüpfungen sofort.
