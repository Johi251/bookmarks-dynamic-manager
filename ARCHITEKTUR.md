# Architektur — Bookmarks Dynamic Manager

Stand: 2026-10-25 · Status: `live verified` (lokal verifiziert; Live-Verifikation nach Deployment)

## Entscheidungen und Begründung

| Frage | Entscheidung | Warum |
|---|---|---|
| Web-App oder Add-on? | Statische Web-App (PWA) | Aktuelle Anweisung (25.10.2026) bevorzugt „Frontend + serverless"; eine reine Static-Site ist wartungsfrei, kostenlos hostbar und ohne Store-Freigabe sofort nutzbar. Ein Add-on ließe sich später aus derselben Codebasis bauen. |
| Backend/Cloud? | Nein — localStorage | Der Betrieb bleibt dauerhaft kostenlos (kein Serverless-Kontingent, kein Account), und Lesezeichen sind privat: sie verlassen das Gerät nicht. Serverloses Backend (z. B. Cloud Functions + KV) wäre nur für geräteübergreifenden Sync nötig; JSON-Export/-Import deckt das ohne Infrastruktur ab. |
| KI-Kategorisierung? | Deterministische Regel-Engine | Kostenlos, offline, sofort, erklärbar und vom Nutzer editierbar (GUI „Regeln"). Multi-Label-Kategorisierung über mehrere Regel-Treffer; Fallback: automatisch neue Kategorie pro Domain. Ein LLM-Aufruf pro Link wäre kostenpflichtig/latenzbehaftet und hätte Datensphären-Implikationen. |
| Framework | Vite 7 + React 19 + TypeScript | Recherche 2026-10: Vite ist der Standard-Build (CRA gilt als beendet), React 19 der stabile Mainstream; TS strikt für ein fehlerarmes Datenmodell. |
| Styling | Handgeschriebenes CSS (Custom Properties, Color-Schemes) | Keine UI-Abhängigkeit, kleine Bundle-Größe (80 KB gzip gesamt), keine Breaking-Changes durch Framework-Upgrades. |
| Hosting | GitHub Pages | Kostenlos, stabil, per `gh` CLI automatisiert; Nutzer hat GitHub Pages explizit als Beispiel genannt. Vercel/Netlify wären gleichwertig, waren aber nicht eingerichtet. Repo enthält ausschließlich App-Code — keine Secrets, keine echten Lesezeichendaten. |

## Datenmodell (Kern)

```
Bookmark   { id, title, url, added(ms), tags[], categoryIds[], pinned, note? }
Category   { id, name, parentId, source: import|auto|manual|rule|seed }
CategorizeRule { id, pattern, kind: domain|keyword, categories[], enabled }
AppState   { version: 1, bookmarks[], categories[], rules[] }   // localStorage „bdm-state-v1"
```

- **Multi-Kategorie** ist Datensatz-Eigenschaft (`categoryIds[]`), keine Kopie des Links.
- Kategorien bilden einen Baum (`parentId`); Seitenleisten-Zähler schließen
  Unterkategorien ein (Aggregation über `deepIds`).
- Import: Netscape-HTML → Ordner werden Kategorien (`source: 'import'`), Links
  behalten ADD_DATE (Unix-s → ms, Plausibilitätsprüfung), TAGS, URL-Deduplizierung.

## Regel-Engine

1. Domain-Regeln: Muster (Teilstring) gegen Hostnamen.
2. Schlüsselwort-Regeln: Muster gegen `host + pfad + titel` (kleingeschrieben).
3. Treffer sammeln (Mehrfachzuordnung), Ordnerherkunft ergänzen.
4. Fallback: keine Kategorie erkannt → neue Kategorie „<domain>" (Wunsch: „wenn es
   keine Kategorie davon gibt, dann neue anlegen").
5. „Alles neu kategorisieren" wendet die Regeln erneut auf den Gesamtbestand an.

## Qualitätssicherung (nachweisbar)

- **GUI-Test** (Browser, schwarzer Kasten): T1 Erstansicht/Layout, T2 Demo-Import +
  Sortierung, T3 Live-Suche, T4 dynamische Sammlung „KI-Tools" (6/14), T5 Kategorie-
  Filter inkl. Baum, T6 Hinzufügen mit Live-Auto-Kategorisierung (GitHub-Test-URL →
  „GitHub · KI · KI-Agenten-Tools") + Speichern, T7 Empfehlungen übernehmen,
  T8 Import-Dialog (HTML/JSON, Dropzone), T9 Regel-Editor (27 Regeln). Bestanden;
  visuelle Prüfung per Screenshots (`.data/screenshots/`, lokal).
- **Parser-Test** gegen echten Chrome-Export (1,8 MB): 11/11 PASS — 1382 Links
  (530 Duplikate erkannt), 41 Ordner/40 Unterkategorien, Datumsplausibilität,
  HTML-Export-Roundtrip (50/50), Markdown-Export, Duplikatzählung.
  Gefundene und behobene Fehler dabei: (a) tolerante Parser betten `<dt>` in das
  offene `<p>` des Chrome-Formats → transparente P-Behandlung; (b) Attribute wie
  `HREF` großgeschrieben → case-insensiver Attributzugriff.

## Deployment

- Build: `npm run build` → `dist/` (Base-Pfad `/bookmarks-dynamic-manager/`).
- `main`-Branch: Quellcode; `gh-pages`-Branch: ausschließlich `dist/`-Inhalt.
- Aktivierung + Verifikation via `gh` CLI/API und Live-Abruf.
