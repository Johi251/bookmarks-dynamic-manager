# Importkorrektur 1.4.1 — 29.10.2026

executed: Der fehlende HTML-Datei-Input wurde mit einem Regressionstest reproduziert. Der Test schlug vor der Korrektur fehl und besteht danach. Das Auswählen einer HTML-Datei und HTML5-Datei-Drop führen im Test bis in den gespeicherten Bestand.

executed: Der Importdialog besitzt einen echten Dateieingang für HTML/HTM und JSON. Die Auswahlfläche ist per Tastatur bedienbar und wird während der Verarbeitung deaktiviert. Der Dateieingang wird nach Auswahl zurückgesetzt, damit dieselbe Datei erneut gewählt werden kann.

executed: Der native Tauri-Drop-Handler ist abgeschaltet. Laut Tauri-Dokumentation ist dies unter Windows Voraussetzung für HTML5-Drag-and-drop im Frontend: https://tauri.app/reference/config/#windowconfig .

executed: Strikte Typprüfung und 108 JavaScript-/DOM-Prüfungen bestanden. Es wurden keine Anwendungsabhängigkeiten aktualisiert.

not verified: Die neuen Prüfungen in echtem Chromium und im gebauten Windows-WebView sowie die vier nativen Plattform-Builds werden vor Veröffentlichung separat bestätigt. Frühere 1.4.0-Prüfungen belegen diesen neuen Importweg nicht.

executed: Die bestehenden Signaturgrenzen bleiben bestehen: Windows unsigniert, Mac nicht notarisiert, Firefox temporär. Die gewünschte Animation ist nur teilweise vorhanden; siehe die aktuelle Übergabeanleitung. Private Lesezeichen werden nicht in Testläufe auf GitHub hochgeladen.
