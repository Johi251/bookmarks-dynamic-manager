# Architektur — Bookmarks Dynamic Manager

Stand: 2026-10-25 · v1.2.0 · Status: `live verified` (lokal verifiziert; Live-Verifikation nach Deployment)

## Entscheidungen und Begründung

| Frage | Entscheidung | Warum |
|---|---|---|
| Web-App oder Add-on? | Alle drei: PWA + Tauri-2-Windows-App + MV3-Add-on | Eine Codebasis, drei Ausgabeformen; Auftrag v1.1/v1.2 verlangte Windows-EXE und Add-on-ZIPs zusätzlich zur Web-App. |
| Backend/Cloud? | Nein — localStorage / chrome.storage | Dauerhaft kostenlos, keine Datensphäre; JSON-Export/-Import deckt Sync ab. |
| KI-Kategorisierung? | Lokale Engine + optionales API-Routing | Deterministische Heuristik (Tags, Glossar, Regeln) ist offline, gratis, erklärbar; der Router erlaubt eine eigene OpenAI-kompatible API und fällt bei Fehlern auf lokal zurück. Kein API-Schlüssel im App-Zustand (separater localStorage-Key, nie im Export). |
| Glossar & Cross-Link? | Abgeleitete (berechnete) Verknüpfungen | Cross-Links werden aus gemeinsamen Glossar-Begriffen live berechnet statt gespeichert — Änderungen am Glossar wirken sofort, kein Daten-Duplikat. |
| Dynamische Gruppen? | Match-Terms statt fester Mitgliedschaft | Gruppen wie „#TOP KI" scannen den Bestand bei jedem Render; `#Term` matcht Tags, freie Terme den Text mit Wortgrenzen. |
| Framework | Vite 7 + React 19 + TypeScript (strikt) | Mainstream-Stabilität; TS-strict für fehlerarmes Datenmodell. |
| Styling | Handgeschriebenes CSS (Custom Properties, SVG-Icon-Set) | Keine UI-Abhängigkeit, kein generischer Framework-Look; Mikro-Interaktionen (Stagger, Hover-Lift, Toasts) mit `prefers-reduced-motion`-Fallback. |
| Hosting | GitHub Pages | Kostenlos, stabil, `gh` CLI; Repo enthält ausschließlich App-Code. |

## Datenmodell (Kern, v2)

```
Bookmark      { id, title, url, added(ms), tags[], categoryIds[], pinned, note? }
Category      { id, name, parentId, source: import|auto|manual|rule|seed }
CategorizeRule{ id, pattern, kind: domain|keyword, categories[], enabled }
GlossaryEntry { id, term, definition, related[], createdAt }          // NEU v1.2
DynamicGroup  { id, name, terms[], createdAt }                        // NEU v1.2
AppSettings   { favorites[], startMinimized, aiProvider, aiEndpoint, aiModel }
AppState      { version: 2, bookmarks[], categories[], rules[], glossary[], dynamicGroups[], settings }
```

- Migration: `storage.ts:migrateState()` hebt v1-Zustände (und alte JSON-Exporte beim
  Import) transparent auf v2 an (Glossar/Gruppen leer, Settings default).
- API-Schlüssel liegt bewusst außerhalb des Zustands (`bdm-ai-key`) und erscheint
  niemals im JSON-Export.

## KI-Strukturierung (Smart Import, v1.2)

1. Parser (Netscape-HTML) → Links + Ordner-Kategorien.
2. Regel-Engine (Multi-Kategorie) wie bisher.
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

- **Logik-Tests** (`scripts/test-logic.ts`, `bun run test`): 35 Prüfungen — Migration
  v1→v2, Glossar-Matching („ki" trifft nicht „Kino"), Cross-Link-Auftragsbeispiel
  (JayTX ↔ ROFLnator.90 via SMMA, inkl. Gruppen-Ziel), Hashtag-Gruppen (Wortgrenzen,
  Tag-Match), KI-Engine (Tags, keine Duplikate, Glossar-Kandidaten), Shortcut-Roundtrip.
  Debugging-Funde dabei: laxer Substring-Match („ki"→„Kino") und camelCase-Filter nach
  Lowercasing — beide korrigiert (Prüfergebnis ging vor).
- **GUI-Test** v1.0 (Browser, schwarzer Kasten): T1–T9 bestanden (Erstansicht,
  Demo-Import, Live-Suche, dynamische Sammlung, Kategorie-Baum, Live-Auto-Kategorisierung,
  Empfehlungen, Import-Dialog, Regel-Editor). v1.2: erneuter GUI-Durchlauf siehe STATUS.md.
- **Parser-Test** gegen echten Chrome-Export (1,8 MB): 11/11 PASS (v1.0, unverändert).
- **Typ-Check**: `tsc --noEmit` strict ohne Befehle; Teil jedes Builds.

## Deployment

- Build: `bun run build` → `dist/` (Base `/bookmarks-dynamic-manager/`), `bun run build:ext`
  → `dist-ext/` + `releases/*.zip`, `bun run build:desktop && bunx tauri build` →
  Windows-EXE + NSIS-Installer.
- `main`-Branch: Quellcode; `gh-pages`-Branch: `dist/`-Inhalt (v1.2-Publish erfolgt nur
  auf ausdrückliche Anweisung).
