import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import vscode_mcp


class VscodeMcpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.workspace = self.root / "workspace"
        self.workspace.mkdir()
        self.root_patch = patch.object(vscode_mcp, "get_root", return_value=self.workspace)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.addCleanup(self.temp.cleanup)

    def test_catalog_has_24_unique_tools(self):
        names = [tool["name"] for tool in vscode_mcp.TOOLS]
        self.assertEqual(len(names), 24)
        self.assertEqual(len(set(names)), 24)

    def test_file_operations_stay_in_workspace(self):
        vscode_mcp.create_file("src/app.js", "export function start() {}\n")
        vscode_mcp.create_file(".github/workflows/check.yml", "name: check\n")
        self.assertIn("export function start", vscode_mcp.read_file("src/app.js"))
        outline = vscode_mcp.get_file_outline("src/app.js")
        self.assertEqual(outline, [{"name": "start", "line": 1}])
        vscode_mcp.edit_file("src/app.js", "start", "run")
        self.assertIn("function run", vscode_mcp.read_file("src/app.js"))
        self.assertEqual(vscode_mcp.find_files(".", "*.js"), ["src/app.js"])
        self.assertEqual(
            vscode_mcp.find_files(".", "*.yml"),
            [".github/workflows/check.yml"],
        )
        self.assertEqual(len(vscode_mcp.read_files(["src/app.js"])), 1)
        with self.assertRaises(ValueError):
            vscode_mcp.read_file("../outside.txt")

    def test_copy_and_move_do_not_overwrite(self):
        (self.workspace / "source.txt").write_text("content", encoding="utf-8")
        vscode_mcp.copy_file("source.txt", "copy.txt")
        self.assertEqual((self.workspace / "copy.txt").read_text(encoding="utf-8"), "content")
        with self.assertRaises(FileExistsError):
            vscode_mcp.copy_file("source.txt", "copy.txt")
        vscode_mcp.move_file("source.txt", "moved.txt")
        self.assertFalse((self.workspace / "source.txt").exists())
        self.assertTrue((self.workspace / "moved.txt").exists())

    def test_edit_requires_unique_snippet_by_default(self):
        (self.workspace / "duplicate.txt").write_text("same same", encoding="utf-8")
        with self.assertRaises(ValueError):
            vscode_mcp.edit_file("duplicate.txt", "same", "new")
        vscode_mcp.edit_file("duplicate.txt", "same", "new", replace_all=True)
        self.assertEqual(
            (self.workspace / "duplicate.txt").read_text(encoding="utf-8"),
            "new new",
        )

    def test_read_file_lines_reads_beyond_max_file_chars(self):
        long_line = "x" * 1000
        lines = [f"line-{i}-{long_line}" for i in range(1, 251)]
        (self.workspace / "large.txt").write_text("\n".join(lines), encoding="utf-8")
        tail = vscode_mcp.read_file_lines("large.txt", 245, 250)
        self.assertIn("250: line-250-", tail)
        self.assertNotIn("[truncated]", tail)

    def test_tools_list_always_advertises_catalog_and_notifications_are_silent(self):
        sent = []
        with patch.object(vscode_mcp, "send_message", side_effect=sent.append), \
             patch.object(vscode_mcp, "_vscode_active_folder", return_value=None):
            vscode_mcp.handle_request({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
            vscode_mcp.handle_request({"jsonrpc": "2.0", "method": "notifications/initialized"})
            vscode_mcp.handle_request({"jsonrpc": "2.0", "method": "notifications/cancelled"})
            vscode_mcp.handle_request({"jsonrpc": "2.0", "id": 2, "method": "ping"})
        self.assertEqual(len(sent), 2)
        self.assertEqual(len(sent[0]["result"]["tools"]), 24)
        self.assertEqual(sent[1]["result"], {})

    def test_vscode_active_folder_supports_backup_workspaces_and_folder_uri(self):
        storage_file = self.root / "storage.json"
        storage_file.write_text(
            '{"backupWorkspaces": {"folders": [{"folderUri": "' + self.workspace.as_uri() + '"}]}}',
            encoding="utf-8",
        )
        with patch.object(vscode_mcp, "_vscode_running", return_value=True), \
             patch.object(vscode_mcp, "_vscode_storage_paths", return_value=[storage_file]):
            self.assertEqual(vscode_mcp._vscode_active_folder(), self.workspace)

    def test_macos_process_detection_does_not_match_every_electron_app(self):
        completed = unittest.mock.Mock(returncode=1, stdout="")
        with patch.object(vscode_mcp.os, "name", "posix"), \
             patch.object(vscode_mcp.sys, "platform", "darwin"), \
             patch.object(vscode_mcp.subprocess, "run", return_value=completed) as run:
            self.assertFalse(vscode_mcp._vscode_running())
        self.assertEqual(run.call_args.args[0][0:2], ["pgrep", "-f"])
        self.assertNotIn(r"|/MacOS/Electron", run.call_args.args[0][2])


if __name__ == "__main__":
    unittest.main()
