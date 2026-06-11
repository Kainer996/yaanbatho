"""Burbz backend — wraps BirdNET for sound ID, photo ID, and manga bird art generation."""
import json
import os
import re
import tempfile
import hashlib
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from birdnetlib import Recording
from birdnetlib.analyzer import Analyzer
from photo_id import identify_bird_from_image, normalise_image_file

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Register image generation blueprint
try:
    from image_gen import image_gen_bp
    app.register_blueprint(image_gen_bp)
    print('Image generation blueprint registered.')
except ImportError as e:
    print(f'Image generation not available: {e}')

print('Loading BirdNET analyzer...')
analyzer = Analyzer()
print(f'Ready. {len(analyzer.labels)} species available.')

HERE = Path(__file__).resolve().parent
BIRD_DATA_PATH = HERE.parent / 'public' / 'burbz' / 'data' / 'birds.json'


def _norm_species_key(value):
    """Normalise bird names for safe exact/alias matching."""
    return re.sub(r'[^a-z0-9]+', ' ', (value or '').lower()).strip()


def _load_game_bird_catalog():
    """Load the data-driven Burbz species catalogue used by the public game."""
    try:
        with BIRD_DATA_PATH.open(encoding='utf-8') as fh:
            data = json.load(fh)
    except Exception as exc:
        print(f'Bird catalogue not available for sound ID aliases: {exc}')
        return {}

    lookup = {}
    for entry in data.get('species', []):
        names = [entry.get('common_name'), entry.get('latin_name'), entry.get('species_id')]
        names.extend(entry.get('aliases') or [])
        for name in names:
            key = _norm_species_key(name)
            if key:
                lookup[key] = entry
    print(f'Loaded {len(data.get("species", []))} Burbz bird catalogue species for sound ID matching.')
    return lookup


GAME_BIRD_CATALOG = _load_game_bird_catalog()

# BirdNET/common-photo names that often differ from our catalogue labels.  Keep
# this server-side so both sound and photo captures can be debugged against the
# same Burbz species IDs without awarding random fallback birds.
LOCAL_SPECIES_ALIASES = {
    'crow': 'Carrion Crow',
    'carrion crow': 'Carrion Crow',
    'hooded crow': 'Carrion Crow',
    'american crow': 'Carrion Crow',  # ImageNet/MobileNet label for a black crow
    'corvus brachyrhynchos': 'Carrion Crow',
    'corvus corone': 'Carrion Crow',
    'jackdaw': 'Eurasian Jackdaw',
    'eurasian jackdaw': 'Eurasian Jackdaw',
    'western jackdaw': 'Eurasian Jackdaw',
    'corvus monedula': 'Eurasian Jackdaw',
    'daurian jackdaw': 'Eurasian Jackdaw',
    'corvus dauuricus': 'Eurasian Jackdaw',
    'raven': 'Common Raven',
    'common raven': 'Common Raven',
    'corvus corax': 'Common Raven',
    'magpie': 'Eurasian Magpie',
    'eurasian magpie': 'Eurasian Magpie',
    'jay': 'Eurasian Jay',
    'eurasian jay': 'Eurasian Jay',
    'blackbird': 'Common Blackbird',
    'eurasian blackbird': 'Common Blackbird',
    'robin': 'European Robin',
    'european robin': 'European Robin',
    'wren': 'Eurasian Wren',
    'eurasian wren': 'Eurasian Wren',
    'kingfisher': 'Common Kingfisher',
    'common kingfisher': 'Common Kingfisher',
    'wood pigeon': 'Common Wood Pigeon',
    'woodpigeon': 'Common Wood Pigeon',
    'rock dove': 'Feral Pigeon',
    'rock pigeon': 'Feral Pigeon',
    'pied wagtail': 'White Wagtail',
}


def _catalog_lookup(*names):
    """Find a catalogue entry by exact key, local alias, or harmless prefix trim."""
    candidates = []
    for name in names:
        key = _norm_species_key(name)
        if not key:
            continue
        candidates.append(key)
        alias = LOCAL_SPECIES_ALIASES.get(key)
        if alias:
            candidates.append(_norm_species_key(alias))
        for prefix in ('common ', 'eurasian ', 'european '):
            if key.startswith(prefix):
                candidates.append(key[len(prefix):])
    for key in candidates:
        entry = GAME_BIRD_CATALOG.get(key)
        if entry:
            return entry
    return None


