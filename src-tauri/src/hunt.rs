use serde_json::{json, Value};
use std::{fs, io::{Read, Write}, net::{TcpListener, TcpStream}, path::PathBuf, sync::Mutex, time::Duration};
use tauri::Manager;

pub struct Hunt { pub file: PathBuf, pub lock: Mutex<()>, pub status: Mutex<String> }

fn items(hunt: &Hunt) -> Result<Vec<Value>, String> {
    match fs::read(&hunt.file) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| "Today's-Hunt-Ablage ist beschädigt; Datei bleibt erhalten.".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(vec![]),
        Err(e) => Err(e.to_string()),
    }
}
fn store(hunt: &Hunt, values: &[Value]) -> Result<(), String> {
    if let Some(parent) = hunt.file.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let pending = hunt.file.with_extension("pending");
    let mut file = fs::File::create(&pending).map_err(|e| e.to_string())?;
    file.write_all(serde_json::to_string(values).unwrap().as_bytes()).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    fs::rename(pending, &hunt.file).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hunt_pending(hunt: tauri::State<'_, Hunt>) -> Result<Value, String> {
    let _guard = hunt.lock.lock().map_err(|_| "Hunt-Speicher gesperrt")?;
    let status = hunt.status.lock().map_err(|_| "Status gesperrt")?.clone();
    let pending = if status.starts_with("Port 9911") { vec![] } else { items(&hunt)? };
    Ok(json!({"items": pending, "status": status}))
}
#[tauri::command]
pub fn hunt_ack(ids: Vec<String>, hunt: tauri::State<'_, Hunt>) -> Result<(), String> {
    let _guard = hunt.lock.lock().map_err(|_| "Hunt-Speicher gesperrt")?;
    let keep: Vec<Value> = items(&hunt)?.into_iter().filter(|v| !ids.iter().any(|id| v["id"].as_str() == Some(id))).collect();
    store(&hunt, &keep)
}

fn payload(body: &[u8]) -> Result<Value, String> {
    let v: Value = serde_json::from_slice(body).map_err(|_| "JSON erwartet")?;
    if v["source"] != "copyNpaste" { return Err("Unbekannte Quelle".into()); }
    if v["probe"] == true { return Ok(json!({"probe":true})); }
    let url = v["url"].as_str().ok_or("URL fehlt")?;
    let u = tauri::Url::parse(url).map_err(|_| "Ungültige URL")?;
    if url.len() > 4096 || !["http", "https"].contains(&u.scheme()) || !u.username().is_empty() || u.password().is_some() || u.host_str().is_none() { return Err("HTTP-/HTTPS-URL ohne Zugangsdaten erwartet".into()); }
    Ok(json!({"id":url, "url":url, "title":url, "capturedAt":v["capturedAt"], "source":"copyNpaste"}))
}

fn request(stream: &mut TcpStream) -> Result<Value, String> {
    stream.set_read_timeout(Some(Duration::from_secs(2))).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 1024];
    let end;
    loop {
        let count = stream.read(&mut buffer).map_err(|_| "Lesezeit überschritten")?;
        if count == 0 { return Err("Unvollständige Anfrage".into()); }
        bytes.extend_from_slice(&buffer[..count]);
        if bytes.len() > 12288 { return Err("Anfrage zu groß".into()); }
        if let Some(pos) = bytes.windows(4).position(|v| v == b"\r\n\r\n") { end = pos + 4; break; }
    }
    let headers = std::str::from_utf8(&bytes[..end]).map_err(|_| "Ungültige Header")?.to_lowercase();
    let lines: Vec<&str> = headers.split("\r\n").collect();
    if lines[0] != "post /api/todays-hunt http/1.1" { return Err("POST /api/todays-hunt erwartet".into()); }
    let header = |name: &str| lines.iter().filter_map(|line| line.split_once(':')).find(|(key, _)| *key == name).map(|(_, value)| value.trim());
    if !matches!(header("host"), Some("127.0.0.1:9911" | "localhost:9911")) || header("origin").is_some() || header("transfer-encoding").is_some() { return Err("Nur direkte lokale Anfragen erlaubt".into()); }
    if !header("content-type").unwrap_or("").starts_with("application/json") { return Err("application/json erwartet".into()); }
    let size = header("content-length").ok_or("Länge fehlt")?.parse::<usize>().map_err(|_| "Länge ungültig")?;
    if size > 8192 { return Err("Anfrage zu groß".into()); }
    while bytes.len() < end + size {
        let count = stream.read(&mut buffer).map_err(|_| "Lesezeit überschritten")?;
        if count == 0 { return Err("Unvollständiger Inhalt".into()); }
        bytes.extend_from_slice(&buffer[..count]);
    }
    payload(&bytes[end..end + size])
}

