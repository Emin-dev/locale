//! Local-only release coverage. Identity is declared, never certified from pixels.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

pub const MAX_INPUT: usize = 1_048_576;
const MAX_SLOTS: usize = 200;
const MAX_REVIEWS: usize = 500;
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
pub struct Slot {
    pub locale: String,
    pub screen: String,
    pub state: String,
    pub configuration: String,
    pub text_size: String,
    pub appearance: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Capture {
    pub slot: Slot,
    pub build: String,
    pub catalog_hash: String,
    pub image: String,
    pub captured_at: String,
    #[serde(default)]
    pub sha256: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub schema_version: u8,
    pub project: String,
    pub release: String,
    pub build: String,
    pub catalog_hash: String,
    pub expected: Vec<Slot>,
    pub captures: Vec<Capture>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attachment {
    pub name: String,
    pub sha256: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Review {
    pub slot: Slot,
    pub fingerprint: String,
    pub decision: String,
    pub reviewer: String,
    pub comment: String,
    pub at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Project {
    pub manifest: Manifest,
    #[serde(default)]
    pub attachments: Vec<Attachment>,
    #[serde(default)]
    pub reviews: Vec<Review>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Row {
    pub slot: Slot,
    pub status: String,
    pub reason: String,
    pub fingerprint: String,
    pub capture: Option<Capture>,
    pub byte_sha256: Option<String>,
    pub review: Option<Review>,
    pub comments: Vec<Review>,
    pub can_review: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Counts {
    pub expected: usize,
    pub captured: usize,
    pub approved: usize,
    pub pending: usize,
    pub missing: usize,
    pub stale: usize,
    pub unverified: usize,
    pub rejected: usize,
    pub invalidated: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Audit {
    pub revision: String,
    pub rows: Vec<Row>,
    pub counts: Counts,
    pub complete: bool,
    pub caveat: String,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Audit {
        project: Project,
    },
    Decide {
        project: Project,
        slot: usize,
        expected_fingerprint: String,
        expected_revision: String,
        decision: String,
        reviewer: String,
        comment: String,
        at: String,
    },
    Export {
        project: Project,
    },
}
fn digest<T: Serialize>(value: &T) -> String {
    format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(value).expect("serializable types"))
    )
}
fn valid_text(v: &str, min: usize, max: usize) -> bool {
    v.trim().len() >= min && v.chars().count() <= max && !v.chars().any(|c| c.is_control())
}
fn valid_comment(v: &str) -> bool {
    v.chars().count() <= 1500
        && !v
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
}
fn hash(v: &str) -> bool {
    v.len() == 64
        && v.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn filename(v: &str) -> bool {
    valid_text(v, 1, 128)
        && !v.starts_with('.')
        && !v.contains(['/', '\\', ':'])
        && !v.contains("..")
        && (v.to_ascii_lowercase().ends_with(".png")
            || v.to_ascii_lowercase().ends_with(".jpg")
            || v.to_ascii_lowercase().ends_with(".jpeg"))
}
fn slot_valid(s: &Slot) -> bool {
    [
        &s.locale,
        &s.screen,
        &s.state,
        &s.configuration,
        &s.text_size,
        &s.appearance,
    ]
    .iter()
    .all(|v| valid_text(v, 1, 80))
}
fn timestamp(v: &str) -> bool {
    // Validate a UTC date while preserving that the importer controls the clock.
    let b = v.as_bytes();
    if !(v.len() == 20 || v.len() == 24)
        || b.get(4) != Some(&b'-')
        || b.get(7) != Some(&b'-')
        || b.get(10) != Some(&b'T')
        || b.get(13) != Some(&b':')
        || b.get(16) != Some(&b':')
        || b.last() != Some(&b'Z')
        || !b.iter().enumerate().all(|(i, c)| {
            matches!(i, 4 | 7 | 10 | 13 | 16)
                || (i == 19 && v.len() == 24 && *c == b'.')
                || i == v.len() - 1
                || c.is_ascii_digit()
        })
    {
        return false;
    }
    let number =
        |a: usize, z: usize| -> u32 { b[a..z].iter().fold(0, |n, c| n * 10 + u32::from(c - b'0')) };
    let year = number(0, 4);
    let month = number(5, 7);
    let day = number(8, 10);
    let leap = year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => 0,
    };
    year > 0
        && day > 0
        && day <= days
        && number(11, 13) < 24
        && number(14, 16) < 60
        && number(17, 19) < 60
}

pub fn validate(p: &Project) -> Result<(), String> {
    let m = &p.manifest;
    if m.schema_version != 1 {
        return Err("Unsupported schema_version; use 1.".into());
    }
    if !valid_text(&m.project, 1, 100)
        || !valid_text(&m.release, 1, 100)
        || !valid_text(&m.build, 1, 100)
        || !hash(&m.catalog_hash)
    {
        return Err(
            "Project, release, build and a lowercase 64-character catalog_hash are required."
                .into(),
        );
    }
    if m.expected.is_empty() || m.expected.len() > MAX_SLOTS {
        return Err("Declare between 1 and 200 expected configurations.".into());
    }
    if m.captures.len() > MAX_SLOTS
        || p.attachments.len() > MAX_SLOTS
        || p.reviews.len() > MAX_REVIEWS
    {
        return Err("Limit: 200 captures/images and 500 review events.".into());
    }
    let mut slots = HashSet::new();
    for s in &m.expected {
        if !slot_valid(s) || !slots.insert(s) {
            return Err("Invalid or duplicate expected configuration.".into());
        }
    }
    let mut captures = HashSet::new();
    let mut image_names = HashSet::new();
    for c in &m.captures {
        if !slots.contains(&c.slot) {
            return Err("Capture configuration is outside the expected matrix.".into());
        }
        if !captures.insert(&c.slot) || !image_names.insert(&c.image) {
            return Err("Duplicate capture configuration or image filename.".into());
        }
        if !filename(&c.image)
            || !valid_text(&c.build, 0, 100)
            || (!c.catalog_hash.is_empty() && !hash(&c.catalog_hash))
            || (!c.sha256.is_empty() && !hash(&c.sha256))
            || (!c.captured_at.is_empty() && !timestamp(&c.captured_at))
        {
            return Err(
                "Invalid capture metadata or unsafe image name. Use local PNG/JPEG basenames."
                    .into(),
            );
        }
    }
    let mut attachments = HashSet::new();
    for a in &p.attachments {
        if !filename(&a.name)
            || !hash(&a.sha256)
            || !image_names.contains(&a.name)
            || !attachments.insert(&a.name)
        {
            return Err("Duplicate, invalid or unexpected image attachment.".into());
        }
    }
    for r in &p.reviews {
        if !slots.contains(&r.slot)
            || !hash(&r.fingerprint)
            || !["approved", "rejected", "comment"].contains(&r.decision.as_str())
            || !valid_text(&r.reviewer, 1, 80)
            || !valid_comment(&r.comment)
            || !timestamp(&r.at)
        {
            return Err("Invalid review event.".into());
        }
        if r.decision != "approved" && r.comment.trim().is_empty() {
            return Err("Comments and change requests need a note.".into());
        }
    }
    // Every accepted snapshot must fit the next export request. In particular,
    // adding a full slot to a review event must never strand the caller above
    // the same API input cap. A failed decide consumes its owned candidate only.
    if serde_json::to_vec(&serde_json::json!({"op":"export","project":p}))
        .map_err(|_| "Unable to measure project capacity.")?
        .len()
        > MAX_INPUT
    {
        return Err("Project capacity reached. This change was not saved; export the current session before starting a smaller project.".into());
    }
    Ok(())
}
pub fn audit(p: &Project) -> Result<Audit, String> {
    validate(p)?;
    let mut counts = Counts {
        expected: p.manifest.expected.len(),
        ..Default::default()
    };
    let mut rows = Vec::new();
    for slot in &p.manifest.expected {
        let capture = p.manifest.captures.iter().find(|c| &c.slot == slot);
        let attachment = capture.and_then(|c| p.attachments.iter().find(|a| a.name == c.image));
        // Include target and every declared capture attribute, not just filename or path.
        let fingerprint = digest(&(
            &p.manifest.build,
            &p.manifest.catalog_hash,
            slot,
            capture,
            attachment,
        ));
        let latest = p
            .reviews
            .iter()
            .rev()
            .find(|r| &r.slot == slot && r.decision != "comment");
        let (mut status, mut reason) = match capture {
            None => ("missing", "No capture for this required configuration."),
            Some(c)
                if c.build.is_empty() || c.catalog_hash.is_empty() || c.captured_at.is_empty() =>
            {
                (
                    "unverified",
                    "Required build, catalog or capture-time metadata is absent.",
                )
            }
            Some(c) if c.build != p.manifest.build || c.catalog_hash != p.manifest.catalog_hash => {
                (
                    "stale",
                    "Capture build or catalog differs from this release target.",
                )
            }
            Some(_) if attachment.is_none() => (
                "unverified",
                "Image bytes are not attached to this session.",
            ),
            Some(c) if !c.sha256.is_empty() && attachment.is_some_and(|a| a.sha256 != c.sha256) => {
                (
                    "unverified",
                    "Image SHA-256 does not match the manifest digest.",
                )
            }
            _ => (
                "pending",
                "Ready for a human review of these exact artifacts.",
            ),
        };
        let can_review = status == "pending";
        if can_review && let Some(r) = latest {
            if r.fingerprint != fingerprint {
                status = "invalidated";
                reason = "Evidence changed after the last decision. Review again.";
            } else if r.decision == "approved" {
                status = "approved";
                reason = "Human approval matches the current evidence.";
            } else {
                status = "rejected";
                reason = "A reviewer requested changes to this evidence.";
            }
        }
        if capture.is_some() {
            counts.captured += 1;
        }
        match status {
            "missing" => counts.missing += 1,
            "stale" => counts.stale += 1,
            "unverified" => counts.unverified += 1,
            "approved" => counts.approved += 1,
            "rejected" => counts.rejected += 1,
            "invalidated" => counts.invalidated += 1,
            _ => counts.pending += 1,
        }
        rows.push(Row {
            slot: slot.clone(),
            status: status.into(),
            reason: reason.into(),
            fingerprint,
            capture: capture.cloned(),
            byte_sha256: attachment.map(|a| a.sha256.clone()),
            review: latest.cloned(),
            comments: p
                .reviews
                .iter()
                .filter(|r| &r.slot == slot)
                .cloned()
                .collect(),
            can_review,
        });
    }
    Ok(Audit { revision:digest(p), complete:counts.approved==counts.expected, counts, rows,
        caveat:"Human review record, not a digital signature or automatic visual/translation certification. Build, locale and catalog metadata are declared by the importer. Reviewers and timestamps are unauthenticated. Image hashes bind locally loaded bytes only.".into() })
}
pub fn process(input: &str) -> Result<serde_json::Value, String> {
    if input.len() > MAX_INPUT {
        return Err("Input exceeds the 1 MiB processing limit.".into());
    }
    let req: Request =
        serde_json::from_str(input).map_err(|e| format!("Invalid request JSON: {e}"))?;
    match req {
        Request::Audit { project } => Ok(serde_json::to_value(audit(&project)?).unwrap()),
        Request::Export { project } => {
            let a = audit(&project)?;
            Ok(
                serde_json::json!({"schema":"locale-review-report/v1","project":project.manifest.project,
                "release":project.manifest.release,"target_build":project.manifest.build,"target_catalog_hash":project.manifest.catalog_hash,
                "expected":project.manifest.expected,"audit":a,"review_history":project.reviews,
                "privacy":"No image bytes included. Filenames, comments and declared identities may be sensitive; inspect before sharing."}),
            )
        }
        Request::Decide {
            mut project,
            slot,
            expected_fingerprint,
            expected_revision,
            decision,
            reviewer,
            comment,
            at,
        } => {
            let a = audit(&project)?;
            if a.revision != expected_revision {
                return Err("The project changed. Refresh before saving this decision.".into());
            }
            let row = a.rows.get(slot).ok_or("Unknown configuration.")?;
            if row.fingerprint != expected_fingerprint {
                return Err(
                    "Evidence changed. Inspect the current capture before deciding.".into(),
                );
            }
            if !row.can_review {
                return Err(
                    "Attach current, verified image bytes and complete metadata before reviewing."
                        .into(),
                );
            }
            if project.reviews.len() >= MAX_REVIEWS {
                return Err("Review history is full (500 events). Export this project before starting a new one.".into());
            }
            let r = Review {
                slot: row.slot.clone(),
                fingerprint: row.fingerprint.clone(),
                decision,
                reviewer: reviewer.trim().into(),
                comment: comment.trim().into(),
                at,
            };
            // Duplicate submissions are idempotent if the same event is sent twice.
            if project.reviews.last().is_some_and(|last| {
                last.slot == r.slot
                    && last.fingerprint == r.fingerprint
                    && last.decision == r.decision
                    && last.reviewer == r.reviewer
                    && last.comment == r.comment
            }) {
                return Ok(serde_json::json!({"project":project,"audit":a}));
            }
            project.reviews.push(r);
            validate(&project)?;
            Ok(serde_json::json!({"audit":audit(&project)?,"project":project}))
        }
    }
}

// Minimal JSON ABI. JS owns input and receives an allocated UTF-8 envelope.
// No network, filesystem, clock, randomness or host calls in the core.
#[cfg(target_arch = "wasm32")]
#[unsafe(no_mangle)]
pub extern "C" fn locale_alloc(len: usize) -> *mut u8 {
    if len > MAX_INPUT {
        return std::ptr::null_mut();
    }
    let v = vec![0u8; len].into_boxed_slice();
    Box::into_raw(v) as *mut u8
}
#[cfg(target_arch = "wasm32")]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn locale_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        unsafe {
            drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
        }
    }
}
#[cfg(target_arch = "wasm32")]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn locale_process(ptr: *const u8, len: usize) -> u64 {
    let result = if len > MAX_INPUT {
        Err("Input exceeds 1 MiB.".into())
    } else {
        let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
        std::str::from_utf8(bytes)
            .map_err(|_| "Input is not UTF-8.".into())
            .and_then(process)
    };
    let envelope = match result {
        Ok(value) => serde_json::json!({"ok":true,"value":value}),
        Err(error) => serde_json::json!({"ok":false,"error":error}),
    };
    let bytes = serde_json::to_vec(&envelope).unwrap().into_boxed_slice();
    let len = bytes.len() as u64;
    let ptr = Box::into_raw(bytes) as *mut u8 as u64;
    (len << 32) | ptr
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Project {
        serde_json::from_str(include_str!("../tests/fixture.json")).unwrap()
    }
    fn decide(p: Project, action: &str, note: &str) -> Result<Project, String> {
        let a = audit(&p)?;
        let v=process(&serde_json::json!({"op":"decide","project":p,"slot":0,"expected_fingerprint":a.rows[0].fingerprint,"expected_revision":a.revision,"decision":action,"reviewer":"Reviewer","comment":note,"at":"2026-10-09T12:00:00Z"}).to_string())?;
        Ok(serde_json::from_value(v["project"].clone()).unwrap())
    }
    #[test]
    fn coverage_is_declared_not_inferred() {
        let p = fixture();
        let a = audit(&p).unwrap();
        assert_eq!(a.counts.expected, 2);
        assert_eq!(a.counts.missing, 1);
        assert!(!a.complete);
    }
    #[test]
    fn approval_then_rejection_and_comment() {
        let p = decide(fixture(), "approved", "").unwrap();
        assert_eq!(audit(&p).unwrap().rows[0].status, "approved");
        let p = decide(p, "rejected", "Label clips").unwrap();
        let p = decide(p, "comment", "Check large text").unwrap();
        assert_eq!(audit(&p).unwrap().rows[0].status, "rejected");
        assert_eq!(p.reviews.len(), 3);
    }
    #[test]
    fn changed_bytes_invalidate_approval() {
        let mut p = decide(fixture(), "approved", "").unwrap();
        p.attachments[0].sha256 = "b".repeat(64);
        assert_eq!(audit(&p).unwrap().rows[0].status, "invalidated");
    }
    #[test]
    fn changed_metadata_invalidates() {
        let mut p = decide(fixture(), "approved", "").unwrap();
        p.manifest.captures[0].captured_at = "2026-10-10T12:00:00Z".into();
        assert_eq!(audit(&p).unwrap().rows[0].status, "invalidated");
    }
    #[test]
    fn changed_target_never_carries_approval() {
        let mut p = decide(fixture(), "approved", "").unwrap();
        p.manifest.build = "next".into();
        assert_eq!(audit(&p).unwrap().rows[0].status, "stale");
        p.manifest.captures[0].build = "next".into();
        assert_eq!(audit(&p).unwrap().rows[0].status, "invalidated");
    }
    #[test]
    fn declared_hash_mismatch_blocks() {
        let mut p = fixture();
        p.manifest.captures[0].sha256 = "c".repeat(64);
        assert_eq!(audit(&p).unwrap().rows[0].status, "unverified");
        assert!(decide(p, "approved", "").is_err());
    }
    #[test]
    fn missing_bytes_blocks() {
        let mut p = fixture();
        p.attachments.clear();
        assert_eq!(audit(&p).unwrap().rows[0].status, "unverified");
        assert!(decide(p, "approved", "").is_err());
    }
    #[test]
    fn incomplete_identity_blocks() {
        let mut p = fixture();
        p.manifest.captures[0].catalog_hash.clear();
        assert_eq!(audit(&p).unwrap().rows[0].status, "unverified");
    }
    #[test]
    fn duplicate_slot_rejected() {
        let mut p = fixture();
        p.manifest.expected.push(p.manifest.expected[0].clone());
        assert!(audit(&p).is_err());
    }
    #[test]
    fn duplicate_and_extra_images_rejected() {
        let mut p = fixture();
        p.attachments.push(p.attachments[0].clone());
        assert!(audit(&p).is_err());
        let mut p = fixture();
        p.attachments[0].name = "extra.png".into();
        assert!(audit(&p).is_err());
    }
    #[test]
    fn unsafe_path_rejected() {
        for v in [
            "../bad.png",
            "https://example.com/a.png",
            "C:\\a.png",
            "data:image.png",
            "hidden.svg",
        ] {
            let mut p = fixture();
            p.manifest.captures[0].image = v.into();
            assert!(audit(&p).is_err());
        }
    }
    #[test]
    fn resource_limits() {
        let mut p = fixture();
        p.manifest
            .expected
            .resize(201, p.manifest.expected[0].clone());
        assert!(audit(&p).is_err());
        assert!(process(&" ".repeat(MAX_INPUT + 1)).is_err());
    }
    #[test]
    fn stale_snapshot_rejected() {
        let p = fixture();
        let a = audit(&p).unwrap();
        let changed = decide(p, "approved", "").unwrap();
        assert!(process(&serde_json::json!({"op":"decide","project":changed,"slot":0,"expected_fingerprint":a.rows[0].fingerprint,"expected_revision":a.revision,"decision":"rejected","reviewer":"A","comment":"X","at":"2026-10-09T12:00:00Z"}).to_string()).is_err());
    }
    #[test]
    fn repeat_is_idempotent() {
        let p = decide(fixture(), "approved", "").unwrap();
        let p = decide(p, "approved", "").unwrap();
        assert_eq!(p.reviews.len(), 1);
    }
    #[test]
    fn unknown_fields_rejected() {
        assert!(process(r#"{"op":"audit","project":{},"unexpected":true}"#).is_err());
    }
    #[test]
    fn rejection_requires_note_and_name() {
        assert!(decide(fixture(), "rejected", "").is_err());
        assert!(decide(fixture(), "unknown", "note").is_err());
    }
    #[test]
    fn export_preserves_uncertainty() {
        let p = fixture();
        let v = process(&serde_json::json!({"op":"export","project":p}).to_string()).unwrap();
        assert_eq!(v["audit"]["complete"], false);
        assert!(
            v["audit"]["caveat"]
                .as_str()
                .unwrap()
                .contains("not a digital signature")
        );
    }
    #[test]
    fn invalid_dates_rejected() {
        for date in [
            "2026-02-29T12:00:00Z",
            "2026-13-09T12:00:00Z",
            "2026-10-09T24:00:00Z",
            "0000-01-01T00:00:00Z",
        ] {
            let mut p = fixture();
            p.manifest.captures[0].captured_at = date.into();
            assert!(audit(&p).is_err());
        }
        assert!(timestamp("2024-02-29T23:59:59.123Z"));
    }
    #[test]
    fn all_expected_must_be_approved() {
        let mut p = fixture();
        p.manifest.expected.pop();
        let p = decide(p, "approved", "").unwrap();
        assert!(audit(&p).unwrap().complete);
    }
    #[test]
    fn oversized_snapshot_is_refused() {
        let mut p = fixture();
        p.manifest.expected.pop();
        p.manifest.expected[0] = Slot {
            locale: "x".repeat(80),
            screen: "x".repeat(80),
            state: "x".repeat(80),
            configuration: "x".repeat(80),
            text_size: "x".repeat(80),
            appearance: "x".repeat(80),
        };
        p.manifest.captures[0].slot = p.manifest.expected[0].clone();
        let row = audit(&p).unwrap().rows.remove(0);
        p.reviews = vec![
            Review {
                slot: row.slot,
                fingerprint: row.fingerprint,
                decision: "comment".into(),
                reviewer: "R".into(),
                comment: "x".repeat(1500),
                at: "2026-10-09T12:00:00Z".into()
            };
            500
        ];
        // Grow the identity so the maximum event count exceeds the byte budget.
        for r in &mut p.reviews {
            r.reviewer = "x".repeat(80);
        }
        assert!(
            serde_json::to_vec(&serde_json::json!({"op":"export","project":p}))
                .unwrap()
                .len()
                > MAX_INPUT
        );
        assert!(audit(&p).is_err());
    }
    #[test]
    fn multiline_comments_are_preserved() {
        let p = decide(fixture(), "comment", "First line.\nSecond line.").unwrap();
        assert_eq!(p.reviews[0].comment, "First line.\nSecond line.");
    }
}
