"""Bundle the canonical privacy policy for offline reading in the game."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
text = (root / 'PRIVACY.md').read_text()
text = re.sub(r'^#{1,6} ', '', text, flags=re.M).replace('**', '').replace('`', '')
text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', text)
content = '// Generated from PRIVACY.md by tools/build_privacy.py.\nwindow.MeteorPrivacy = ' + json.dumps(text, ensure_ascii=False) + ';\n'
target = root / 'app/src/main/assets/privacy.js'
if '--check' in sys.argv:
    if not target.exists() or target.read_text() != content:
        raise SystemExit('Regenerate the bundled privacy policy: python3 tools/build_privacy.py')
else:
    target.write_text(content)
