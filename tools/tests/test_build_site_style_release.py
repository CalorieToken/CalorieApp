import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path
from tools import build_site_style_release as release


class SiteStyleReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.plugin = self.root / release.SLUG
        shutil.copytree(release.PLUGIN, self.plugin)

    def test_repeatable_archive_contains_exact_runtime_sources(self):
        first = release.build(self.root / 'first', self.plugin)
        second = release.build(self.root / 'second', self.plugin)
        self.assertEqual(first, second)
        with zipfile.ZipFile(self.root / 'first' / first['archive']) as archive:
            self.assertEqual(len(archive.namelist()), len(release.FILES))
            for path in release.FILES:
                self.assertEqual(archive.read(release.SLUG + '/' + path), (self.plugin / path).read_bytes())
        manifest = json.loads((self.root / 'first' / f"{release.SLUG}-{first['version']}.manifest.json").read_text())
        self.assertEqual(manifest, first)

    def test_unreviewed_file_is_rejected(self):
        (self.plugin / 'private-backup.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'inventory'):
            release.build(self.root / 'output', self.plugin)

    def test_missing_asset_is_rejected(self):
        (self.plugin / 'assets/refinements.css').unlink()
        with self.assertRaisesRegex(ValueError, 'inventory'):
            release.build(self.root / 'output', self.plugin)

    def test_version_mismatch_is_rejected(self):
        main = self.plugin / (release.SLUG + '.php')
        main.write_text(main.read_text().replace("const VERSION = '", "const VERSION = '99"))
        with self.assertRaisesRegex(ValueError, 'version'):
            release.build(self.root / 'output', self.plugin)

    def test_symlink_is_rejected(self):
        asset = self.plugin / 'assets/refinements.css'
        asset.unlink()
        asset.symlink_to(release.PLUGIN / 'assets/refinements.css')
        with self.assertRaisesRegex(ValueError, 'symlinks'):
            release.build(self.root / 'output', self.plugin)


if __name__ == '__main__':
    unittest.main()
