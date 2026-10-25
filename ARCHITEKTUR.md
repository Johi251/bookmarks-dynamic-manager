# Architektur — Bookmarks Dynamic Manager

Stand: 2026-10-25 · v1.3.0 · Status: `live verified` (lokal verifiziert; Live-Verifikation nach Deployment)

## Entscheidungen und Begründung

| Frage | Entscheidung | Warum |
|---|---|---|
| Web-App oder Add-on? | Alle drei: PWA + Tauri-2-Windows-App + MV3-Add-on | Eine Codebasis, drei Ausgabeformen; Auftrag v1.1–v1.3 verlangte Windows-EXE und Add-on-ZIPs zusätzlich zur Web-App. |
| Backend/Cloud? | Nein — localStorage/IndexedDB / chrome.storage | Dauerhaft kostenlos, keine Datensphäre; JSON/CSV-Export/-Import deckt Sync ab. |
| KI-Kategorisierung? | Lokale Engine + optionales API-Routing | Deterministische Heuristik (Tags, Glossar, Regeln) ist offline, gratis, erklärbar; der Router erlaubt eine eigene OpenAI-kompatible API und fällt bei Fehlern auf lokal zurück. Kein API-Schlüssel im App-Zustand (separater localStorage-Key, nie im Export). |
| Vision (v1.3)? | Screenshot nur im Add-on, OpenAI-kompatible Schnittstelle | `captureVisibleTab` braucht activeTab (Gesten-getriggert) — nur das Add-on darf/oll schießen; Modell konfigurierbar (Standard `glm-5.3-flash`), Fallback lokale Text-Engine. Screenshots lokal (chrome.storage, max. 12, 640 px JPEG). |
| 1Clicker-Status (v1.3)? | Statische Klassifikation + gedrosselte GitHub-API | Nutzungswege (🟢 online / 🔵 lokal / 🟠 checking) zuerst offline aus URL/Titel/Tags; Repositories werden im Hintergrund über die freie GitHub-API verfeinert (Homepage, Pages, Releases, Dockerfile) — 1,5 s Abstand, max. 25/Sitzung, 60 req/h Limit ohne Token; Re-Check nach 14 Tagen. Ergebnis steht auf dem Bookmark (Persistenz + Export), Scheitern lässt 🟠 stehen. |
| Favicons (v1.3)? | Kette Google S2 → Icon.horse → CSS-Buchstabe | Echte 64×64-Logos mit sauberem Fallback; funktionierende Quelle wird pro Host gecacht (`bdm-favicon-v1`, max. 500), Abschaltbar in den Einstellungen (Privatsphäre). |
| Video (v1.3)? | Remotion 4, Player in-app + CLI-Render außerhalb | Exakte Vorschau im Browser via `@remotion/player` (Lazy-Chunk, lädt nur bei Öffnung); MP4-Encoding braucht Headless-Encoding → `@remotion/bundler`+`renderer` als CLI (`bun run render:video`), Datenfluss per Requisiten-JSON aus dem Studio. |
| Backup (v1.3)? | Wochen-Snapshots in IndexedDB + JSON/CSV | IndexedDB ohne Größenproblem der localStorage-Quota; 8 Generationen; CSV Excel-DE-kompatibel (Semikolon, BOM, Quote-Escaping, Roundtrip-getestet). |
| Glossar & Cross-Link? | Abgeleitete (berechnete) Verknüpfungen | Cross-Links werden aus gemeinsamen Glossar-Begriffen live berechnet statt gespeichert — Änderungen am Glossar wirken sofort, kein Daten-Duplikat. |
| Dynamische Gruppen? | Match-Terms statt fester Mitgliedschaft | Gruppen wie „#TOP KI" scannen den Bestand bei jedem Render; `#Term` matcht Tags, freie Terme den Text mit Wortgrenzen. |
| Framework | Vite 7 + React 19 + TypeScript (strikt) | Mainstream-Stabilität; TS-strict für fehlerarmes Datenmodell. |
| Styling | Handgeschriebenes CSS (Custom Properties, SVG-Icon-Set) | Keine UI-Abhängigkeit; v1.3-Designsystem im Linear/Vercel-Stil: Near-Black-Flächen, 1px-neutrale Borders, Glas-Flächen (`backdrop-blur`), Status-Glows, `prefers-reduced-motion`-Fallback. |
| Hosting | GitHub Pages | Kostenlos, stabil, `gh` CLI; Repo enthält ausschließlich App-Code. |

## Datenmodell (Kern, v3)

