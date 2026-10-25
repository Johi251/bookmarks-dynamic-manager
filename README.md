# Bookmarks Dynamic Manager

Eine lokale, private App zur Verwaltung von Lesezeichen mit **1Clicker-Status-Engine**,
**KI-Import-Strukturierung**, **Glossar mit Cross-Verlinkung**, **dynamischen Hashtag-Gruppen**,
**echten Webseiten-Logos**, **Remotion-Video-Studio** und **wöchentlicher Auto-Sicherung**.
Alle Daten bleiben auf dem eigenen Gerät (localStorage/IndexedDB bzw. chrome.storage) —
kein Account, kein Server, keine Kosten.

**Live (v1.3.0):** <https://johi251.github.io/bookmarks-dynamic-manager/>

## Downloads & Installation

Die App gibt es in drei Formen — alle nutzen denselben Datenbestand (JSON-Import/Export
kompatibel; Kategorisierung identisch):

| Form | Download | Installation |
|---|---|---|
| **Web-App (PWA)** | <https://johi251.github.io/bookmarks-dynamic-manager/> | Direkt öffnen; im Browser „Installieren“ wählen → wirkt wie eine App, offlinefähig |
| **Windows-App** | [Release v1.3.0](https://github.com/Johi251/bookmarks-dynamic-manager/releases/tag/v1.3.0): [`BookmarksDynamicManager.exe`](https://github.com/Johi251/bookmarks-dynamic-manager/releases/download/v1.3.0/BookmarksDynamicManager.exe) (portabel) oder [`Bookmarks.Dynamic.Manager_1.3.0_x64-setup.exe`](https://github.com/Johi251/bookmarks-dynamic-manager/releases/download/v1.3.0/Bookmarks.Dynamic.Manager_1.3.0_x64-setup.exe) (Installer) | EXE direkt starten bzw. Installer ausführen (nutzt WebView2, auf Windows 10/11 vorinstalliert) |
| **Browser-Add-on** | [Release v1.3.0](https://github.com/Johi251/bookmarks-dynamic-manager/releases/tag/v1.3.0): [`…-chrome.zip`](https://github.com/Johi251/bookmarks-dynamic-manager/releases/download/v1.3.0/bookmarks-dynamic-manager-chrome.zip) (Chrome/Brave/Edge) und [`…-firefox.zip`](https://github.com/Johi251/bookmarks-dynamic-manager/releases/download/v1.3.0/bookmarks-dynamic-manager-firefox.zip) | Entpacken → `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“; Firefox: `about:debugging` → „Add-on temporär laden“ |

Add-on-Funktionen: Popup-Button „Diese Seite speichern“, Rechtsklick-Kontextmenü
und Tastenkürzel **Strg+Shift+S** — jeder gespeicherte Link wird sofort automatisch
(multi-)kategorisiert und mit einer 1Clicker-Nutzungsweg-Badge versehen; optional wird
ein **Screenshot** der Seite gezogen und vom **Vision-Modell** (Standard GLM-5.3 Flash)
verschlagwortet. Die komplette Verwaltung öffnet über „Manager öffnen“.

## Funktionen

### Neu in v1.3.0

- **1Clicker-Protokoll & Status-Engine:** Jedes Software-/Repository-Lesezeichen erhält
  eine leuchtende Nutzungsweg-Badge (Logik des 1Clicker-Werkzeugkastens):
  🟠 **blinkend „Checking“** — das Repository wird im Hintergrund analysiert (statische
  Signale + öffentliche GitHub-API, gedrosselt, max. 25/Sitzung) ·
  🟢 **leuchtend „Online“** — mit 1 Klick kostenlos im Browser nutzbar (Homepage,
  GitHub-Pages-Demo, gehostete Web-App); Klick auf die Badge öffnet die Live-Anwendung ·
  🔵 **leuchtend „Lokal“** — mit 1 Klick kostenlos lokal nutzbar (Docker, portable
  Windows-Assets oder `START-1CLICKER.cmd`); Klick auf die Badge öffnet die
  Bereitstellungs-Schritte (Clone-/Docker-Befehle zum Kopieren, Release-Downloads).
  Die Statuswerte werden pro Lesezeichen in der lokalen Datenbank gehalten und
  asynchron aktualisiert (Re-Check nach 14 Tagen). Zwei neue dynamische Sammlungen
  filtern den Bestand nach „1Clicker · Online“ und „1Clicker · Lokal“.
- **Echte Favicons statt Platzhalter:** Jedes Lesezeichen zeigt das echte Webseiten-Logo
  (64×64) über eine Favicon-Kette — Google S2 → Icon.horse — mit Quellen-Cache pro Host.
  Scheitern beide, erzeugt die App ein minimalistisches CSS-Icon aus dem Anfangsbuchstaben
  der Domain mit deterministisch gedeckter Farbpalette. In den Einstellungen abschaltbar
  (dann rein lokale Buchstaben-Avatare, keine Netzwerk-Anfragen).
- **Premium-SaaS-Design:** Fundamentaler Design-Rewrite (Stilvorbild Linear /
  Vercel-Dashboard): Near-Black-Flächen mit ultradünnen neutralen Borders,
  Glas-Flächen mit `backdrop-blur` (Topbar, Modals, Palette, Toasts), edle reduzierte
  Typografie, Gradient-Marke, leuchtende Status-Glows und flüssige Übergänge bei Hover,
  Klick und Drag-and-Drop — `prefers-reduced-motion` wird respektiert.
- **Multimodale Vision (Browser-Add-on):** Beim Speichern einer Seite kann das Add-on
  optional einen Screenshot der sichtbaren Seite ziehen (activeTab, auf 640 px
  verkleinert, lokal gespeichert) und über eine OpenAI-kompatible Vision-Schnittstelle
  vom visuellen Inhalt her verschlagworten und ins Glossar einordnen lassen
  (Standard-Modell: **GLM-5.3 Flash**; einstellbar; Fallback auf die lokale Engine).
- **Remotion-Video-Engine:** Zwei Timeline-Templates für automatisierte
  Lesezeichen-Präsentationen — **Template A: 16:9 „Walkthrough“** (1920×1080, YouTube)
  und **Template B: 9:16 „Short“** (1080×1920, TikTok/Shorts). Das in-app
  **Video-Studio** (Film-Button) zeigt die exakte Render-Vorschau (Remotion Player),
  Auswahl nach Top/Angepinnt/Online/Lokal; das MP4-Kompilieren läuft lokal über die
  Render-Pipeline (`bun run render:video props.json`), inkl. eigenem Remotion Studio
  (`bun run studio`).
- **Auto-Backup-Routine:** Vollständiger Export des erweiterten Datenmodells als
  **JSON** und **CSV** (Excel-kompatibel, Semikolon + BOM, inkl. Tags, Kategorien,
  Notizen und 1Clicker-Status) plus **CSV-Import**. Eine rein lokale, **wöchentliche
  Auto-Sicherung** legt Snapshots in IndexedDB (die letzten 8 Wochen) — wiederherstellen,
  herunterladen oder löschen im Einstellungen-Tab „Backup & Export“.

### Bestand (v1.0–1.2)

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
- **Intelligente Cross-Verlinkung (Cross-Mapping):** Da „JayTX" das Thema „SMMA" enthält
  und „ROFLnator.90" ebenfalls „SMMA", erscheint ein JayTX-Link automatisch auch bei
  „ROFLnator.90" — gekennzeichnet als *verknüpft via SMMA* (gestrichelte Karte, ohne
  Duplikat im Datenbestand).
- **Dynamische Tag- & Gruppen-Sortierung (Hashtag-Manager):** Gruppen wie „#TOP KI"
  scannen den Bestand autonom — `#Tag` matcht Tags, freie Begriffe matchen
  Titel/URL/Kategorie (Wortgrenzen beachten: „ki" trifft nicht „Kino").
- **UI-Modi & Command-Palette:** **Minimiert starten** (schlanke Schnellzugriffs-Leiste
  mit Favoriten-Kategorien), Palette per **Strg+F** (konfigurierbar) mit Zuordnung per
  Taste **A**.
- **Import/Export:** Netscape-HTML (Chrome/Firefox/Edge/Brave), JSON-Sicherung,
  HTML-Export zurück in den Browser, Markdown. Alte v1/v2-Exporte werden automatisch
  auf v3 migriert (inkl. 1Clicker-Klassifikation).
- **Auto-Kategorisierung** (transparent & editierbar), **Multi-Kategorien**,
  **Live-Suche**, **Anpinnen**, **Empfehlungen**, **PWA/offlinefähig**.

## Bedienung (Kurzfassung)

1. Im Browser Lesezeichen als HTML exportieren → in der App **Import → Lesezeichen-HTML**
   (KI-Strukturierung ist standardmäßig aktiv).
2. Nach dem Import: unbekannte Begriffe im Dialog „Was genau meinst du damit?" definieren —
   damit wachsen Tags, Kategorien und Cross-Verlinkungen sofort mit.
3. **Badges nutzen:** 🟢 anklicken öffnet die Live-Anwendung, 🔵 anklicken zeigt die
   lokale Bereitstellung (Befehle kopieren, Releases öffnen). 🟠 analysiert im Hintergrund
   von selbst fertig.
4. **Video-Studio** (Film-Button): Format 16:9 oder 9:16 wählen, Auswahl treffen,
   Vorschau ansehen, Requisiten-JSON exportieren und per Render-Pipeline kompilieren.
5. **Backup**: Einstellungen → „Backup & Export" — wöchentliche Snapshots laufen von
   selbst; JSON/CSV jederzeit exportieren/importieren.
6. Links per **Drag & Drop** auf Kategorien/Gruppen ziehen oder **Strg+F** → Taste A.

## Technik

| Baustein | Wahl |
|---|---|
| Build | Vite 7 |
| UI | React 19 + TypeScript (strikt), eigene SVG-Icons, handgeschriebenes CSS-Designsystem (Linear/Vercel-Stil) |
| Persistenz | localStorage/IndexedDB (`bdm-state-v1`, versionierter Zustand v3) bzw. chrome.storage im Add-on |
| 1Clicker-Engine | `src/oneclicker.ts` — statische Klassifikation (offline) + GitHub-API-Verfeinerung (gedrosselt) + Bereitstellungs-Rezepte |
| Favicons | `src/favicon.ts` — Kette Google S2 → Icon.horse → CSS-Buchstaben-Avatar, Quellen-Cache pro Host |
| KI | Lokale Engine (`src/ai/engine.ts`) + API-Routing (`src/ai/router.ts`) + Vision (`src/ai/vision.ts`, OpenAI-kompatibel, GLM-5.3 Flash) |
| Video | Remotion 4 — Templates `src/video/` (16:9 + 9:16), Player im App-Build, CLI-Render `scripts/render-video.mjs` |
| Backup | `src/backup.ts` — CSV-Export/-Import, Wochen-Snapshots in IndexedDB (8 Generationen) |
| Glossar/Cross-Link | `src/glossary.ts`, `src/crosslink.ts` (gemeinsame Begriffe → automatische Verknüpfung) |
| Hashtag-Gruppen | `src/groups.ts` (dynamische Zuordnung, Wortgrenzen) |
| Offline | minimaler Service Worker (`public/sw.js`, Cache `bdm-v1.3.0`) + Manifest |
| Hosting | GitHub Pages (statisch, kostenlos) |

Externe Anfragen zur Laufzeit nur bei aktivierten Komfort-Funktionen und immer nur an
freie Dienste: GitHub-API (1Clicker-Analyse), Google S2/Icon.horse (Favicons) sowie die
optional selbst konfigurierte KI-/Vision-API. Alles ist in den Einstellungen abschaltbar.

## Entwicklung

```bash
bun install
bun run dev            # Entwicklungsserver
bun run test           # Typ-Check + 78 Logik-Tests (1Clicker, CSV, Migration, Engine …)
bun run build          # Typ-Check + Produktiv-Build nach dist/
bun run build:ext      # Browser-Add-on + ZIPs (dist-ext/, releases/)
bun run build:desktop && bunx tauri build   # Windows-EXE + Installer
bun run studio         # Remotion Studio (Video-Templates)
bun run render:video props.json             # MP4 rendern (Requisiten aus dem Video-Studio)
```

Struktur: `src/types.ts` (Datenmodell v3, 1Clicker-Infos) · `src/oneclicker.ts`
(Nutzungsweg-Engine) · `src/favicon.ts` + `src/components/Favicon.tsx` (Logo-Kette) ·
`src/video/*` (Remotion-Templates) · `src/components/VideoStudio.tsx` (Player-UI) ·
`video/` (Remotion-Einstieg für Studio/CLI) · `scripts/render-video.mjs` (Render-Pipeline) ·
`src/backup.ts` (CSV + Wochen-Snapshots) · `src/ai/vision.ts` (Screenshot-Analyse) ·
`src/rules.ts` · `src/categorizer.ts` · `src/ai/engine.ts` · `src/ai/router.ts` ·
`src/glossary.ts` / `src/crosslink.ts` · `src/groups.ts` · `src/shortcut.ts` ·
`src/applyBookmark.ts` · `src/parser/netscape.ts` · `src/exporter.ts` ·
`src/hooks/useBookmarks.ts` · `src/storage.ts` (Migration v1/v2→v3) ·
`src/components/*` · `extension/` (Add-on, MV3) · `src-tauri/` (Windows-Wrapper) ·
`scripts/test-logic.ts` (Logik-Tests).

## Grenzen (bewusst)

- Daten liegen pro Browser-Gerät; Sync zwischen Geräten erfolgt über JSON-Export/-Import.
- Die lokale KI-Engine ist heuristisch (deterministisch, offline, kostenlos) — kein
  Sprachmodell. Wer mehr will, trägt in den Einstellungen eine eigene API ein.
- Die 1Clicker-Hintergrundanalyse nutzt die öffentliche GitHub-API ohne Token
  (60 Anfragen/Stunde) — deshalb gedrosselt; offline bleibt die Badge auf „Checking“
  stehen, bis die nächste Sitzung prüft. Ein erkannter Nutzungsweg ist ein statischer
  Hinweis, keine Garantie für Kostenfreiheit des Betriebs.
- Das MP4-Rendering läuft bewusst außerhalb der Browser-App (Remotion-CLI) — dort steht
  ein kompletter Encoder zur Verfügung; die App liefert Vorschau + Requisiten.
