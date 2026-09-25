"""Regenerates the code-made assets in ../assets (everything except the
tutorial hand image, handTutorial.png).

Needs Python 3 with numpy and Pillow, plus Blender (--blender or the BLENDER env
var), whose bundled FFmpeg encodes the sounds to MP3. PNGs are compressed with
pngquant (--pngquant, or found on PATH); without it they are left uncompressed.

python tools/build_assets.py [--out assets] [--blender path/to/blender] [--pngquant path/to/pngquant]
"""
import argparse
import os
import shutil
import subprocess
import tempfile

import check
import font
import icon
import logo
import sfx
import sparkle

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'assets'))
    ap.add_argument('--blender', default=os.environ.get('BLENDER', 'blender'))
    ap.add_argument('--pngquant', default=shutil.which('pngquant'))
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    for sub in ('fonts', 'images', 'sounds'):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    font.build(os.path.join(out, 'fonts', 'pixel-splash.ttf'))

    images = os.path.join(out, 'images')
    pngs = {
        'logo': os.path.join(images, 'logo.png'),
        'check': os.path.join(images, 'check_mark.png'),
        'icon': os.path.join(out, 'Game_Logo.png'),
    }
    logo.main(pngs['logo'])
    check.main(pngs['check'])
    icon.main(pngs['icon'])
    sparkle.main(os.path.join(images, 'sparkle.webp'))

    if args.pngquant:
        for png in pngs.values():
            subprocess.run([args.pngquant, '--quality=70-92', '--speed', '1', '--strip', '--force', '--output', png, '--', png],
                           check=True)
    else:
        print('pngquant not found: PNGs left uncompressed')

    with tempfile.TemporaryDirectory() as tmp:
        sfx.write_all(tmp)
        subprocess.run([args.blender, '-b', '--factory-startup', '--python', os.path.join(HERE, 'encode_mp3.py'), '--',
                        tmp, os.path.join(out, 'sounds')], check=True)


if __name__ == '__main__':
    main()
