import tempfile
import unittest
from pathlib import Path

from tools.build_total_review_package import source_inventory


class SourceInventoryTests(unittest.TestCase):
    def test_runtime_caches_and_local_databases_are_never_packaged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            included = root / "backend" / "app" / "main.py"
            included.parent.mkdir(parents=True)
            included.write_text("print('safe source')\n", encoding="utf-8")

            excluded = [
                root / ".pytest_cache" / "v" / "cache" / "nodeids",
                root / ".venv" / "bin" / "python",
                root / "backend" / "calorieapp.db",
                root / "backend" / "local.sqlite",
                root / "backend" / "local.sqlite3",
                root / "frontend" / ".next" / "build-manifest.json",
                root / "frontend" / "node_modules" / "package" / "index.js",
                root / "tools" / "__pycache__" / "builder.pyc",
                root / "dist" / "release.zip",
                root / "frontend" / "tsconfig.tsbuildinfo",
            ]
            for path in excluded:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"must not ship")

            self.assertEqual(source_inventory(root), [Path("backend/app/main.py")])


if __name__ == "__main__":
    unittest.main()