```
Bookmark      { id, title, url, added(ms), tags[], categoryIds[], pinned, note?, clicker? }
ClickerInfo   { status: checking|online|local|none, kind: repo|web|docker|portable|cmd,
                checkedAt?, launchUrl?, repo?{owner,name,cloneUrl}, reason? }   // NEU v1.3
Category      { id, name, parentId, source: import|auto|manual|rule|seed }
CategorizeRule{ id, pattern, kind: domain|keyword, categories[], enabled }
GlossaryEntry { id, term, definition, related[], createdAt }          // v1.2
DynamicGroup  { id, name, terms[], createdAt }                        // v1.2
AppSettings   { favorites[], startMinimized, aiProvider, aiEndpoint, aiModel,
                clickerEnabled, faviconsEnabled,                      // NEU v1.3
                visionOnSave, visionModel, autoBackup }               // NEU v1.3
AppState      { version: 3, bookmarks[], categories[], rules[], glossary[], dynamicGroups[], settings }
```

- Migration: `storage.ts:migrateState()` hebt v1/v2-Zustände (und alte JSON-Exporte beim
  Import) transparent auf v3 an — inkl. statischer 1Clicker-Klassifikation jedes
  Software-/Repository-Links und neuer Settings-Defaults (idempotent).
- API-Schlüssel liegt bewusst außerhalb des Zustands (`bdm-ai-key`) und erscheint
  niemals im JSON/CSV-Export.

## 1Clicker-Status-Engine (v1.3)

`oneclicker.ts`, zwei Phasen:

1. **Statisch & synchron** (`classifyClicker`) — Reihenfolge bewusst: lokale Signale
   (START-1CLICKER.cmd → Docker → portable) schlagen Repository-Checking vor, danach
   gehostete Web-App (vercel.app, github.io, huggingface.space …), dann Repo → 🟠.
   Reine Artikel erhalten keine Badge (`undefined`).
2. **Asynchron** (`refineRepo`, nur GitHub) — API-Antwort: Homepage → 🟢 · has_pages →
   🟢 (owner.github.io/repo) · Release-Asset .exe/.zip → 🔵 portable · Dockerfile im
   Default-Branch (raw.githubusercontent HEAD-Check als Offline-Fallback) → 🔵 docker ·
   Signale in Description/Topics → 🔵 · sonst `none` (analysiert, keine Badge).
   Fehler (offline/Rate-Limit) → Status bleibt 🟠, nächster App-Start prüft erneut.

Queue: `App.tsx`-Effect, gedrosselt (`CLICKER_QUEUE_DELAY_MS` 1,5 s), Session-Limit 25,
Ergebnis per `updateBookmark(id, {clicker})` — Persistenz über den normalen Zustand.
UI: `ClickerBadge` (🟢 Klick → `window.open(launchUrl)`; 🔵 Klick → `ClickerDialog`
mit `deploySteps`-Rezept: Clone-/Compose-Befehle zum Kopieren, Release-Links).

## Favicon-Kette (v1.3)

`favicon.ts` (Logik, testbar) + `components/Favicon.tsx`: Quelle pro Host gemerkt →
`<img onError>` kaskadiert s2 → horse → Buchstaben-Avatar (`avatarColorOf`, 8 kuratierte
gedeckte Farben, deterministisch aus Host-Hash). `faviconsEnabled: false` = nie Netz.

## Vision (v1.3, Add-on)

`background.ts:saveCurrentTab` — nach erfolgreichem Speichern und nur wenn
`visionOnSave && aiProvider==='api'`: `captureVisibleTab` (activeTab) → `downscaleShot`
(OffscreenCanvas, 640 px, JPEG 0.55) → `storeShot` (LRU 12 in `bdm-shots-v1`) →
`ai/vision.ts:analyzeScreenshot` (image_url-Payload, JSON-Antwort tags/categories/visual,
45 s Timeout) → merge in Bookmark-Tags/-Kategorien. Jeder Fehler ist nicht-fatal.

## Remotion-Video-Engine (v1.3)

- `src/video/types.ts`: Dauer-Formel (75f Intro + 82f/Bookmark + 75f Outro @ 30 fps).
- `src/video/shared.tsx`: Farb-/Typo-System, Background-Lichter, StatusChip (🟢/🔵/🟠),
  Feder-Spring-Hooks.
- `src/video/Walkthrough16x9.tsx` (Template A, 1920×1080) · `Short9x16.tsx`
  (Template B, 1080×1920, vertikaler Fortschrittsbalken).
- In-App: `components/VideoStudio.tsx` mit `@remotion/player` (React.lazy — separater
  Chunk), Auswahl-Scopes (top/pinned/online/local), Requisiten-JSON-Export.
- CLI: `video/` (registerRoot, calculateMetadata) + `scripts/render-video.mjs`
  (bundle → selectComposition → renderMedia h264).

