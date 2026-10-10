//! The same bounded core is callable without a browser: one JSON request on stdin.
use std::io::{Read, Write};
fn main() {
    let mut input = String::new();
    let result = std::io::stdin()
        .take((locale_review::MAX_INPUT + 1) as u64)
        .read_to_string(&mut input)
        .map_err(|e| format!("Unable to read UTF-8 input: {e}"))
        .and_then(|_| locale_review::process(&input));
    let (envelope, code) = match result {
        Ok(value) => (serde_json::json!({"ok":true,"value":value}), 0),
        Err(error) => (serde_json::json!({"ok":false,"error":error}), 1),
    };
    let _ = writeln!(std::io::stdout(), "{envelope}");
    std::process::exit(code);
}
