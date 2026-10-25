# 🔖 Bookmarks Dynamic Manager

Eine lokale, private Web-App zur Verwaltung von Lesezeichen mit **automatischer
Multi-Kategorisierung**, Live-Suche und **dynamischen Sammlungen**. Alle Daten
bleiben im eigenen Browser (localStorage) — kein Account, kein Server, keine Kosten.

**Live:** <https://johi251.github.io/bookmarks-dynamic-manager/>

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
`src/categorizer.ts` (Zuordnung) · `src/parser/netscape.ts` (Browser-Import) ·
`src/exporter.ts` (JSON/HTML/Markdown) · `src/hooks/useBookmarks.ts` (State) ·
`src/components/*` (UI) · `ANFORDERUNGEN.md` (lokal: konsolidierte Anforderung).

## Grenzen (bewusst)

- Daten liegen pro Browser-Gerät; Sync zwischen Geräten erfolgt über JSON-Export/-Import.
- Auto-Kategorisierung ist regelbasiert (deterministisch, offline, kostenlos) —
  kein Sprachmodell, keine API-Kosten.
