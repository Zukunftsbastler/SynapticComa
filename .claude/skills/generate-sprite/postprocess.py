#!/usr/bin/env python3
"""Post-processes a Draw Things icon render for use as a game sprite.

Keys near-black pixels to transparent (icons are always generated on a
"plain solid black background" per the prompt template in SKILL.md), then
resizes/pads to a square canvas. Background/panorama images should NOT be
run through this — pass --no-key-black and skip padding for those instead.

Floor tiles (HEX_ID_FLOOR / HEX_SUPEREGO_FLOOR) additionally need --hex-mask:
the model reliably draws an octagon instead of a true 6-sided flat-top hexagon
when asked for "a hexagonal tile" (confirmed 2026-07-21, both dimensions) —
fixing the exact silhouette in code is far more reliable than fighting the
model over geometry through prompt wording alone.
"""
import argparse
import colorsys
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def key_black_to_alpha(im: Image.Image, threshold: int) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (r, g, b, 0)
    return im


def autocrop(im: Image.Image, margin_frac: float) -> Image.Image:
    """Crops to the bounding box of non-transparent content (using the ALPHA
    channel specifically, not getbbox()'s default all-zero-RGBA test — a
    black-keyed pixel keeps its original RGB with only alpha zeroed, so a
    plain getbbox() call would not treat it as blank), expanded by
    `margin_frac` on each side. Fixes small-subject-in-a-big-frame icons
    (2026-07-22: `focus_node`/`hazard_phase_barrier` came out with the actual
    content occupying under a third of the square) without needing to keep
    re-rolling seeds hoping for a larger, more-centered composition. Run
    AFTER black-keying, BEFORE fit_square.
    """
    im = im.convert("RGBA")
    bbox = im.split()[-1].getbbox()
    if bbox is None:
        return im
    x0, y0, x1, y1 = bbox
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = max(x1 - x0, y1 - y0) * (1 + margin_frac) / 2
    crop_box = (
        max(0, round(cx - half)), max(0, round(cy - half)),
        min(im.width, round(cx + half)), min(im.height, round(cy + half)),
    )
    return im.crop(crop_box)


def fit_square(im: Image.Image, size: int) -> Image.Image:
    im = im.copy()
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - im.width) // 2
    y = (size - im.height) // 2
    canvas.paste(im, (x, y), im if im.mode == "RGBA" else None)
    return canvas


def pixelate(im: Image.Image, cell_size: int) -> Image.Image:
    """Downscales so the LONGER side is `cell_size` pixels (BOX filter — a
    clean area-average, not a blur), preserving aspect ratio so pixel blocks
    stay square rather than stretching on non-square images (decals), then
    scales back up to the original size with NEAREST (hard pixel edges, no
    re-smoothing). Produces a deliberate chunky/pixel-art look rather than a
    photoreal texture that turns to visual mush once the game actually
    displays it at ~80px (Till's feedback, 2026-07-21: source art was tuned
    for a much larger display size than the hex tiles actually render at).
    Run this BEFORE --hex-mask, so the mask's clean edge isn't re-blurred by
    the final NEAREST upscale.
    """
    w, h = im.size
    scale = cell_size / max(w, h)
    small_w, small_h = max(1, round(w * scale)), max(1, round(h * scale))
    small = im.resize((small_w, small_h), Image.BOX)
    return small.resize((w, h), Image.NEAREST)


