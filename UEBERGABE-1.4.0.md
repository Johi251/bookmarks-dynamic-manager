# Bookmarks Dynamic Manager 1.4.0

## Windows

Unter `Downloads` liegt die portable `BookmarksDynamicManager.exe` und der Windows-Installer. Beide verwenden WebView2. Die Dateien sind nicht signiert.

## Browser-Add-ons

Das passende Chrome- beziehungsweise Firefox-ZIP entpacken. Chrome/Edge/Brave: Entwicklermodus unter `chrome://extensions` und „Entpackte Erweiterung laden“. Firefox: temporär über `about:debugging`. Für eine dauerhafte Firefox-Installation fehlt weiterhin die Mozilla-Signierung.

KI/Vision ist optional. In den Einstellungen den eigenen OpenAI-kompatiblen Endpunkt und das Modell eintragen. Das Add-on fragt Zugriff auf diesen Endpunkt an. Erst bei bewusst aktiviertem Vision-Modus werden Seitenbilder an diese API gesendet. Die Nutzungskosten des eigenen Providers sind dessen Vertragsbedingungen zu entnehmen; das Programm verspricht keine kostenlose externe KI.

## Web-App

Der Ordner `Web-App` enthält den aktuellen statischen Build mit relativen Pfaden. Er muss über einen HTTP-Server bereitgestellt werden; `index.html` nicht als Datei doppelklicken. Aus dem Quellcode: `bun install --frozen-lockfile`, anschließend `bun run dev`.

Die bereits veröffentlichte GitHub-Pages-Seite steht bei der Nachprüfung am 29.10.2026 weiterhin auf 1.3.0. Die GitHub-Freigabe für dieses Projekt liegt inzwischen vor; die Aktualisierung wurde noch nicht veröffentlicht.

## Mac und Linux

Native Pakete können nur auf passenden Systemen erstellt und abgenommen werden. Dieses lokale Paket enthält deshalb keine behauptete Mac-App und kein Linux-Binary. Die manuell auslösbare GitHub-Actions-Pipeline im Quellcode erstellt passende native Pakete auf Windows, Mac und Linux. Sie wurde noch nicht veröffentlicht oder ausgeführt.

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

Der aktuelle Prüfstatus steht im Gesamtpaket unter `Quellcode/PRUEFSTATUS-1.4.0.md`. Reale Browser-/Windows-Fensterbedienung konnte bisher wegen der gestoppten Computersteuerung nicht visuell abgenommen werden. Der Regressionstest nutzt eine isolierte DOM-Umgebung; er ersetzt diese Abnahme nicht.
