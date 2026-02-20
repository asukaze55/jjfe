use regex::Regex;
use std::io::{Error, ErrorKind, Write};
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use tauri::Result;

fn shell_exec_with_stdin(cwd: &str, args: &[&str], stdin_str: &str) -> Result<String> {
    let mut child = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .arg("/C")
            .creation_flags(0x08000000 /* CREATE_NO_WINDOW */)
            .current_dir(cwd)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?
    } else {
        Command::new("sh")
            .arg("-c")
            .current_dir(cwd)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?
    };

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

fn shell_exec(cwd: &str, args: &[&str]) -> Result<String> {
    shell_exec_with_stdin(cwd, args, "")
}

fn validate<'a>(input: &'a str, spec: &str) -> &'a str {
    assert!(Regex::new(spec).unwrap().is_match(input));
    input
}

fn validate_revision<'a>(input: &'a str) -> &'a str {
    if input == "@" {
        input
    } else {
        validate(input, r"^[k-z]{8,32}$")
    }
}

#[tauri::command]
fn abandon(cwd: &str, r: &str) -> Result<String> {
    shell_exec(cwd, &["jj", "abandon", "-r", validate_revision(r)])
}

#[tauri::command]
fn bookmark_move(cwd: &str, r: &str, b: &str) -> Result<String> {
    shell_exec(
        cwd,
        &[
            "jj",
            "bookmark",
            "move",
            validate(b, r"^[\w\d\.]+$"),
            "-t",
            validate_revision(r),
        ],
    )
}

#[tauri::command]
fn describe(cwd: &str, r: &str, m: &str) -> Result<String> {
    shell_exec_with_stdin(
        cwd,
        &["jj", "describe", "-r", validate_revision(r), "--stdin"],
        m,
    )
}

#[tauri::command]
fn diff(cwd: &str, r: &str, c: i32, f: &str) -> Result<String> {
    shell_exec(
        cwd,
        &[
            "jj",
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
fn edit(cwd: &str, r: &str) -> Result<String> {
    shell_exec(cwd, &["jj", "edit", "-r", validate_revision(r)])
}

#[tauri::command]
fn log(cwd: &str) -> Result<String> {
    shell_exec(cwd, &["jj", "log", "-r", "ancestors(visible_heads(), 20)"])
}

#[tauri::command]
fn new(cwd: &str, r: &str) -> Result<String> {
    shell_exec(cwd, &["jj", "new", "-r", validate_revision(r)])
}

#[tauri::command]
fn rebase(cwd: &str, s: &str, o: &str) -> Result<String> {
    shell_exec(
        cwd,
        &[
            "jj",
            "rebase",
            "-s",
            validate_revision(s),
            "-o",
            validate_revision(o),
        ],
    )
}

#[tauri::command]
fn show(cwd: &str, r: &str) -> Result<String> {
    shell_exec(
        cwd,
        &["jj", "show", "--name-only", "-r", validate_revision(r)],
    )
}

#[tauri::command]
fn squash(cwd: &str, r: &str) -> Result<String> {
    shell_exec(cwd, &["jj", "squash", "-r", validate_revision(r)])
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
            log,
            new,
            rebase,
            show,
            squash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