def species_to_game_bird(scientific_name, common_name, confidence):
    """Map a BirdNET detection to a Burbz game bird with deterministic stats."""
    catalog_entry = _catalog_lookup(scientific_name, common_name)
    display_name = catalog_entry.get('common_name') if catalog_entry else common_name
    display_scientific = catalog_entry.get('latin_name') if catalog_entry else scientific_name

    seed = int(hashlib.md5(display_scientific.encode()).hexdigest(), 16)
    base_power = 10 + (seed % 80)
    if catalog_entry and catalog_entry.get('base_stats'):
        stats = catalog_entry['base_stats']
        base_power = round((stats.get('hp', 50) * 0.25) + (stats.get('atk', 50) * 0.35) + (stats.get('def', 50) * 0.2) + (stats.get('spd', 50) * 0.3) + (stats.get('spl', 50) * 0.2))
    if catalog_entry and catalog_entry.get('rarity_tier'):
        rarity = catalog_entry['rarity_tier']
    elif base_power >= 70:
        rarity = 'epic'
    elif base_power >= 40:
        rarity = 'rare'
    else:
        rarity = 'common'
    emoji_pool = ['🐦', '🕊️', '🦅', '🐤', '🦆', '🦉', '🦢', '🦚', '🐦‍⬛', '🦃', '🦜', '🐧']
    emoji = emoji_pool[seed % len(emoji_pool)]
    return {
        'id': (catalog_entry.get('species_id') if catalog_entry else display_scientific.lower().replace(' ', '-')),
        'name': display_name,
        'scientificName': display_scientific,
        'emoji': emoji,
        'basePower': base_power,
        'rarity': rarity,
        'confidence': round(confidence, 3),
        'birdnetName': common_name,
        'catalogMatched': bool(catalog_entry),
    }


def _analyse_recording(path, min_conf=0.25, lat=None, lon=None, sensitivity=1.0, overlap=0.0):
    kwargs = {
        'analyzer': analyzer,
        'path': path,
        'min_conf': min_conf,
        'sensitivity': sensitivity,
        'overlap': overlap,
    }
    if lat is not None and lon is not None:
        kwargs.update({'lat': lat, 'lon': lon, 'week_48': -1})
    recording = Recording(**kwargs)
    recording.analyze()
    return recording.detections