pub fn start(app: tauri::AppHandle) {
    let listener = match TcpListener::bind("127.0.0.1:9911") {
            Ok(value) => value,
            Err(_) => { *app.state::<Hunt>().status.lock().unwrap() = "Port 9911 ist belegt. Today's Hunt empfängt in dieser Instanz keine URLs.".into(); return; }
        };
        *app.state::<Hunt>().status.lock().unwrap() = "copyNpaste-Empfang auf 127.0.0.1:9911 aktiv".into();
    std::thread::spawn(move || {
        for mut stream in listener.incoming().flatten() {
            let result = request(&mut stream).and_then(|item| {
                if item["probe"] == true { return Ok(()); }
                let hunt = app.state::<Hunt>();
                let _guard = hunt.lock.lock().map_err(|_| "Hunt-Speicher gesperrt")?;
                let mut pending = items(&hunt)?;
                if pending.iter().any(|old| old["url"] == item["url"]) { return Ok(()); }
                if pending.len() >= 256 { return Err("Hunt-Eingang voll; zuerst im Manager übernehmen".into()); }
                pending.push(item); store(&hunt, &pending)
            });
            let (status, body) = match result { Ok(()) => (200, json!({"ok":true})), Err(e) => (400, json!({"ok":false,"error":e})) };
            let body = body.to_string();
            let response = format!("HTTP/1.1 {} Result\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", status, body.len(), body);
            let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
            let _ = stream.write_all(response.as_bytes());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_only_valid_copynpaste_links() {
        assert!(payload(br#"{"source":"copyNpaste","url":"https://example.com/"}"#).is_ok());
        assert!(payload(br#"{"source":"copyNpaste","url":"javascript:alert(1)"}"#).is_err());
        assert!(payload(br#"{"source":"other","url":"https://example.com/"}"#).is_err());
        assert!(payload(br#"{"source":"copyNpaste","url":"https://user:pass@example.com/"}"#).is_err());
    }
    fn send(raw: &str) -> Result<Value, String> {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let worker = std::thread::spawn(move || { let (mut stream, _) = listener.accept().unwrap(); request(&mut stream) });
        let mut client = TcpStream::connect(address).unwrap();
        client.write_all(raw.as_bytes()).unwrap();
        client.shutdown(std::net::Shutdown::Write).unwrap();
        worker.join().unwrap()
    }
    #[test]
    fn native_http_rejects_browser_requests_and_bad_hosts() {
        let body = r#"{"source":"copyNpaste","probe":true}"#;
        let good = format!("POST /api/todays-hunt HTTP/1.1\r\nHost: 127.0.0.1:9911\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}", body.len(), body);
        assert!(send(&good).is_ok());
        assert!(send(&good.replace("Host: ", "Origin: https://evil.example\r\nHost: ")).is_err());
        assert!(send(&good.replace("127.0.0.1:9911", "evil.example:9911")).is_err());
        assert!(send(&good.replace("application/json", "text/plain")).is_err());
    }
    #[test]
    fn pending_inbox_replaces_atomically_and_remains_readable() {
        let hunt = Hunt { file: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.data/test/hunt-disk.json"), lock: Mutex::new(()), status: Mutex::new(String::new()) };
        store(&hunt, &[json!({"id":"one"})]).unwrap();
        store(&hunt, &[json!({"id":"one"}), json!({"id":"two"})]).unwrap();
        assert_eq!(items(&hunt).unwrap().len(), 2);
    }
}