def radial_fade(im: Image.Image, inner_frac: float, outer_frac: float) -> Image.Image:
    """Multiplies alpha by a smooth radial falloff: fully opaque inside
    `inner_frac` of the half-diagonal, fully transparent past `outer_frac`,
    smoothstep-blended between. A code-side GUARANTEE that every icon-style
    sprite ends with a soft, fully transparent margin — regardless of whether
    the model drew a clean isolated subject or (as ID/SUPEREGO material
    presets kept doing, 2026-07-22) its own square plaque/panel behind it.
    Fighting that prior through prompt wording alone was never fully
    reliable; this makes the transparent-edge requirement unconditional
    instead of "usually true if the prompt worked." Run AFTER black-keying,
    so it also mops up a panel that keying alone didn't fully remove.
    """
    im = im.convert("RGBA")
    w, h = im.size
    cx, cy = w / 2, h / 2
    max_r = min(w, h) / 2
    inner_r = max_r * inner_frac
    outer_r = max_r * outer_frac
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            d = math.hypot(x - cx, y - cy)
            if d <= inner_r:
                continue
            if d >= outer_r:
                px[x, y] = (r, g, b, 0)
                continue
            t = (d - inner_r) / (outer_r - inner_r)
            factor = 1.0 - (t * t * (3 - 2 * t))  # smoothstep
            px[x, y] = (r, g, b, round(a * factor))
    return im


def feather(im: Image.Image, radius: float) -> Image.Image:
    """Gaussian-blurs ONLY the alpha channel (RGB stays crisp) — a genuinely
    soft/fuzzy cutout edge rather than `radial_fade`'s smoothstep ramp, which
    fades opacity smoothly by distance but leaves the underlying silhouette's
    own edge (from black-keying) just as hard as before. Till's ask,
    2026-07-22: every decal-style overlay needs a "fuzzy Rand" so it visually
    blends into the floor tile it sits on rather than reading as a cutout
    pasted on top. Run LAST, after radial_fade/autocrop/hex-mask, so it softens
    whatever edge those left rather than being redone by a later hard step.
    """
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    a = a.filter(ImageFilter.GaussianBlur(radius))
    return Image.merge("RGBA", (r, g, b, a))


def recolor_toward(
    im: Image.Image, hue_deg: float, min_saturation: float, skip_below_saturation: float = 0.12,
    min_value: float = 0.0,
) -> Image.Image:
    """Locks hue to `hue_deg` and floors saturation at `min_saturation` for
    pixels that already carry real color — a code-side GUARANTEE that a "red
    door" is unambiguously red rather than whatever rust/blood/brown tone the
    model happened to render (Till's ask, 2026-07-22: "Rot muss wirklich
    deutlich sichtbar rot sein"). Same philosophy as `radial_fade`/`autocrop`:
    fix it in code rather than re-rolling seeds hoping for better color
    fidelity. Pixels already near-neutral (saturation below
    `skip_below_saturation` — metal rivets, gray shadow, near-white
    highlights) are left alone instead of being forced into color too,
    otherwise every metal fixture on the door would turn red/blue as well and
    the material would stop reading as metal at all. `min_value` additionally
    floors brightness — needed for naturally dark/muted materials (steel):
    flooring saturation alone on a dark pixel still produces a technically-
    correct but visually dark, muted "navy blob" that doesn't read as
    "clearly blue" at a glance (confirmed on `HAZARD_LOCKED_BLUE` — the
    steel's low value meant the color was right but too dark to register).
    Leave `min_value` at 0 for materials that are already bright enough
    (velvet/flesh tones typically are).
    """
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    target_h = (hue_deg % 360) / 360.0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s < skip_below_saturation:
                continue
            s = max(s, min_saturation)
            v = max(v, min_value)
            nr, ng, nb = colorsys.hsv_to_rgb(target_h, s, v)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return im


