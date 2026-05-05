use regex::Regex;
use std::io::{Error, ErrorKind, Write};
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use tauri::Result;

fn shell_exec_with_stdin(jj: &str, cwd: &str, args: &[&str], stdin_str: &str) -> Result<String> {
    let mut child = Command::new(jj)
        .creation_flags(0x08000000 /* CREATE_NO_WINDOW */)
        .current_dir(cwd)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or(Error::new(ErrorKind::Other, "Failed to open stdin"))?;
    let stdin_string = stdin_str.to_string();
    std::thread::spawn(move || {
        stdin
            .write_all(stdin_string.as_bytes())
            .expect("Failed to write to stdin");
    });

    let output = child.wait_with_output().expect("Failed to read stdout");
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if !stderr.is_empty() {
        println!("{}", stderr)
    };
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn shell_exec(jj: &str, cwd: &str, args: &[&str]) -> Result<String> {
    shell_exec_with_stdin(jj, cwd, args, "")
}

fn validate<'a>(input: &'a str, spec: &str) -> &'a str {
    assert!(Regex::new(spec).unwrap().is_match(input));
    input
}

fn validate_revision<'a>(input: &'a str) -> &'a str {
    if input == "@" {
        input
    } else {
        validate(input, r"^[k-z]{4,32}$")
    }
}

#[tauri::command]
fn abandon(jj: &str, cwd: &str, r: &str) -> Result<String> {
    shell_exec(jj, cwd, &["abandon", "-r", validate_revision(r)])
}

#[tauri::command]
fn bookmark_move(jj: &str, cwd: &str, r: &str, b: &str) -> Result<String> {
    shell_exec(
        jj,
        cwd,
        &[
            "bookmark",
            "move",
            validate(b, r"^[\w\d\.]+$"),
            "-t",
            validate_revision(r),
        ],
    )
}

#[tauri::command]
fn describe(jj: &str, cwd: &str, r: &str, m: &str) -> Result<String> {
    shell_exec_with_stdin(
        jj,
        cwd,
        &["describe", "-r", validate_revision(r), "--stdin"],
        m,
    )
}

#[tauri::command]
fn diff(jj: &str, cwd: &str, r: &str, c: i32, f: &str) -> Result<String> {
    shell_exec(
        jj,
        cwd,
        &[
            "diff",
            "--git",
            "-r",
            validate_revision(r),
            "--context",
            &c.to_string(),
            &format!("file:'{}'", validate(f, "^[^\"]+$")),
        ],
    )
}

#[tauri::command]
fn edit(jj: &str, cwd: &str, r: &str) -> Result<String> {
    shell_exec(jj, cwd, &["edit", "-r", validate_revision(r)])
}

#[tauri::command]
fn file_search(jj: &str, cwd: &str, r: &str, p: &str) -> Result<String> {
    shell_exec(
        jj,
        cwd,
        &[
            "file",
            "search",
            "-r",
            validate_revision(r),
            "-p",
            validate(p, "^[^\"]+$"),
        ],
    )
}

#[tauri::command]
fn file_show(jj: &str, cwd: &str, r: &str, f: &str) -> Result<String> {
    shell_exec(
        jj,
        cwd,
        &[
            "file",
            "show",
            "-r",
            validate_revision(r),
            validate(f, "^[^\"]+$"),
        ],
    )
}

#[tauri::command]
fn log(jj: &str, cwd: &str) -> Result<String> {
    shell_exec(
        jj,
        cwd,
        &[
            "log",
            "-r",
            "ancestors(visible_heads(), 20)",
            "-T",
            "change_id.short(4) ++ ' ' ++ bookmarks ++ ' ' ++ tags ++ ' ' ++ \
                ' : ' ++ description.first_line()",
        ],
    )
}

#[tauri::command]
fn new(jj: &str, cwd: &str, r: &str) -> Result<String> {
    shell_exec(jj, cwd, &["new", "-r", validate_revision(r)])
}

#[tauri::command]
fn rebase(jj: &str, cwd: &str, s: &str, o: &str) -> Result<String> {
    shell_exec(
        jj,
        cwd,
        &[
            "rebase",
            "-s",
            validate_revision(s),
            "-o",
            validate_revision(o),
        ],
    )
}

#[tauri::command]
fn show(jj: &str, cwd: &str, r: &str) -> Result<String> {
    shell_exec(
        jj,
        cwd,
        &["show", "--name-only", "-r", validate_revision(r)],
    )
}

#[tauri::command]
fn squash(jj: &str, cwd: &str, r: &str) -> Result<String> {
    shell_exec(jj, cwd, &["squash", "-r", validate_revision(r)])
}

#[tauri::command]
fn undo(jj: &str, cwd: &str) -> Result<String> {
    shell_exec(jj, cwd, &["undo"])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            abandon,
            bookmark_move,
            describe,
            diff,
            edit,
            file_search,
            file_show,
            log,
            new,
            rebase,
            show,
            squash,
            undo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
