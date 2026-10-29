# Bookmarks Dynamic Manager

Lokale Lesezeichenverwaltung mit Mehrfachkategorien, Glossar, dynamischen Gruppen, Import/Export, Statistik und optionaler KI-Unterstützung.

**Lokaler Entwicklungsstand: 1.4.0.** Bei der erneuten Prüfung am 29.10.2026 stehen der GitHub-Quellstand und die [öffentliche Web-App](https://johi251.github.io/bookmarks-dynamic-manager/) weiterhin auf 1.3.0. Die projektbezogene GitHub-Freigabe wurde am 29.10.2026 erteilt; die Aktualisierung wurde noch nicht veröffentlicht. Der aktuelle Nachweis ist in diesem Quellpaket unter `PRUEFSTATUS-1.4.0.md` enthalten.

## Änderungen in 1.4.0

- Backup-Aufbewahrung korrigiert: Die acht neuesten Sicherungstage bleiben erhalten. Der Zeitstempel wird erst nach erfolgreicher IndexedDB-Transaktion gesetzt. Die Wochenprüfung läuft bei geöffneter App jede Minute; ein leerer Erststart verbraucht kein Intervall.
- CSV erhält pro Link die richtigen Kategorien und verarbeitet mehrzeilige Felder. Zusätzliche JSON-Spalten erhalten das vollständige Datenmodell mit Glossar, Gruppen, Regeln, Kategoriehierarchie und Einstellungen. Auch leere Sammlungen lassen sich vollständig sichern.
- JSON-Dateien werden vor der Übernahme geprüft. Kategorie-IDs und Elternreferenzen bleiben beim Zusammenführen konsistent. Beschädigte gespeicherte Bestände werden nicht still durch einen leeren Bestand überschrieben.
- Schreibfehler erscheinen sichtbar; fehlgeschlagene Änderungen bleiben als ungespeichert erkennbar. Der KI-Schlüssel wird im Add-on getrennt vom exportierbaren Zustand über Extension-Speicher bereitgestellt.
- Statistik, Aktivität, Öffnungszähler, sechs Sortierungen, Mehrfachaktionen und Rückgängig/Wiederholen sind vollständig an die Oberfläche angeschlossen. Dublettenbereinigung bezieht sich auf identische URLs, erhält Tags/Kategorien/Notizen und lässt sich mit einem Schritt zurücknehmen.
- Spicy-Orange-Design, rundes Link-/Haken-Logo und sechs kreisförmige Schnellzugriffe; Desktop- und Add-on-Icons aus demselben SVG.
- Today's Hunt empfängt copyNpaste-URLs in der Desktop-App über den vorhandenen lokalen Webhook. Die Eingänge werden erst nach erfolgreichem Speichern im Manager quittiert.
- Die aKlik-Status-Bridge ist in Desktop/Add-on angebunden. Statische Erkennungen tragen ausdrücklich den Zusatz „Hinweis“. Die Bereitstellungsaktion öffnet die Prüfung im laufenden lokalen aKlik-Deployer.
- Add-on-Pakete verwenden portable ZIP-Pfade und entfernen keine Windows-Pakete mehr. Ausgaben werden pro Version getrennt abgelegt.

## Kernfunktionen

- Import von Netscape-HTML aus Chrome, Edge, Brave und Firefox; Ordnerübernahme, automatische Mehrfachkategorisierung und Duplikaterkennung.
- Live-Suche in Titel, URL, Tags und Kategorien; Smart Views für neue, angepinnte und zuletzt verwendete Links sowie Today's Hunt.
- Hinzufügen, Bearbeiten, Anpinnen, Tags und manuelle Zuordnung; Drag-and-drop auf Kategorien oder dynamische Gruppen.
- Lokale Textanalyse beim HTML-Import; optional eine eigene OpenAI-kompatible API mit lokalem Fallback.
- Glossar mit Begriffsketten und Lernvorschlägen. Gemeinsame Glossarattribute erzeugen sichtbare Cross-Verlinkungen ohne doppelte Lesezeichen.
- Dynamische Hashtag-Gruppen, konfigurierbare Befehlspalette und Kompaktmodus mit Favoriten.
- Favicon-Kette Google S2 → Icon.horse → lokaler Buchstabenavatar; Netzabrufe sind abschaltbar.
- JSON, vollständige CSV, Browser-HTML und Markdown als Exportformate.
- Remotion-Player mit 16:9- und 9:16-Templates, Requisitenexport und lokaler CLI-Ausgabe als MP4.

## Ausgabeformen und Installation

Der lokale Releaseordner für 1.4.0 enthält die portable Windows-EXE, einen NSIS-Installer, Chrome-/Firefox-Add-on-ZIPs und das Gesamtpaket. Siehe die mitgelieferte Übergabeanleitung.

- **Windows:** Portable EXE starten oder Installer verwenden. WebView2 wird benötigt. Die Pakete sind nicht signiert.
- **Chrome/Edge/Brave:** ZIP entpacken, Entwicklermodus unter `chrome://extensions`, „Entpackte Erweiterung laden“.
- **Firefox:** ZIP entpacken und temporär über `about:debugging` laden. Eine dauerhafte Installation benötigt Mozilla-Signierung.
- **Web:** Statische Dateien per HTTP bereitstellen. Das Gesamtpaket enthält einen Build mit relativen Pfaden; ES-Module nicht über `file://` öffnen.
- **Mac/Linux:** Tauri-Konfiguration und manuell auslösbarer Build-Workflow sind vorbereitet. Bis ein passender Runner sie tatsächlich erzeugt und geprüft hat, werden keine nativen Mac-/Linux-Pakete als fertig bezeichnet.

## Lokale Integrationen

Die Desktop-App lauscht ausschließlich auf `127.0.0.1:9911` und verarbeitet `POST /api/todays-hunt` aus copyNpaste. Der bestehende copyNpaste-Sender nutzt diesen Endpunkt bereits. Der Eingang ist lokal gespeichert, begrenzt und gegen Browseranfragen mit Origin sowie fremde Hostnamen abgesichert. Ist der Port belegt, zeigt die App einen Empfangshinweis.

Der lokale aKlik-Deployer läuft auf Port 43110. Desktop und Add-on können dessen lesende Status-Bridge nutzen. Die blaue Bereitstellungsaktion öffnet die lokale aKlik-Prüfung; der eigentliche Start erfolgt dort nach Prüfung. Keine Repository-Befehle werden allein durch das Importieren eines Lesezeichens ausgeführt. Eine statische Homepage-/Docker-Erkennung ist kein Beleg für eine kostenlose lauffähige Anwendung.

Web-Hosting aktiviert keinen stillen Zugriff auf lokale Dienste. Today's Hunt benötigt die laufende Desktop-App.

## Datenschutz und Grenzen

Der Bestand liegt lokal im jeweiligen Browser-/WebView-/Extension-Profil. Zwischen Web-App, Desktop und Add-on findet keine automatische Synchronisierung statt; JSON und CSV dienen dem Austausch.

Bei aktivierten Favicons werden Domains an Google beziehungsweise Icon.horse angefragt. Die Repository-Analyse fragt öffentliche GitHub-Daten ab. Eine konfigurierte KI-API erhält beim Smart Import die betreffenden Links und Glossarbegriffe; bei ausdrücklich aktiviertem Vision-Modus außerdem Seitenbilder. Die Nutzungsbedingungen und Kosten der eigenen KI-API sind gesondert zu prüfen. Ohne API bleibt die lokale Heuristik verfügbar.

Der KI-Schlüssel bleibt außerhalb des exportierbaren Zustands. Lokale Speicherung bedeutet keine Verschlüsselung. Browser-/Profildatenlöschung kann Bestand und lokale Snapshots entfernen.

Die Wochenroutine läuft nur bei geöffneter App. Sie ist kein Betriebssystemdienst. MP4-Rendering benötigt die lokale Entwicklungsumgebung; Vorschau und Requisitenexport sind in den ausgelieferten Oberflächen vorhanden.

## Entwicklung und Prüfung

Voraussetzungen: Node 24+, Bun, für native Builds Rust und die Tauri-Systemvoraussetzungen des Zielsystems.

```sh
bun install --frozen-lockfile
bun run test
bun run dev
bun run build
bun run build:ext
bun run build:portable-web
bunx tauri build --bundles nsis
cargo test --manifest-path src-tauri/Cargo.toml --lib
bun run render:video props.json
bun run package:all
```

Bun ist der Paketmanager; der reparierte Bun-Lockfile ist maßgeblich. Der veraltete npm-Lockfile wurde in den Papierkorb verschoben.

Der aktuelle Prüfstand umfasst Typprüfung, 78 ursprüngliche Logikprüfungen, 28 zusätzliche Regression-/Service-Worker-/DOM-Tests und drei Rust-Tests. Beide Videoformate wurden als MP4 gerendert. Die DOM-Prüfung bestätigt den Weg vom simulierten copyNpaste-Eingang über das Speichern bis zur Quittierung sowie Mehrfachaktionen und Undo. Sie ersetzt keine visuelle Browserabnahme.

Die native Fensterbedienung und die Installation in echten Browserprofilen sind noch nicht neu visuell abgenommen. Die verwendete Computersteuerung konnte die aktuelle Chrome-Adresse nicht sicher erkennen und beendete den Zugriff.
