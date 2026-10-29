/// Desktop-Wrapper: lädt die gebaute Web-App (dist/) in ein natives Fenster.
/// Daten bleiben im lokalen WebView-Profil (localStorage) — kein Netzwerk nötig.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(hunt::Hunt { file: app.path().app_local_data_dir()?.join("todays-hunt.json"), lock: std::sync::Mutex::new(()), status: std::sync::Mutex::new("Empfang startet …".into()) });
            hunt::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![hunt::hunt_pending, hunt::hunt_ack])
        .run(tauri::generate_context!())
        .expect("Bookmarks Dynamic Manager: Fehler beim Starten der Anwendung");
}
mod hunt;
use tauri::Manager;
