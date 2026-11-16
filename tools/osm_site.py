#!/usr/bin/env python3
"""Generate the E/F site in one local coordinate frame from an OSM snapshot.

Map data © OpenStreetMap contributors, ODbL 1.0.
Example: python3 tools/osm_site.py --input data/innovalley-osm.json --output dist/site.js
Without --input, download the bounded area from the official OSM API.
"""
import argparse
import json
import math
from pathlib import Path
import urllib.request

TARGETS = {'E': 684716463, 'F': 684716461}
API = 'https://api.openstreetmap.org/api/0.6'
BBOX = (127.1000, 37.4025, 127.1052, 37.4062)
RADIUS_M = 150
FLOOR_HEIGHT_GAME = 2.3
ROAD_WIDTH_M = {'primary': 24, 'primary_link': 9, 'secondary': 18, 'tertiary': 12,
                'residential': 8, 'service': 6, 'cycleway': 3, 'pedestrian': 5, 'footway': 2.5}
SOURCE_URL = f"{API}/map.json?bbox={','.join(map(str, BBOX))}"


def fetch():
    req = urllib.request.Request(SOURCE_URL, headers={'User-Agent': 'smash-lab-site-generator/1.1'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def generate(data):
    nodes = {e['id']: (e['lat'], e['lon']) for e in data['elements'] if e['type'] == 'node'}
    ways = {e['id']: e for e in data['elements'] if e['type'] == 'way'}

    def ring(way):
        ids = way['nodes']
        if ids[0] != ids[-1] or len(ids) < 4:
            raise ValueError(f"Building {way['id']} does not have a closed footprint")
        return [nodes[node] for node in ids[:-1]]

    reference = ways[TARGETS['E']]
    reference_ring = ring(reference)
    lat0 = sum(p[0] for p in reference_ring) / len(reference_ring)
    lon0 = sum(p[1] for p in reference_ring) / len(reference_ring)
    kx, kz = 111320 * math.cos(math.radians(lat0)), 110540

    def meters(point):
        return ((point[1] - lon0) * kx, -(point[0] - lat0) * kz)

    points = [meters(p) for p in reference_ring]
    edges = [(points[i], points[(i + 1) % len(points)]) for i in range(len(points))]
    a, b = max(edges, key=lambda edge: math.dist(*edge))
    angle = math.atan2(b[1] - a[1], b[0] - a[0])
    cos, sin = math.cos(-angle), math.sin(-angle)

    def local(point):
        x, z = meters(point)
        return x * cos - z * sin, x * sin + z * cos

    local_ring = [local(p) for p in reference_ring]
    cx = (min(p[0] for p in local_ring) + max(p[0] for p in local_ring)) / 2
    cz = (min(p[1] for p in local_ring) + max(p[1] for p in local_ring)) / 2
    reference_height = float(reference['tags']['height'])
    scale = FLOOR_HEIGHT_GAME * int(reference['tags']['building:levels']) / reference_height

    def game(point):
        x, z = local(point)
        return [round((x - cx) * scale, 3), round((z - cz) * scale, 3)]

    targets = []
    for letter, way_id in TARGETS.items():
        way = ways[way_id]
        tags = way['tags']
        outline = [game(p) for p in ring(way)]
        xs, zs = [p[0] for p in outline], [p[1] for p in outline]
        height, levels = float(tags['height']), int(tags['building:levels'])
        if height <= 0 or levels <= 0:
            raise ValueError(f'Invalid height/levels on {way_id}')
        targets.append({
            'id': letter, 'name': tags['name'], 'osmWay': way_id,
            'osmVersion': way.get('version'), 'osmTimestamp': way.get('timestamp'),
            'sourceUrl': f'https://www.openstreetmap.org/way/{way_id}',
            'heightMeters': height, 'height': round(height * scale, 4), 'levels': levels,
            'footprintMeters': [round((max(xs) - min(xs)) / scale, 1),
                                round((max(zs) - min(zs)) / scale, 1)],
            'center': [round((min(xs) + max(xs)) / 2, 3), round((min(zs) + max(zs)) / 2, 3)],
            'outline': outline,
        })

    neighbors, roads = [], []
    for way in ways.values():
        if way['id'] in TARGETS.values():
            continue
        tags = way.get('tags', {})
        coords = [nodes[n] for n in way['nodes'] if n in nodes]
        if len(coords) < 2:
            continue
        positions = [game(p) for p in coords]
        mx = sum(p[0] for p in positions) / len(positions) / scale
        mz = sum(p[1] for p in positions) / len(positions) / scale
        if 'building' in tags:
            if math.hypot(mx, mz) > RADIUS_M or way['nodes'][0] != way['nodes'][-1]:
                continue
            height = float(tags.get('height') or float(tags.get('building:levels', 3)) * 4)
            base = float(tags.get('min_height', 0))
            if height <= base:
                continue
            neighbors.append({'osmWay': way['id'], 'name': tags.get('name', ''),
                              'height': round(height * scale, 3), 'base': round(base * scale, 3),
                              'heightEstimated': 'height' not in tags, 'outline': positions[:-1]})
        elif tags.get('highway') in ROAD_WIDTH_M:
            roads.append({'name': tags.get('name', ''), 'kind': tags['highway'],
                          'width': round(ROAD_WIDTH_M[tags['highway']] * scale, 3), 'path': positions})

    e = targets[0]
    return {
        'source': 'OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0)',
        'sourceUrl': SOURCE_URL, 'snapshot': 'data/innovalley-osm.json',
        'coordinateFrame': {'originLat': lat0, 'originLon': lon0, 'rotationRadians': angle,
                            'metersToGameUnits': scale},
        'name': e['name'], 'levels': e['levels'], 'heightMeters': e['heightMeters'],
        'footprintMeters': e['footprintMeters'], 'scale': scale, 'footprint': e['outline'],
        'targets': targets, 'neighbors': sorted(neighbors, key=lambda n: (-n['height'], n['osmWay'])),
        'roads': roads,
    }


def serialize(site):
    return ('// Generated by tools/osm_site.py — do not edit by hand.\n'
            '// Map data © OpenStreetMap contributors, ODbL 1.0. https://www.openstreetmap.org/copyright\n'
            '// Both targets share the E-local coordinate frame; heights are OSM tags, not surveyed values.\n'
            'export const site = ' + json.dumps(site, ensure_ascii=False, separators=(',', ':')) + ';\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, help='Saved OSM API JSON (offline reproducible input)')
    parser.add_argument('--output', type=Path, help='Write generated JS atomically; default stdout')
    args = parser.parse_args()
    data = json.loads(args.input.read_text()) if args.input else fetch()
    output = serialize(generate(data))
    if args.output:
        temporary = args.output.with_suffix(args.output.suffix + '.tmp')
        temporary.write_text(output)
        temporary.replace(args.output)
    else:
        print(output, end='')


if __name__ == '__main__':
    main()
