# 🔖 Bookmarks Dynamic Manager

Eine lokale, private Web-App zur Verwaltung von Lesezeichen mit **automatischer
Multi-Kategorisierung**, Live-Suche und **dynamischen Sammlungen**. Alle Daten
bleiben im eigenen Browser (localStorage) — kein Account, kein Server, keine Kosten.

**Live:** <https://johi251.github.io/bookmarks-dynamic-manager/>

## Downloads & Installation

Die App gibt es in drei Formen — alle nutzen denselben Datenbestand (JSON-Import/Export
kompatibel; Automatische Kategorisierung identisch):

| Form | Download | Installation |
|---|---|---|
| **Web-App (PWA)** | <https://johi251.github.io/bookmarks-dynamic-manager/> | Direkt öffnen; im Browser „Installieren“ wählen → wirkt wie eine App, offlinefähig |
| **Windows-App** | <https://github.com/Johi251/bookmarks-dynamic-manager/releases/tag/v1.1.0>: `BookmarksDynamicManager.exe` (portabel) oder `Bookmarks.Dynamic.Manager_1.0.0_x64-setup.exe` (Installer) | EXE direkt starten bzw. Installer ausführen (nutzt WebView2, auf Windows 10/11 vorinstalliert) |
| **Browser-Add-on** | Release-Bereich: `bookmarks-dynamic-manager-chrome.zip` (Chrome/Brave/Edge) und `bookmarks-dynamic-manager-firefox.zip` | Entpacken → `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“; Firefox: `about:debugging` → „Add-on temporär laden“ |

Add-on-Funktionen: Popup-Button „★ Diese Seite speichern“, Rechtsklick-Kontextmenü
und Tastenkürzel **Strg+Shift+S** — jeder gespeicherte Link wird sofort automatisch
(multi-)kategorisiert; die komplette Verwaltung öffnet über „Manager öffnen“.


## Funktionen

- **Import** von Browser-Lesezeichen (Netscape-HTML aus Chrome, Firefox, Edge, Brave)
  und JSON-Backups — Ordnerstruktur wird als Kategorien übernommen.
- **Auto-Kategorisierung** (transparent & editierbar): Domain-/Schlüsselwort-Regeln
  ordnen jeden Link automatisch zu. **Ein Link darf in mehreren Kategorien leben**
  (z. B. ein GitHub-KI-Repo unter *GitHub*, *KI* **und** *KI-Agenten-Tools*).
  Passt keine Regel, wird automatisch eine neue Kategorie angelegt.
- **Dynamische Sammlungen**: „Neu heute", „Neu (7 Tage)", „GitHub", „KI-Tools",
  „Angepinnt", „Ohne Kategorie" — immer aktuell berechnet.
- **Live-Suche** über Titel, URL, Tags und Kategorienamen (mehrere Wörter = UND).
- **Sortierung**: Angepinnt zuerst, innerhalb der Gruppen stets jüngstes zuerst.
- **Empfehlungen**: kuratierte große Link-Datenbanken (PromptBase, FreeStuff.dev,
  Free for Developers, Awesome-Listen …) zum Ein-Klick-Übernehmen.
- **Export**: JSON (Backup), Netscape-HTML (zurück in den Browser importierbar),
  Markdown-Liste.
- **PWA**: installierbar und offlinefähig (Service Worker). Helles/dunkles Design.

## Bedienung

1. Im Browser: Lesezeichen exportieren (Chrome/Brave: Lesezeichen-Manager → ⋮ →
   „Lesezeichen exportieren"; Firefox: „Lesezeichen nach HTML exportieren").
2. In der App: **⬆ Import → Lesezeichen-HTML** wählen — fertig.
3. Regeln unter **⚙ Regeln** ansehen/anpassen; mit „Speichern & alles neu
   kategorisieren" den Gesamtbestand neu ordnen.

## Technik

| Baustein | Wahl |
|---|---|
| Build | Vite 7 |
| UI | React 19 + TypeScript (strikt) |
| Persistenz | localStorage (`bdm-state-v1`), versioniert |
| Kategorisierung | deterministische Regel-Engine im Client (`src/categorizer.ts`, `src/rules.ts`) — keine externen Aufrufe |
| Offline | minimaler Service Worker (`public/sw.js`) + Manifest |
| Hosting | GitHub Pages (statisch, kostenlos) |

Keine externen Anfragen zur Laufzeit: keine Favicon-Dienste, keine Analysen,
keine Cloud — die Lesezeichen verlassen das Gerät nur, wenn selbst exportiert wird.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # Typ-Check + Produktiv-Build nach dist/
npm run preview  # Build lokal ansehen
```

Struktur: `src/types.ts` (Datenmodell) · `src/rules.ts` (Standard-Regeln) ·
`src/categorizer.ts` (Zuordnung) · `src/applyBookmark.ts` (gemeinsame Speicher-Logik
für App und Add-on) · `src/parser/netscape.ts` (Browser-Import) ·
`src/exporter.ts` (JSON/HTML/Markdown) · `src/hooks/useBookmarks.ts` (State) ·
`src/storage.ts` (localStorage / chrome.storage-Adapter) ·
`src/components/*` (UI) · `extension/` (Add-on: Manifest, Popup, Background) ·
`src-tauri/` (Windows-Wrapper) · `ANFORDERUNGEN.md` (lokal: konsolidierte Anforderung).

```bash
npm run build        # Web-App (dist/)
npm run build:ext    # Browser-Add-on + ZIPs (dist-ext/, releases/)
npx tauri build      # Windows-EXE + Installer (src-tauri/target/release/)
```

## Grenzen (bewusst)

- Daten liegen pro Browser-Gerät; Sync zwischen Geräten erfolgt über JSON-Export/-Import.
- Auto-Kategorisierung ist regelbasiert (deterministisch, offline, kostenlos) —
  kein Sprachmodell, keine API-Kosten.
