"""App 图标生成工具：把设计稿 PNG 转成多尺寸 ICO（供 PyInstaller 与 pywebview 使用）。

背景：设计稿 PNG 自带 (250,249,246) 米白底。直接转 ICO 会在任务栏上出现一圈"白框"，
所以这里把米白底抠成透明，只保留黑色圆角方块 + 白色书本：

- 纯米白 -> alpha 0（完全透明）
- 黑方块 -> alpha 255
- 圆角与投影的过渡保留为半透明

颜色统一压成方块近黑色，避免"亮色污染" —— 边缘像素本是米白与黑的混合，若保留原色，
在深色背景上会显出一圈发白的描边。

依赖 Pillow（仅构建期需要，不参与 PyInstaller 打包）。

用法:
    python packaging/make_icons.py <source.png> [out.ico]

生成后需重新打包才会生效:
    .venv\\Scripts\\pyinstaller.exe --clean --noconfirm rag_gk.spec
"""
import sys
from pathlib import Path

from PIL import Image

SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
LIGHT = 246.0  # 亮度 >= 该值 -> 纯背景（透明）
DARK = 128.0   # 亮度 <= 该值 -> 实心
FILL = (25, 25, 24)

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("packaging/icon-source.png")
OUT_ICO = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("packaging/app.ico")

if not SRC.exists():
    sys.exit(f"[!] 找不到源图: {SRC}")

src = Image.open(SRC).convert("RGBA")
print(f"[*] 源图 {SRC} {src.size}")

# 1) 亮度 -> alpha
lum = src.convert("L")
alpha = lum.point(
    lambda v: 0 if v >= LIGHT else (255 if v <= DARK else int(255 * (LIGHT - v) / (LIGHT - DARK)))
)

# 2) 只保留形状，颜色统一
keyed = Image.new("RGBA", src.size, FILL + (0,))
keyed.putalpha(alpha)

# 3) 裁到内容边界并补成正方形，避免缩放变形
bbox = keyed.getbbox()
cropped = keyed.crop(bbox)
cw, ch = cropped.size
side = max(cw, ch)
square = Image.new("RGBA", (side, side), FILL + (0,))
square.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
print(f"[*] 内容边界 {bbox} -> 正方形 {square.size}")

# 4) 写多尺寸 ICO
OUT_ICO.parent.mkdir(parents=True, exist_ok=True)
frames = [square.resize((s, s), Image.LANCZOS) for s in SIZES]
frames[-1].save(OUT_ICO, format="ICO", sizes=[(s, s) for s in SIZES])

with Image.open(OUT_ICO) as chk:
    got = sorted(chk.ico.sizes())
missing = [s for s in SIZES if (s, s) not in got]
if missing:
    sys.exit(f"[!] {OUT_ICO} 缺少尺寸: {missing}")
print(f"[+] 已生成 {OUT_ICO} ({OUT_ICO.stat().st_size} 字节, {len(got)} 个尺寸)")
