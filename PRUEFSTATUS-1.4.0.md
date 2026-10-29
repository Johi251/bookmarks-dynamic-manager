# Bookmarks Dynamic Manager 1.4.0 — Nachprüfung 29.10.2026

executed: Die lokale Reparaturversion 1.4.0 wurde erneut geprüft. Sie enthält die zuvor integrierten Ergänzungen und Fehlerkorrekturen. Der Gesamtumfang ist noch nicht auf allen Plattformen praktisch abgenommen.

## Erneut geprüft

- executed: `bun run test` — strikte Typprüfung, 78 ursprüngliche Logikprüfungen und 28 Regression-/Worker-/DOM-Tests bestanden; keine Fehler.
- executed: `cargo test --manifest-path src-tauri/Cargo.toml --lib --offline` — alle drei nativen Tests bestanden.
- executed: `bun run build`, `bun run build:ext` und `bun run build:portable-web` — erfolgreich. Chrome-/Firefox-ZIPs und relative Web-Ausgabe neu erstellt.
- live verified: 93 Laufzeit-, Ressourcen- und native Quelldateien einschließlich Paket-/Lockdateien stimmen mit dem vorigen geprüften Paket überein. Seit dessen Windows-Build wurden diese Dateien nicht verändert.
- live verified: Die ausgelieferte portable Windows-EXE und der Installer entsprechen bytegenau den vorhandenen erfolgreichen Windows-Builds vom 28.10.2026. Sie wurden heute nicht erneut gebaut und sind unsigniert.
- executed: Veraltete Aussagen zur ausstehenden GitHub-Freigabe in README und Architektur korrigiert. Die Freigabe für dieses Projekt wurde am 29.10.2026 erteilt.

## Online-Stand

- live verified: GitHub `main` enthält bei dieser Nachprüfung weiterhin Paketversion 1.3.0: https://github.com/Johi251/bookmarks-dynamic-manager/blob/main/package.json .
- live verified: Die öffentliche Web-App liefert weiterhin den Service-Worker-Cache `bdm-v1.3.0` über HTTP 200: https://johi251.github.io/bookmarks-dynamic-manager/sw.js .
- executed: Dieser Prüf-/ZIP-Auftrag hat keine Veröffentlichung und keinen Remote-Build ausgelöst. Die lokale Version 1.4.0 ist weiter als der öffentliche Stand.

## Umfang des Gesamtpakets

- Quellcode mit Bun-/Cargo-Lockdateien, Tests, Buildskripten und manueller CI-Pipeline.
- Statische Web-App mit relativen Pfaden, zur Bereitstellung über HTTP.
- Windows-x64-Installer und portable Windows-App mit WebView2-Voraussetzung.
- Chrome-/Chromium- und Firefox-Erweiterungen.
- Startanleitung und dieser Prüfstatus.

executed: Entwicklungsabhängigkeiten, persönliche Lesezeichenbestände, Git-Historie und lokale Testdaten gehören nicht in dieses Auslieferungspaket. Abhängigkeiten werden bei Entwicklung anhand der Lockdateien installiert. Das Archiv ist keine vollständige Kopie des Arbeitsverzeichnisses.

## Verbleibende Grenzen

- not verified: Native macOS-/Linux-Ausgaben fehlen; die vorbereitete CI-Pipeline ist noch nicht veröffentlicht oder ausgeführt.
- not verified: Echte Windows-Fensterbedienung und Installation in Browserprofilen sind bisher nicht visuell abgenommen. Die frühere Computersteuerung stoppte; sie wurde in dieser Nachprüfung nicht erneut eingesetzt.
- not verified: Der vollständige Ablauf gegen reale laufende aKlik-/copyNpaste-Gegenstellen und eine echte Vision-API ist nicht abgenommen. Die vorhandenen Regressionstests verwenden für diese Teile kontrollierte Simulationen.
- executed: Windows ist unsigniert. Firefox ist ohne Mozilla-Signierung temporär installierbar.
- executed: Keine automatische Synchronisierung der getrennten Datenbestände von Web, Desktop und Add-on.

inferred: Lokaler Quellstand und Paketierung sind konsistent und die erneuten Prüfungen bestanden. „Alle Plattformen vollständig fertig und online aktuell“ ist damit nicht belegt.
