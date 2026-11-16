# Photographic lighting asset

- File: `cloudy-sky-1k.hdr`, 1,435,119 bytes.
- Original: **Kloofendal 48d Partly Cloudy (Pure Sky)**, Poly Haven.
- Asset: https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky
- Download: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr
- License: CC0 1.0. https://polyhaven.com/license and https://creativecommons.org/publicdomain/zero/1.0/
- Original MD5 from the public asset API: `c69498687e876bf68d2a8b8a62234eb9`.

This photograph supplies sky lighting and glass reflections. It is a generic sky, not photography of Pangyo or an actual street-view image. It is bundled locally; visitors do not call an external image API. The game retains a procedural sky if loading fails.

`vendor/RGBELoader.js` is the Three.js 0.170.0 official HDR loader, under the existing Three.js MIT license. Its `three` import is adapted to the vendored module.
