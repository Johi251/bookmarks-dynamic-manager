# Importkorrektur 1.4.1 — 29.10.2026

executed: Der fehlende HTML-Datei-Input wurde mit einem Regressionstest reproduziert. Der Test schlug vor der Korrektur fehl und besteht danach. Das Auswählen einer HTML-Datei und HTML5-Datei-Drop führen im Test bis in den gespeicherten Bestand.

executed: Der Importdialog besitzt einen echten Dateieingang für HTML/HTM und JSON. Die Auswahlfläche ist per Tastatur bedienbar und wird während der Verarbeitung deaktiviert. Der Dateieingang wird nach Auswahl zurückgesetzt, damit dieselbe Datei erneut gewählt werden kann.

executed: Der native Tauri-Drop-Handler ist abgeschaltet. Laut Tauri-Dokumentation ist dies unter Windows Voraussetzung für HTML5-Drag-and-drop im Frontend: https://tauri.app/reference/config/#windowconfig .

executed: Strikte Typprüfung und 108 JavaScript-/DOM-Prüfungen bestanden. Es wurden keine Anwendungsabhängigkeiten aktualisiert.

live verified: Echtes Chromium hat das erzeugte ZIP-Add-on und die öffentliche Web-App 1.4.1 geprüft: Die Importfläche öffnet die Dateiauswahl, HTM-Auswahl und HTML5-Datei-Drop speichern die Links dauerhaft nach Neuladen. Auch die bisherigen Add-on-Funktionen und der Offline-Start der Web-App bestanden. Lauf: https://github.com/Johi251/bookmarks-dynamic-manager/actions/runs/40806098481 .

live verified: Die lokal gebaute Windows-App 1.4.1 wurde mit Computer Use im echten Fenster bedient. Der native Dateidialog öffnete sich; eine künstliche HTM-Datei wurde mit „1 neu übernommen, 0 bereits vorhanden“ importiert. Der sichtbare Eintrag blieb nach Strg+R erhalten. Das isolierte WebView-Profil enthielt vorher null Lesezeichen. Keine privaten Lesezeichen wurden verwendet.

live verified: Windows x64, Mac Apple Silicon/Intel und Linux amd64 wurden gebaut und tatsächlich gestartet. Echter HTTP-Eingang wurde nach Speicherung durch die Oberfläche über native IPC quittiert. Drei Rust-Tests je Plattform bestanden. Mac/Linux-Lauf: https://github.com/Johi251/bookmarks-dynamic-manager/actions/runs/40805654790 . Windows-Build und Speichertest zusätzlich in https://github.com/Johi251/bookmarks-dynamic-manager/actions/runs/40807002762 bestätigt; die ausgelieferten Windows-Dateien stammen aus dem lokal gebauten und am Fenster geprüften Stand.

executed / not verified: Zwei zusätzliche Windows-CI-Importversuche scheiterten am Aufbau der Debug-/WebDriver-Verbindung, bevor der Import geprüft werden konnte. Die Läufe werden nicht als vollständig erfolgreich ausgegeben. Die experimentelle Steuerungsprüfung ist separat zuschaltbar; normale native Build-/Speichertests bleiben verpflichtend.

live verified: Firefox 158 installierte das echte 1.4.1-ZIP temporär: https://github.com/Johi251/bookmarks-dynamic-manager/actions/runs/40805784756 . Die vollständige Firefox-Fensterbedienung bleibt ungeprüft.

not verified: Ein physischer Datei-Drop aus dem Windows-Explorer wurde nicht separat ausgeführt. Der HTML5-Dropweg ist in echtem Chromium bestätigt; die Windows-Konfiguration entspricht der dokumentierten Tauri-Voraussetzung. Vollständige manuelle Installer-Abnahme und eine eigene Vision-API sind nicht bestätigt.

executed: Die bestehenden Signaturgrenzen bleiben bestehen: Windows unsigniert, Mac nicht notarisiert, Firefox temporär. Die gewünschte Animation ist nur teilweise vorhanden; siehe die aktuelle Übergabeanleitung. Private Lesezeichen werden nicht in Testläufe auf GitHub hochgeladen.
