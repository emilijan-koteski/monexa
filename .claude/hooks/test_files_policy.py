#!/usr/bin/env python3
"""Keeps test files off the remote.

Tests are welcome as scratch helpers while developing and may be committed locally, but
they must be deleted before pushing. Only files the branch *adds* relative to the base
are reported, so tests committed and later removed on the branch pass, and tests that
already exist on master are left alone.

Modes:
  pretool   PreToolUse hook for Bash; denies a `git push` that would ship tests.
  pre-push  Git pre-push hook; fails when a pushed ref adds test files compared to the base.
  check     Manual run; lists test files the branch adds, exits 1 if any.
"""
import json
import re
import subprocess
import sys

BASE_CANDIDATES = ("origin/master", "master")
ZERO_SHA = "0" * 40

TEST_FILE = re.compile(
    r"(^|/)("
    r"[^/]+_test\.go"
    r"|[^/]+\.(test|spec)\.[cm]?[jt]sx?"
    r"|__tests__/.+"
    r"|testutil/.+"
    r"|testdata/.+"
    r")$"
)
GIT_PUSH = re.compile(r"\bgit\b(?:\s+(?:-C|-c|--git-dir|--work-tree)\s+\S+|\s+-{1,2}[\w-]+(?:=\S+)?)*\s+push\b")
NO_VERIFY = re.compile(r"\s--no-verify\b")


def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def is_test_file(path):
    return bool(TEST_FILE.search(path))


def tests_in(diff_output):
    return sorted(p for p in (diff_output or "").splitlines() if p and is_test_file(p))


def base_ref():
    return next((ref for ref in BASE_CANDIDATES if git("rev-parse", "--verify", "--quiet", ref)), None)


def branch_tests(tip="HEAD", fallback_base=None):
    base = base_ref() or fallback_base
    if not base:
        return []
    merge_base = git("merge-base", base, tip)
    if not merge_base:
        return []
    return tests_in(git("diff", "--name-only", "--diff-filter=A", merge_base, tip))


def describe(files, action):
    listing = "\n".join(f"  - {path}" for path in files)
    return (
        f"Test files must not be {action}. They are only temporary development helpers in this repo:\n"
        f"{listing}\n"
        "Remove them in a commit (`git rm <files>`) before pushing. "
        "Do not bypass this with --no-verify; ask the user if a test genuinely needs to be kept."
    )


def run_pretool():
    payload = json.load(sys.stdin)
    command = payload.get("tool_input", {}).get("command", "")
    if not GIT_PUSH.search(command):
        return 0
    if NO_VERIFY.search(command):
        return deny("Do not bypass git hooks with --no-verify; the test-file policy runs there. Ask the user instead.")
    files = branch_tests()
    if not files:
        return 0
    return deny(describe(files, "pushed"))


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    return 0


def run_pre_push():
    files = set()
    for line in sys.stdin:
        parts = line.split()
        if len(parts) != 4 or parts[1] == ZERO_SHA:
            continue
        remote_sha = parts[3] if parts[3] != ZERO_SHA else None
        files |= set(branch_tests(parts[1], remote_sha))
    if files:
        print(describe(sorted(files), "pushed"), file=sys.stderr)
        return 1
    return 0


def run_check():
    files = branch_tests()
    if files:
        print(describe(files, "pushed"))
        return 1
    print("No added test files.")
    return 0


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    handlers = {"pretool": run_pretool, "pre-push": run_pre_push, "check": run_check}
    if mode not in handlers:
        print(f"unknown mode: {mode}", file=sys.stderr)
        return 2
    return handlers[mode]()


if __name__ == "__main__":
    sys.exit(main())
