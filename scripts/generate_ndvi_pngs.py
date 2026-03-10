"""
Convert per-hour NDVI GeoTIFF rasters into compact, web-ready PNGs.
Uses a single color scale (global min/max across all hours) so temporal
changes are visible when switching; RdYlGn colormap for strong contrast
(low NDVI = red, high = green).

Usage:
    python3 scripts/generate_ndvi_pngs.py

Reads  : ../03 NDVI/Results/{hour}/NDVI_Resampled_Clipped_{hour}.tif
Writes : public/ndvi/ndvi_{hour}.png   (RGBA, max-width 1280)
"""

from pathlib import Path

import numpy as np
import rasterio
from PIL import Image as PILImage
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize

matplotlib.use("Agg")

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
NDVI_SRC = PROJECT_ROOT.parent / "03 NDVI" / "Results"
OUT_DIR = PROJECT_ROOT / "public" / "ndvi"
OUT_DIR.mkdir(parents=True, exist_ok=True)

HOURS = ["1000", "1100", "1200", "1300", "1400", "1500", "1600", "1700"]

# Strong contrast: red (low NDVI) -> yellow -> green (high NDVI)
CMAP = plt.get_cmap("RdYlGn")
TARGET_WIDTH = 1280


def read_band(tif_path: Path):
    with rasterio.open(tif_path) as src:
        band = src.read(1).astype(np.float64)
        nodata = src.nodata
    if nodata is not None:
        mask = (band != nodata) & ~np.isnan(band)
    else:
        mask = ~np.isnan(band)
    return band, mask


def global_minmax():
    """Compute min/max across all TIFs so same NDVI value = same color across time."""
    all_valid = []
    for hour in HOURS:
        tif = NDVI_SRC / hour / f"NDVI_Resampled_Clipped_{hour}.tif"
        if not tif.exists():
            continue
        band, mask = read_band(tif)
        v = band[mask]
        if v.size:
            all_valid.append(v)
    if not all_valid:
        return 0.0, 1.0
    concat = np.concatenate(all_valid)
    vmin, vmax = float(np.nanmin(concat)), float(np.nanmax(concat))
    if vmax <= vmin:
        vmax = vmin + 1.0
    return vmin, vmax


def tif_to_png(tif_path: Path, out_path: Path, vmin: float, vmax: float) -> None:
    band, mask = read_band(tif_path)
    norm = Normalize(vmin=vmin, vmax=vmax, clip=True)
    rgba = CMAP(norm(band))
    rgba[~mask] = [0, 0, 0, 0]
    rgba_uint8 = (rgba * 255).astype(np.uint8)

    img = PILImage.fromarray(rgba_uint8, "RGBA")

    h, w = band.shape
    if w > TARGET_WIDTH:
        ratio = TARGET_WIDTH / w
        new_h = int(h * ratio)
        img = img.resize((TARGET_WIDTH, new_h), PILImage.LANCZOS)

    img.save(out_path, format="PNG", optimize=True)
    size_kb = out_path.stat().st_size // 1024
    print(f"  ✓ {out_path.name}  {img.size[0]}×{img.size[1]}  ({size_kb} KB)")


def main() -> None:
    print("Computing global NDVI range across all hours …")
    vmin, vmax = global_minmax()
    print(f"  NDVI range: {vmin:.3f} … {vmax:.3f}\n")

    print("Generating per-hour NDVI PNGs (RdYlGn, same scale) …")
    for hour in HOURS:
        tif = NDVI_SRC / hour / f"NDVI_Resampled_Clipped_{hour}.tif"
        if not tif.exists():
            print(f"  ⚠ {tif} not found, skipping")
            continue
        tif_to_png(tif, OUT_DIR / f"ndvi_{hour}.png", vmin, vmax)

    print("\nDone – PNGs written to", OUT_DIR)


if __name__ == "__main__":
    main()
