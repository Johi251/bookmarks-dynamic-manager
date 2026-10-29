# Architektur — Bookmarks Dynamic Manager 1.4.0

Stand: 28.10.2026. Ausführbare Prüfergebnisse und Grenzen sind in der Übergabeanleitung und im Reparaturnachweis festgehalten.

## Aufbau und Datenfluss

Eine React-/TypeScript-Oberfläche wird als statische Web-App, Manifest-V3-Add-on und Tauri-Desktop-App gebaut. Das Datenmodell bleibt Version 3; bestehende gültige v1/v2/v3-Bestände werden migriert. Die Produktversion ist 1.4.0.

Die Verwaltung verwendet einen zentralen Reducer mit begrenzter Undo-/Redo-Historie. Mehrfachaktionen und Dubletten-Merge sind atomare Historieneinträge. Öffnungszähler werden auch in den Historienständen aktualisiert und gehen beim Zurücknehmen einer anderen Aktion nicht verloren.

Die Speicherung ist asynchron bestätigt: Web/Desktop verwenden localStorage, das Add-on chrome.storage.local. Schreibfehler werden an den Hook weitergegeben. Er hält den Zustand als ungespeichert und bietet Wiederholen beziehungsweise Export an. Bei defekten Ladebeständen startet keine automatische Überschreibung.

Importierte Objekte werden auf Pflichtfelder, URL-Protokolle, IDs, Referenzen und zyklische Kategoriehierarchien geprüft. Zusammenführungen bilden zunächst Kategorie-IDs einschließlich Elternpfaden ab und übernehmen danach die Lesezeichen. Gleiche Namen in unterschiedlichen Zweigen bleiben getrennt.

## Export und Sicherung

JSON enthält den vollständigen Zustand. CSV enthält lesbare Linkspalten plus strukturierte App-/Lesezeichendaten für einen vollständigen Roundtrip. Der Parser verarbeitet zitierte mehrzeilige Felder und erhält die Kategorien pro Datensatz. Der API-Schlüssel gehört nicht zum exportierten Zustand.

IndexedDB-Snapshots werden erst nach dem erfolgreichen Transaktionsabschluss als geschrieben behandelt. Die acht neuesten Sicherungstage bleiben erhalten. Das Wochenintervall wird bei geöffnetem Manager jede Minute und nach Bestandsänderungen geprüft. Der leere Erststart setzt keinen Sicherungszeitstempel.

## KI und Vision

Die lokale Textengine arbeitet offline. Der optionale Router und die Vision-Schnittstelle erwarten eine selbst konfigurierte OpenAI-kompatible API. Eine externe kostenlose Nutzung wird nicht zugesichert. Im Add-on wird der Schlüssel asynchron aus dem separaten Extension-Speicher gelesen; bestehende Manager-Schlüssel werden beim Öffnen der Einstellungen übernommen.

Screenshot-Verkleinerung benutzt OffscreenCanvas und Blob-Bytes statt FileReader. Die zuletzt gespeicherten zwölf Bilder bleiben lokal. Ein Lesezeichen wird vor der optionalen Vision-Analyse gesichert. Eine spätere Anreicherung liest den neuesten Zustand erneut, um zwischenzeitliche Änderungen zu erhalten.

## aKlik und Today's Hunt

Statische Nutzungsweg-Badges sind Hinweise. Desktop und Add-on fragen zusätzlich die lokale aKlik-Status-Bridge auf Port 43110 ab. Ergebnisse müssen zum angefragten Repository und zum bekannten Protokoll passen. Eine neue heuristische Verfeinerung übernimmt keine frühere Verifikation ungeprüft.

Die Bereitstellungsaktion öffnet die lokale aKlik-Prüfung. Der Start fremder Software wird nicht durch einen Bookmark-Import ausgelöst. Kopierbare Compose-Anleitungen behaupten keine universelle Port-/Konfigurationsgarantie.

Der native Empfänger nimmt begrenzte JSON-POSTs von copyNpaste auf Port 9911 entgegen. Er akzeptiert nur Loopback-Hostnamen und keine Browser-Origin. Lesezeichen mit fremden URL-Schemata oder eingebetteten Zugangsdaten werden verworfen. Eingänge liegen in einer atomar ersetzten lokalen JSON-Ablage. Die Oberfläche liest über Tauri-IPC, speichert im eigenen Bestand und quittiert erst anschließend. Ein fehlgeschlagenes Speichern lässt den Eingang erhalten.

## Oberfläche und Ausgaben

Statistik, Sortierung, Mehrfachaktionen und Shortcuts sind an den zentralen Zustand angeschlossen. Die kreisförmige Schnellwahl besitzt sechs zugängliche Aktionsbuttons und einen beschrifteten Toggle. Große Videokomponenten werden bei Bedarf unter einer Suspense-Grenze geladen. Der Kompaktmodus kann auch den lokalen Bereitstellungsdialog öffnen.

Die Native- und Add-on-Icons stammen aus dem orangefarbenen SVG. Paketierung verwendet ausschließlich standardisierte UTF-8-ZIP-Pfade. Der Paketierer löscht keine vorherigen Releases. Tauri-, Web- und Add-on-Versionen sind einheitlich 1.4.0.

Windows wird lokal gebaut. Der manuell startbare Workflow enthält Windows-, Mac- und Linux-Builds; deren Existenz als Workflow beweist keine erfolgreiche Ausführung. Ein Gesamt-ZIP darf fehlende Mac-/Linux-Binaries nicht als fertig darstellen.

## Aktuelle Grenzen

- Die Web-Auslieferung auf GitHub ist am 29.10.2026 weiterhin 1.3.0. Die projektbezogene Freigabe liegt inzwischen vor; die Aktualisierung wurde noch nicht veröffentlicht.
- Mac/Linux benötigen einen tatsächlich ausgeführten Zielsystem-Build und eine eigene Abnahme.
- Kein Cloud-Sync zwischen den lokalen Beständen.
- Keine kostenlose oder kompatible KI-API ohne konkrete Providerprüfung zugesichert.
- Keine visuelle Browser-/native Fensterabnahme durch den blockierten Computerzugriff.
