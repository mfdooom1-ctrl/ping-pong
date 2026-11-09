# Pixel characters

`public/assets/characters.png` is an original 40×56-pixel atlas: 14 characters ×
9 states × 4 frames = 504 frames. JSON frame keys are `{id}-{state}-{frame}`.

States: `idle`, `move`, `windup`, `forehand`, `backhand`, `block`, `miss`,
`victory`, `defeat`. Palette changes for unlocked outfits and paddles are applied
to an atlas copy, preserving skin and hair. Large 112×144 portraits are separate
local PNGs. Artwork source is `scripts/generate-art.py`.

The two hero designs follow the supplied appearance references. No photographed
pixels, commercial logos or third-party game assets are included.
