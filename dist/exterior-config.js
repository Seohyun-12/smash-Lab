// Observation-based reconstruction. Dimensions below are game-scale approximations.
// Sources and confidence: docs/exterior-reference.md §§3.2–3.7.
const sources = [
  'https://junglim.com/pangyo-innovally-cluster/',
  'https://www.cosmax.com/ko-KR/our-innovations/research-innovation/',
  'V-World aerial observation, 2026-11-16 (reference pixels not included)',
];

export function exteriorFor(id) {
  return {
    verified: false,
    sources,
    frameSides: ['+z', '-z'],
    frameBottomFloors: 1.4,
    portholes: {
      side: '-x',
      floors: [3, 5, 6, 8],
      confidence: id === 'F' ? 'photo-confirmed' : 'pattern-inferred',
    },
    faces: {
      '+z': {
        type: 'curtainWall',
        glass: '#6f9fb4',
        frame: '#4a4f52',
        confidence: id === 'E' ? 'photo-confirmed' : 'photo-partial',
      },
      '-z': {
        type: 'curtainWall',
        glass: '#79a9ba',
        frame: '#4a4f52',
        confidence: 'photo-partial',
      },
      '+x': { type: 'metalLouver', confidence: 'pattern-inferred' },
      '-x': {
        type: 'metalLouver',
        confidence: id === 'F' ? 'photo-confirmed' : 'pattern-inferred',
      },
    },
    glassBoxes:
      id === 'E'
        ? [
            {
              u: 0.25,
              floor: 3,
              width: 4.2,
              floors: 1.5,
              depth: 0.9,
              accent: '#f0a030',
              length: 6.8,
            },
            {
              u: 0.63,
              floor: 5,
              width: 4.2,
              floors: 1.5,
              depth: 0.9,
              accent: '#d6336c',
              length: 7.6,
            },
            {
              u: 0.46,
              floor: 7,
              width: 3.5,
              floors: 1.4,
              depth: 0.85,
              accent: '#f0a030',
              length: 6,
            },
          ]
        : [],
    signs:
      id === 'E'
        ? [
            {
              text: 'INNOVALLEY',
              subtitle: '판교이노밸리',
              side: '+z',
              u: 0.8,
              floor: 9,
              role: 'innovalley-sign',
            },
          ]
        : [
            {
              text: 'COSMAX',
              color: '#41494b',
              side: '-x',
              u: 0.78,
              floor: 1,
              role: 'cosmax-sign',
            },
          ],
    roof:
      id === 'E'
        ? { type: 'equipment-garden', confidence: 'aerial-observed' }
        : { type: 'cooling-courtyard', confidence: 'aerial-observed' },
  };
}