def apply_hex_mask(im: Image.Image) -> Image.Image:
    """Crops to an exact flat-top hexagon inscribed in the image's square
    canvas — matches src/rendering/HexMath.ts's hexCorners() (corners at
    0°,60°,...). Replaces the alpha channel outright (rather than
    intersecting with whatever silhouette the model itself drew, e.g. the
    octagon it reliably produces instead of a true hexagon — confirmed
    2026-07-21): the model's own edge and this mask's edge don't align, so
    intersecting them left extra facets showing through instead of a clean
    hexagon. This assumes the source image has real content out to its
    corners (true for the "hexagonal tile" prompt shape, NOT for icons keyed
    with --no-key-black already applied) — run this only for floor tiles.
    """
    im = im.convert("RGBA")
    w, h = im.size
    cx, cy = w / 2, h / 2
    radius = min(w, h) / 2
    corners = [
        (cx + radius * math.cos(math.radians(60 * i)),
         cy + radius * math.sin(math.radians(60 * i)))
        for i in range(6)
    ]
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(corners, fill=255)
    im.putalpha(mask)
    return im


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--size", type=int, default=128, help="Output square canvas size (icons only).")
    ap.add_argument("--threshold", type=int, default=12, help="Max R/G/B value treated as background black.")
    ap.add_argument("--no-key-black", action="store_true", help="Skip transparency keying (use for backgrounds).")
    ap.add_argument("--no-resize", action="store_true", help="Skip the fit-to-square-canvas step.")
    ap.add_argument("--hex-mask", action="store_true", help="Crop to an exact flat-top hexagon (floor tiles).")
    ap.add_argument("--pixelate", type=int, default=0, metavar="N",
                     help="Downscale to an NxN grid then NEAREST back up — deliberate pixel-art look "
                          "instead of a high-detail texture that mushes together at actual in-game size.")
    ap.add_argument("--radial-fade", action="store_true",
                     help="Force a smooth alpha falloff to fully transparent past --radial-fade-outer "
                          "(icon-style special-tile sprites — guarantees a clean transparent margin "
                          "even if the model drew its own background panel).")
    ap.add_argument("--radial-fade-inner", type=float, default=0.55, metavar="FRAC")
    ap.add_argument("--radial-fade-outer", type=float, default=0.90, metavar="FRAC")
    ap.add_argument("--autocrop-margin", type=float, default=None, metavar="FRAC",
                     help="Crop to the alpha bounding box + FRAC margin before resizing — "
                          "fixes a small subject centered in a mostly-empty frame.")
    ap.add_argument("--feather", type=float, default=0, metavar="PX",
                     help="Gaussian-blur the alpha channel by PX — a genuinely soft/fuzzy edge "
                          "(not just gradually more transparent) so the icon blends into whatever "
                          "floor tile it's layered over instead of reading as a pasted-on cutout.")
    ap.add_argument("--recolor-hue", type=float, default=None, metavar="DEGREES",
                     help="Lock every visible pixel's hue to this value (0=red, 240=blue, ...) — "
                          "guarantees an unambiguous color identity regardless of the model's exact tone.")
    ap.add_argument("--recolor-min-saturation", type=float, default=0.65, metavar="0-1")
    ap.add_argument("--recolor-min-value", type=float, default=0.0, metavar="0-1",
                     help="Floor brightness too — needed for naturally dark materials (steel) where "
                          "flooring saturation alone still looks like a dark, muted blob.")
    ap.add_argument("--recolor-skip-below-saturation", type=float, default=0.12, metavar="0-1")
    args = ap.parse_args()

    im = Image.open(args.input)
    if not args.no_key_black:
        im = key_black_to_alpha(im, args.threshold)
    if args.autocrop_margin is not None:
        im = autocrop(im, args.autocrop_margin)
    if not args.no_resize:
        im = fit_square(im, args.size)
    if args.pixelate:
        im = pixelate(im, args.pixelate)
    if args.radial_fade:
        im = radial_fade(im, args.radial_fade_inner, args.radial_fade_outer)
    if args.recolor_hue is not None:
        im = recolor_toward(
            im, args.recolor_hue, args.recolor_min_saturation,
            skip_below_saturation=args.recolor_skip_below_saturation, min_value=args.recolor_min_value,
        )
    if args.hex_mask:
        im = apply_hex_mask(im)
    if args.feather:
        im = feather(im, args.feather)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    im.save(args.output)
    print(f"Wrote {args.output} ({im.size[0]}x{im.size[1]}, mode={im.mode})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
