# Bookmarks Dynamic Manager 1.4.0

## Windows

Unter `Downloads` liegt die portable `BookmarksDynamicManager.exe` und der Windows-Installer. Beide verwenden WebView2. Die Dateien sind nicht signiert.

## Browser-Add-ons

Das passende Chrome- beziehungsweise Firefox-ZIP entpacken. Chrome/Edge/Brave: Entwicklermodus unter `chrome://extensions` und „Entpackte Erweiterung laden“. Firefox ab Version 128: temporär über `about:debugging`. Für eine dauerhafte Firefox-Installation fehlt weiterhin die Mozilla-Signierung.

KI/Vision ist optional. In den Einstellungen den eigenen OpenAI-kompatiblen Endpunkt und das Modell eintragen. Das Add-on fragt Zugriff auf diesen Endpunkt an. Erst bei bewusst aktiviertem Vision-Modus werden Seitenbilder an diese API gesendet. Die Nutzungskosten des eigenen Providers sind dessen Vertragsbedingungen zu entnehmen; das Programm verspricht keine kostenlose externe KI.

## Web-App

Der Ordner `Web-App` enthält den aktuellen statischen Build mit relativen Pfaden. Er muss über einen HTTP-Server bereitgestellt werden; `index.html` nicht als Datei doppelklicken. Aus dem Quellcode: `bun install --frozen-lockfile`, anschließend `bun run dev`.

Die öffentliche GitHub-Pages-Seite ist auf Version 1.4.0 aktualisiert.

## Mac und Linux

Im Ordner `Downloads` liegen DMGs für Apple Silicon (`aarch64`) und Intel (`x64`) sowie Linux-DEB und AppImage für amd64. Für Mac die passende Architektur wählen. Unter Linux das DEB über die Paketverwaltung installieren oder das AppImage ausführbar machen und starten. Die Mac-Ausgaben sind nicht notarisiert.

Die GitHub-Actions-Pipeline hat alle vier Plattformen gebaut und die Programme tatsächlich gestartet. Der Test bestätigt den HTTP-Empfang, das Speichern in der laufenden Oberfläche und die Quittierung über native IPC. Installer-Dialoge und betriebssystemspezifische Sicherheitsabfragen werden dadurch nicht abgenommen.

Auf einem Mac beziehungsweise Linux-System mit Rust, Node 24+, Bun und den Tauri-Systemvoraussetzungen: `bun install --frozen-lockfile`, `bun run test`, `bunx tauri build`. Auf dem Mac entstehen App/DMG; unter Linux die konfigurierten nativen Pakete. Eine Mac-Notarisierung oder Codesignatur ist nicht enthalten.

## Today's Hunt und aKlik

Die Desktop-App empfängt copyNpaste-URLs auf `http://127.0.0.1:9911/api/todays-hunt`. copyNpaste verwendet diesen Endpunkt bereits. Die Desktop-App muss geöffnet sein. Eingänge werden lokal zwischengespeichert und erst nach erfolgreichem Speichern im Lesezeichenbestand quittiert. Websites dürfen den nativen Empfang nicht aufrufen. Bei belegtem Port zeigt Today's Hunt einen Hinweis.

Der lokale aKlik-Deployer muss auf Port 43110 laufen. Die Status-Bridge wird von Desktop und Add-on verwendet, sofern der lokale Zugriff gestattet ist. Die blaue Aktion öffnet die Prüfung im lokalen aKlik-Deployer; der Start fremder Software wird dort bestätigt. Statisch erkannte Nutzungswege tragen ausdrücklich den Zusatz „Hinweis“, keine ungeprüfte Kostenlosigkeitsgarantie.

## Daten und Wiederherstellung

Web-App, Desktop und Add-on haben getrennte lokale Bestände. JSON und der erweiterte CSV-Export erhalten den vollständigen Zustand. CSV-Sicherungen enthalten zusätzliche JSON-Spalten für Regeln, Glossar, Kategorien und Einstellungen; diese nicht entfernen, wenn eine vollständige Wiederherstellung gewünscht ist. Der KI-Schlüssel wird getrennt gespeichert und nicht exportiert.

Automatische Sicherungen laufen bei geöffneter App, prüfen jede Minute das Wochenintervall und behalten die acht neuesten Sicherungstage. Ein leerer Erststart verbraucht kein Sicherungsintervall. Betriebssystem-/Browserdatenlöschung kann auch diese Sicherungen entfernen. Eine zusätzliche unabhängige Sicherung bleibt sinnvoll.

## Video

Beide Remotion-Templates sind im Video-Studio verfügbar. Für MP4 die Requisiten exportieren und im Quellcode `bun run render:video <datei.json>` ausführen. Node/Bun und die installierten Entwicklungsabhängigkeiten sind dafür erforderlich. Das Programm rendert nicht vorgeblich eine MP4, wenn nur die Vorschau läuft.

## Prüfung und Grenzen

Der aktuelle Prüfstatus steht im Gesamtpaket unter `Quellcode/PRUEFSTATUS-1.4.0.md`. Windows-Statistik und Schnellwahl sind visuell bestätigt. Der tatsächliche Weg Strg+C → copyNpaste → Today's Hunt funktioniert mit der finalen Windows-Ausgabe. Das Chromium-ZIP ist in einem echten isolierten Browser geprüft; Firefox wurde temporär installiert. Die öffentliche Web-App startet nach Cache-Aufbau auch offline. Vollständige Fensterabnahme auf jedem System und eine eigene Vision-API bleiben separate Prüfungen. Die Testläufe verwenden eigene Testlinks.