def prepare_audio_for_birdnet(source_path):
    """Convert whatever the browser uploaded into BirdNET-friendly mono WAV.

    Mobile browsers usually record Opus/WebM. The old endpoint saved that as
    .wav, so BirdNET/librosa sometimes tried to read a WebM file as WAV and told
    Yaan the recording was unclear when the file format was actually the problem.
    """
    tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    tmp.close()
    cmd = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-i', source_path,
        '-ac', '1', '-ar', '48000', '-sample_fmt', 's16',
        tmp.name,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=25)
        if os.path.getsize(tmp.name) < 44:
            raise ValueError('converted audio was empty')
        return tmp.name
    except Exception:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)
        raise


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/api/identify/sound', methods=['POST'])
def identify_sound():
    if 'audio' not in request.files:
        return jsonify({'error': 'no audio file'}), 400

    audio = request.files['audio']
    lat = float(request.form.get('lat', 0)) if request.form.get('lat') else None
    lon = float(request.form.get('lon', 0)) if request.form.get('lon') else None

    with tempfile.NamedTemporaryFile(suffix='.upload', delete=False) as tmp:
        audio.save(tmp.name)
        uploaded_path = tmp.name

    tmp_path = None
    try:
        try:
            tmp_path = prepare_audio_for_birdnet(uploaded_path)
        except Exception as e:
            app.logger.warning('Sound ID could not convert audio: %s', e)
            return jsonify({
                'found': False,
                'message': 'Could not read that audio — try recording again for about 15 seconds.',
            }), 422

        try:
            # Field recordings are not studio clips. Phone browsers often hand us
            # compressed WebM with wind/road rumble; Merlin can keep listening and
            # surface weaker candidates, so Burbz needs a slightly more sensitive
            # first pass plus a cautious fallback rather than acting like silence.
            detections = _analyse_recording(
                tmp_path,
                min_conf=0.18,
                lat=lat,
                lon=lon,
                sensitivity=1.25,
                overlap=0.25,
            )
            if not detections:
                detections = _analyse_recording(
                    tmp_path,
                    min_conf=0.08,
                    lat=lat,
                    lon=lon,
                    sensitivity=1.35,
                    overlap=0.5,
                )
        except Exception as e:
            app.logger.warning('Sound ID could not analyse audio: %s', e)
            return jsonify({
                'found': False,
                'message': 'Could not read that audio — try a longer, clearer recording.',
            }), 422
        if not detections:
            app.logger.info(
                'Sound ID no detections: upload_bytes=%s wav_bytes=%s lat=%s lon=%s',
                os.path.getsize(uploaded_path) if os.path.exists(uploaded_path) else None,
                os.path.getsize(tmp_path) if tmp_path and os.path.exists(tmp_path) else None,
                lat,
                lon,
            )
            return jsonify({'found': False, 'message': 'No bird species matched — try a longer 15 second recording, away from engine/road noise.'})

        top = max(detections, key=lambda d: d['confidence'])
        bird = species_to_game_bird(top['scientific_name'], top['common_name'], top['confidence'])
        app.logger.info(
            'Sound ID top=%s/%s conf=%.3f catalog=%s candidates=%s',
            top.get('common_name'),
            top.get('scientific_name'),
            top.get('confidence', 0),
            bird.get('catalogMatched'),
            [f"{d.get('common_name')}:{d.get('confidence', 0):.3f}" for d in sorted(detections, key=lambda x: -x['confidence'])[:5]],
        )
        return jsonify({
            'found': True,
            'bird': bird,
            'birdnetName': top['common_name'],
            'scientificName': top['scientific_name'],
            'confidence': round(top['confidence'], 3),
            'catalogMatched': bird.get('catalogMatched', False),
            'allDetections': [
                {'name': d['common_name'], 'scientific': d['scientific_name'], 'confidence': round(d['confidence'], 3)}
                for d in sorted(detections, key=lambda x: -x['confidence'])[:5]
            ],
        })
    finally:
        for path in (uploaded_path, tmp_path):
            if path and os.path.exists(path):
                os.unlink(path)


@app.route('/api/identify/image', methods=['POST'])
def identify_image():
    capture_source = request.form.get('captureSource')
    if capture_source != 'camera':
        return jsonify({
            'found': False,
            'message': 'Photo ID only accepts a fresh camera capture.',
        }), 422

    if 'image' not in request.files:
        return jsonify({
            'found': False,
            'message': 'No camera image received.',
        }), 400

    content_length = request.content_length or 0
    if content_length > 10 * 1024 * 1024:
        return jsonify({
            'found': False,
            'message': 'That image is too large — try another live capture.',
        }), 413

    image = request.files['image']
    if image.mimetype and not image.mimetype.startswith('image/'):
        return jsonify({
            'found': False,
            'message': 'That does not look like an image — try another live capture.',
        }), 415

    raw_tmp_path = None
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.upload', delete=False) as raw_tmp:
            image.save(raw_tmp.name)
            raw_tmp_path = raw_tmp.name

        if os.path.getsize(raw_tmp_path) > 10 * 1024 * 1024:
            return jsonify({
                'found': False,
                'message': 'That image is too large — try another live capture.',
            }), 413

        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp_path = tmp.name

        normalise_image_file(raw_tmp_path, tmp_path)

        result = identify_bird_from_image(tmp_path)
        status = 200 if result.get('found') else 422
        return jsonify(result), status
    except ValueError as exc:
        return jsonify({'found': False, 'message': str(exc)}), 422
    except Exception as exc:
        app.logger.warning('Photo ID failed safely: %s', exc)
        return jsonify({
            'found': False,
            'message': 'Photo recognition could not analyse that image — try a clearer camera capture.',
        }), 422
    finally:
        for path in (raw_tmp_path, tmp_path):
            if path and os.path.exists(path):
                os.unlink(path)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5055, debug=False)