## Backup-Routine (v1.3)

`backup.ts`: `isBackupDue` (7 Tage, rein) → `writeSnapshot` (IndexedDB `bdm-backups`,
Key = ISO-Datum, Kappe 8, letzter Lauf in localStorage) → Settings-UI listet Snapshots
(Wiederherstellen über `importState(replace)` / Herunterladen / Löschen). CSV:
`exportCsv` (Semikolon + BOM + Quote-Escaping, Spalten inkl. 1Clicker-Status) /
`importCsv` (Delimiter-Erkennung ; / , / Tab, Duplikat- und Ungültig-Zählung) →
Reducer-Aktion `importCsv`.

## KI-Strukturierung (Smart Import, v1.2)

1. Parser (Netscape-HTML) → Links + Ordner-Kategorien.
2. Regel-Engine (Multi-Kategorie) wie bisher; v1.3: Clicker-Klassifikation gleich mit.
3. `ai/engine.ts` (lokal): Meta-Tags aus Titel-Tokens (Stopwörter de/en, camelCase-Split),
   Domain-Kern, Glossar-Begriffe + verwandte Themen; Kategorievorschläge aus Glossar-Treffern.
4. `ai/router.ts`: Provider-Dispatch. API (OpenAI-kompatibel, JSON-Mode, 40er-Batches,
   25s-Timeout) wird in ImportDialog vorab berechnet und als Map (URL→Analyse) an den
   Reducer übergeben; Reducer fällt pro Link auf lokale Engine zurück, wenn kein Eintrag.
5. Glossar-Lernen: `suggestGlossaryTerms()` erkennt markante unbekannte Begriffe
   (Ziffern, Kürzel, camelCase, Eigenname ≥2 Vorkommen) → Dialog „Was genau meinst du
   damit?" → `glossaryUpsert` wendet Tags/Kategorien sofort auf Treffer an.

## Cross-Verlinkung (v1.2)

`crosslink.ts`: Für jede direkte Kategorie eines Links wird der Glossar-Eintrag gesucht;
(a) eigene verwandte Themen und (b) andere Glossar-Begriffe mit gemeinsamen Themen
(Token-Vergleich, „SMMA" ∈ „MEME SMMA") werden auf Kategorien-/Gruppennamen gemappt.
Ergebnis: Liste `{kind, id, name, via[]}` — rein abgeleitet, in der Listenansicht als
eigener Abschnitt „Verknüpft über Glossar" (gestrichelte Karten, via-Angabe) und im
Toast nach Zuordnung sichtbar.

## Qualitätssicherung (nachweisbar)

- **Logik-Tests** (`scripts/test-logic.ts`, `bun run test`): 78 Prüfungen — Migration
  v1/v2→v3 (inkl. Clicker-Anhängen), Glossar-Matching („ki" trifft nicht „Kino"),
  Cross-Link-Auftragsbeispiel (JayTX ↔ ROFLnator.90 via SMMA, inkl. Gruppen-Ziel),
  Hashtag-Gruppen (Wortgrenzen, Tag-Match), KI-Engine (Tags, keine Duplikate,
  Glossar-Kandidaten), Shortcut-Roundtrip, **1Clicker-Klassifikation** (Repo→checking,
  Docker/portable/cmd→local, hosted→online, Signalreihenfolge, Re-Check-Fenster,
  Deploy-Rezepte), **CSV-Roundtrip** (Sonderzeichen, Semikolon, Duplikate, Status),
  **Backup-Fenster** (6/7/8 Tage), **Favicon-Kette** (URLs, Kette, Host-Norm,
  deterministische Avatare).
- **GUI-Test** v1.0 (Browser, schwarzer Kasten): T1–T9 bestanden; v1.2 erneuter
  Durchlauf; v1.3: GUI-Verifikation der Badges/Favicons/Studio siehe STATUS.md.
- **Parser-Test** gegen echten Chrome-Export (1,8 MB): 11/11 PASS (v1.0, unverändert).
- **Typ-Check**: `tsc --noEmit` strict ohne Befehle; Teil jedes Builds.

## Deployment

- Build: `bun run build` → `dist/` (Base `/bookmarks-dynamic-manager/`), `bun run build:ext`
  → `dist-ext/` + `releases/*.zip`, `bun run build:desktop && bunx tauri build` →
  Windows-EXE + NSIS-Installer. Video: `bun run studio` / `bun run render:video`.
- `main`-Branch: Quellcode; `gh-pages`-Branch: `dist/`-Inhalt (Publish wie v1.2 auf
  ausdrückliche Anweisung des Auftrags).
