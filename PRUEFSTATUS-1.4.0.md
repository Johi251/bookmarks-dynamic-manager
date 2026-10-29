# Bookmarks Dynamic Manager 1.4.0 — Auslieferungsprüfung 29.10.2026

executed: Version 1.4.0 ist repariert und auf GitHub veröffentlicht; die Web-App liefert 1.4.0 aus. Native Windows-, Linux- und beide Mac-Ausgaben sind gebaut und gestartet. Die nachstehenden Belege ersetzen frühere Aussagen über fehlende Plattform-Builds oder eine ausstehende GitHub-Freigabe.

## Funktionale Prüfungen

- executed: Strikte TypeScript-Prüfung, 78 ursprüngliche Logikprüfungen und 29 zusätzliche Regression-/Worker-/DOM-Tests bestanden; insgesamt 107 JavaScript-Prüfungen. Drei Rust-Tests auf jedem nativen Zielsystem bestanden.
- live verified: Native CI erfolgreich für Windows x64, macOS Apple Silicon, macOS Intel und Linux amd64. Auf jedem Runner wurde das gebaute Programm tatsächlich gestartet. Ein echter HTTP-Testlink wurde erst nach Speicherung durch die laufende Oberfläche über native IPC quittiert.
- live verified: Das echte Chrome-ZIP wurde in isoliertem Chromium geladen. Hintergrund-Worker, Speichern, Dubletten, Bestand nach Neuladen, Statistik, sechs Schnellaktionen, Popup und Manager-Link bestanden.
- live verified: Das Firefox-ZIP wurde in Firefox 158 temporär installiert. Die Mindestversion ist wegen optionaler Host-Freigaben auf 128 korrigiert. Mozillas Linter meldet null Fehler und drei Warnungen.
- executed: Die Warnungen betreffen die noch fehlende Datenverarbeitungsdeklaration für eine spätere Mozilla-Store-Einreichung sowie zwei React-interne innerHTML-Zuweisungen. Im eigenen Anwendungscode wird die betreffende React-Schnittstelle nicht mit unbereinigten Inhalten verwendet.
- live verified: Windows-Statistik, orange Oberfläche und sechs Schnellaktionen zusätzlich über die echte native Fensteroberfläche geprüft.
- live verified: Die reale lokale aKlik-Bridge 1.1.0 wurde angesprochen. Der Adapter behandelt das Ergebnis needs_review korrekt als unbestätigt. Keine falsche grüne Verfügbarkeitszusage.
- live verified: Der native Empfänger auf Port 9911 nahm einen gültigen copyNpaste-Protokollaufruf an. Die Warteschlange wechselte nach erfolgreicher Speicherung von einem Eintrag auf null.
- executed: Beide Videoformate wurden bereits als echte MP4s gerendert und mit ffprobe geprüft: H.264, 232 Frames, Quer- und Hochformat.

## Öffentliche Belege

- Quellcode: https://github.com/Johi251/bookmarks-dynamic-manager
- Web-App: https://johi251.github.io/bookmarks-dynamic-manager/
- Downloads: https://github.com/Johi251/bookmarks-dynamic-manager/releases/tag/v1.4.0
- Native Tests und Builds: https://github.com/Johi251/bookmarks-dynamic-manager/actions/runs/40799265080
- Echter Chromium-Test: https://github.com/Johi251/bookmarks-dynamic-manager/actions/runs/40800413845
- Temporäre Firefox-Installation: https://github.com/Johi251/bookmarks-dynamic-manager/actions/runs/40800920328

executed: Native Programme stammen aus dem geprüften Laufzeitstand 4c14298. Spätere Änderungen betreffen Testwerkzeuge, Dokumentation, Paketierung und die Firefox-Mindestversion. Der native Laufzeitcode bleibt identisch; bitgenaue Reproduzierbarkeit wird nicht behauptet.

## Zusätzlich beim Abschluss behoben

- executed: Ein alter WebView-Cache zeigte beim Start zunächst eine frühere Oberfläche. Der Desktop verwendet jetzt einen versionsgebundenen Einstieg und entfernt frühere PWA-Worker. Web-PWA und Desktop-Bootstrap sind getrennt.
- executed: Der Shortcut-Test akzeptiert die plattformgerechte Ctrl-Beschriftung auf Mac und Windows.
- executed: Frische native CI-Builds erzeugen die eingebettete Oberfläche vor den Rust-Tests.
- executed: Native Downloads werden direkt als Release-Dateien übertragen, ohne zusätzlichen Actions-Artefaktspeicher.

## Inhalt des Gesamtpakets

- Quellcode, Tests, Lockdateien und Build-/Prüfworkflows.
- Statische Web-App mit relativen Pfaden für HTTP-Auslieferung.
- Windows-x64-Installer und portable Windows-App; WebView2 erforderlich.
- Mac-DMGs für Apple Silicon und Intel.
- Linux-amd64-DEB und AppImage.
- Chrome-/Chromium- und Firefox-Erweiterungen.
- Startanleitung und dieser Prüfstatus.

executed: Persönliche Bestände, Zugangsschlüsseldateien, Entwicklungsabhängigkeiten, Git-Historie und lokale Testdaten sind nicht Bestandteil des Auslieferungsarchivs.

## Grenzen der Abnahme

- executed: Windows ist unsigniert, Mac nicht notarisiert, Firefox temporär installierbar. Die Veröffentlichung in Browser-Stores und Signaturen sind nicht enthalten.
- not verified: Die CI-Starttests starten die nativen Programme direkt. Sie prüfen keine Installer-Dialoge, Gatekeeper-Abfragen oder vollständige manuelle Fensterbedienung auf jedem Betriebssystem.
- not verified: Firefox-WebDriver untersagt Navigation in den geschützten moz-extension-Kontext. Die temporäre Installation ist bestätigt; die vollständige Firefox-Fensterbedienung ist nicht abgenommen.
- not verified: Der gesamte tatsächliche copyNpaste-Clipboard-/Shortcut-Ablauf konnte wegen gleichzeitiger Eingaben am Rechner nicht abgeschlossen werden. Das reale Empfangs-/Speicher-/Quittierungsprotokoll ist geprüft.
- not verified: Keine echte externe Vision-API wurde aufgerufen. Sie bleibt optional und muss mit bewusst gewähltem Provider und dessen Kostenbedingungen geprüft werden.
- executed: Web-App, Desktop und Add-on haben getrennte lokale Bestände; keine automatische Cloud-Synchronisierung.
