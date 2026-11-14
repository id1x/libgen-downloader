#!/usr/bin/env python3
"""Drive the mock harness in a pseudo-terminal and print screen snapshots.

Requires pyte (``pip install pyte``).

Usage:
    python3 dev/harness/capture.py --cols 90 --rows 30 \
        --steps '[{"wait": 1.0},
                  {"keys": "python", "after": 0.2},
                  {"keys": "\\r", "after": 2.0},
                  {"snap": "results"}]' \
        -- bun --preload /abs/path/dev/harness/preload.ts /abs/path/dev/harness/run.tsx

Step grammar (a JSON list):
    {"wait": seconds}                  pause, keeps draining output
    {"keys": "...", "after": seconds}  write keys, then pause ("after" defaults to 0.2)
    {"resize": [cols, rows]}           resize the pty mid-run (SIGWINCH)
    {"snap": "name"}                   drain output and print the screen

Key escapes: down \\u001b[B, up \\u001b[A, right \\u001b[C, left \\u001b[D,
enter \\r, tab \\t, esc \\u001b, PgDn \\u001b[6~.
"""

import argparse
import errno
import fcntl
import json
import os
import pty
import re
import select
import signal
import struct
import sys
import termios
import time

import pyte

DEFAULT_AFTER = 0.2
DEFAULT_KEY_DELAY = 0.03
PUMP_TICK = 0.02

# Ink parses one keypress per stdin chunk, so keys must be written one token
# at a time: a full escape sequence (ESC [ ... final byte) or one character.
ESCAPE_TOKEN = re.compile(r"\x1b(?:\[[0-9;]*[A-Za-z~])?|\x1b|.", re.DOTALL)


def key_tokens(keys):
    return ESCAPE_TOKEN.findall(keys)


class Terminal:
    def __init__(self, argv, cols, rows, env=None):
        self.cols = cols
        self.rows = rows
        self.screen = pyte.Screen(cols, rows)
        self.stream = pyte.ByteStream(self.screen)
        self.child_exited = False

        pid, fd = pty.fork()
        if pid == 0:
            # Child: pty.fork() already made the slave the controlling terminal
            # and wired it to stdin/stdout/stderr.
            try:
                os.execvpe(argv[0], argv, env or os.environ)
            except Exception as error:  # pragma: no cover - exec failure path
                print(f"capture.py: exec failed: {error}", file=sys.stderr)
                os._exit(127)

        self.pid = pid
        self.fd = fd
        # Winsize must be set before the child reads it; bun startup is slow
        # enough that this ioctl wins the race.
        self.set_winsize(cols, rows)

    def set_winsize(self, cols, rows):
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(self.fd, termios.TIOCSWINSZ, winsize)

    def resize(self, cols, rows):
        """Resize the pty mid-run; the ioctl raises SIGWINCH in the child."""
        self.cols = cols
        self.rows = rows
        # pyte's Screen.resize takes (lines, columns).
        self.screen.resize(rows, cols)
        self.set_winsize(cols, rows)

    def pump(self, timeout):
        """Read pending output into the screen for up to `timeout` seconds."""
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return
            try:
                ready, _, _ = select.select([self.fd], [], [], min(remaining, PUMP_TICK))
            except (OSError, ValueError):
                return
            if not ready:
                continue
            try:
                data = os.read(self.fd, 65536)
            except OSError as error:
                if error.errno in (errno.EIO, errno.EAGAIN):
                    self.child_exited = True
                    return
                raise
            if not data:
                self.child_exited = True
                return
            self.stream.feed(data)

    def send(self, keys, key_delay):
        for token in key_tokens(keys):
            try:
                os.write(self.fd, token.encode())
            except OSError:
                self.child_exited = True
                return
            # Keep Ink's per-chunk keypress parsing honest: one token per
            # chunk, paced like real typing.
            self.pump(key_delay)

    def display(self):
        return [row.rstrip() for row in self.screen.display]

    def terminate(self):
        try:
            os.kill(self.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            os.waitpid(self.pid, 0)
        except ChildProcessError:
            pass
        try:
            os.close(self.fd)
        except OSError:
            pass


def run_steps(terminal, steps, cols, rows, key_delay):
    for step in steps:
        if "wait" in step:
            terminal.pump(float(step["wait"]))
        elif "resize" in step:
            cols, rows = step["resize"]
            terminal.resize(int(cols), int(rows))
            terminal.pump(float(step.get("after", DEFAULT_AFTER)))
        elif "keys" in step:
            terminal.send(step["keys"], float(step.get("delay", key_delay)))
            terminal.pump(float(step.get("after", DEFAULT_AFTER)))
        elif "snap" in step:
            terminal.pump(PUMP_TICK)
            lines = terminal.display()
            print(f"=== snap {step['snap']} ({cols}x{rows}) ===")
            print("\n".join(lines))
            print()
        else:
            raise SystemExit(f"capture.py: unknown step {step}")

    if terminal.child_exited:
        print("=== child exited ===")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cols", type=int, default=90)
    parser.add_argument("--rows", type=int, default=30)
    parser.add_argument(
        "--key-delay",
        type=float,
        default=DEFAULT_KEY_DELAY,
        help="seconds between individual keys (default 0.03)",
    )
    parser.add_argument("--steps", required=True, help="JSON list of steps")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="command after --")
    arguments = parser.parse_args()

    command = arguments.command
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        raise SystemExit("capture.py: no command given after --")

    steps = json.loads(arguments.steps)

    env = dict(os.environ)
    env.setdefault("TERM", "xterm-256color")

    terminal = Terminal(command, arguments.cols, arguments.rows, env)
    try:
        run_steps(terminal, steps, arguments.cols, arguments.rows, arguments.key_delay)
    finally:
        terminal.terminate()


if __name__ == "__main__":
    main()
