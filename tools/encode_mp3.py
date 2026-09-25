"""WAV -> MP3 through Blender's bundled FFmpeg (audaspace), so no separate
encoder is needed. Run inside Blender:

blender -b --factory-startup --python encode_mp3.py -- <wav dir> <mp3 dir>
"""
import os
import sys
import aud

src_dir, dst_dir = sys.argv[sys.argv.index('--') + 1:]
bitrates = {'win': 64000}
for name in ('select', 'fill', 'color-complete', 'win'):
    sound = aud.Sound(os.path.join(src_dir, name + '.wav'))
    sound.write(os.path.join(dst_dir, name + '.mp3'), rate=44100, channels=aud.CHANNELS_MONO, format=aud.FORMAT_S16,
                container=aud.CONTAINER_MP3, codec=aud.CODEC_MP3, bitrate=bitrates.get(name, 96000))
    print('encoded', name)
