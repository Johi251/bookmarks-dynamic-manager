/// Desktop-Wrapper: lädt die gebaute Web-App (dist/) in ein natives Fenster.
/// Daten bleiben im lokalen WebView-Profil (localStorage) — kein Netzwerk nötig.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Bookmarks Dynamic Manager: Fehler beim Starten der Anwendung");
}
