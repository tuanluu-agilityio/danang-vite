"""/* ===== Thư viện phụ kiện nhà ven sông (D-037 bản 2, M2): dựng 5 họ kit + bộ xem trước, lưu .blend ===== */

Cách chạy (máy người phát triển, không cần cho build):
    npm run gen:buildings
    # tức: node scripts/people/blender.mjs blender/scripts/build_building_library.py   (dựng, lưu .blend)
    #  rồi: node scripts/people/blender.mjs blender/scripts/export_assets.py           (xuất public/buildings/kit.glb)
    # ảnh xem trước: node scripts/people/blender.mjs blender/scripts/render_preview.py  -> blender/.cache/preview-*.png
Đường dẫn Blender: biến môi trường BLENDER (mặc định 4.5 LTS, xem scripts/people/blender.mjs). Đã thử: 4.5.10 LTS.

Hợp đồng dữ liệu: docs/superpowers/specs/2026-11-13-ven-song-chan-thuc-design.md §6.1, §6.2. Tóm tắt (hệ trục glTF, Y lên):
    - mỗi họ một lưới fam1..fam5; mặt +X của mô hình là mặt nhìn ra sông;
    - neo (POSITION sau khi xuất) trong hộp đơn vị x, z ∈ [-0,5; 0,5], y ∈ [0; 1]; _OFF (m) cộng sau co giãn:
      vị trí cuối = neo × (w, h, d) + _OFF;
    - _RULE: 0 = luôn vẽ; > 0 = chi tiết theo tầng, = cao độ đáy chi tiết tính từ chân nhà (m); shader thu khi _RULE > h − 3;
      tầng k (k ≥ 2) có sàn ở y thế giới 3,4·k, chân nhà ở y thế giới 2,5 nên đáy = 3,4·k − 2,5;
    - COLOR_0 RGBA: a = 1 nhân màu tường của nhà, a = 0 màu tuyệt đối (inox, kính, kim loại); _GLOW 0..1 sáng về đêm;
    - pháp tuyến phẳng theo mặt, mỗi mặt đỉnh riêng (thuộc tính miền POINT là theo mặt).

Cách dựng trong Blender: vị trí đỉnh trong .blend là hình "đã giải" ở kích thước tham chiếu REF của họ (để Blender tính đúng
pháp tuyến; neo thuần thì nhiều mặt suy biến), neo thật lưu ở thuộc tính _ANC (theo trục glTF). export_assets.py xuất GLB
rồi đóng gói lại: POSITION <- _ANC, bỏ _ANC, COLOR_0 về ubyte chuẩn hóa. Mọi mặt không thẳng trục (bồn nước, mái hiên
dốc) có neo không đổi theo hướng bị co giãn, nên pháp tuyến không phụ thuộc (w, h, d).
Đổi trục: Blender (x, y, z) = glTF (x, −z, y); bộ xuất (export_yup) đổi ngược POSITION / NORMAL, KHÔNG đổi thuộc tính
tùy biến, nên _ANC / _OFF ghi thẳng theo trục glTF.
Tất định: chỉ dùng random.Random(SEED).
"""
import bpy, os, math, random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
BLEND = os.path.join(ROOT, 'blender', 'scenes', 'riverside_buildings.blend')
SEED = 37

FLOOR = 3.4                       # lưới cửa sổ của shader theo y thế giới (m)
FOOT = 2.5                        # chân nhà ở y thế giới (m), = landY
MAXH = {1: 100.0, 2: 45.0, 3: 30.0, 4: 100.0, 5: 20.0}            # chiều cao tối đa của họ (m), spec §6.1
REF = {1: (24, 100, 20), 2: (22, 45, 18), 3: (26, 30, 20), 4: (24, 100, 24), 5: (20, 20, 22)}  # (w, h, d) tham chiếu để tính pháp tuyến
# kích thước mẫu cho bộ xem trước (w, h, d) và màu tường mẫu
SAMPLE = {1: ((24, 80, 20), (0.55, 0.63, 0.68)), 2: ((22, 36, 18), (0.93, 0.85, 0.70)), 3: ((26, 22, 20), (0.86, 0.83, 0.78)),
          4: ((24, 70, 24), (0.70, 0.72, 0.75)), 5: ((22, 14, 16), (0.95, 0.80, 0.60))}

# ===== Màu (rgb, a): a = 1 nhân màu tường, a = 0 tuyệt đối =====
WALL = (1.0, 1.0, 1.0, 1.0)
def wall(f): return (f, f, f, 1.0)
INOX = (0.78, 0.80, 0.82, 0.0)                 # bồn nước inox
METAL = (0.20, 0.21, 0.23, 0.0)                # sắt sơn tối (khung bồn, cột, lan can sắt)
ALU = (0.56, 0.59, 0.62, 0.0)                  # lam nhôm văn phòng
GLASS = (0.36, 0.48, 0.53, 0.0)                # lan can kính, mái đón kính
CANOPY = (0.22, 0.26, 0.28, 0.0)               # mái đón kim loại + kính tối

def floors(fam, k0=2):
    """Danh sách (k, đáy chi tiết so với chân nhà) cho tầng k ≥ k0 mà đáy ≤ chiều cao tối đa của họ."""
    out, k = [], k0
    while FLOOR * k - FOOT <= MAXH[fam] + 1e-6:
        out.append((k, round(FLOOR * k - FOOT, 4))); k += 1
    return out

# ===== Bộ gom mặt =====
class Kit:
    """Gom mặt của một họ. Mỗi đỉnh = (neo (3), lệch (3)) theo trục glTF; mỗi mặt có màu, _RULE, _GLOW chung."""
    def __init__(self, fam):
        self.fam, self.faces = fam, []          # face = (list[(anc, off)], col, rule, glow)
    def face(self, verts, col, rule=0.0, glow=0.0):
        self.faces.append((verts, col, float(rule), float(glow)))
    def tris(self):
        return sum(len(v) - 2 for v, *_ in self.faces)

# Chỉ số 8 góc hộp: bit 0 = x cao, bit 1 = y cao, bit 2 = z cao. Mặt theo thứ tự ngược chiều kim đồng hồ nhìn từ ngoài.
HEXA_FACES = {'+x': (1, 3, 7, 5), '-x': (0, 4, 6, 2), '+y': (2, 6, 7, 3), '-y': (0, 1, 5, 4), '+z': (4, 5, 7, 6), '-z': (0, 2, 3, 1)}
ALL = ('+x', '-x', '+y', '-y', '+z', '-z')

def hexa(kit, corners, faces, col, rule=0.0, glow=0.0):
    """Khối 8 góc tổng quát; corners[i] = (neo, lệch)."""
    for f in faces:
        kit.face([corners[i] for i in HEXA_FACES[f]], col, rule, glow)

def box_corners(x, y, z):
    """x, y, z = ((neo thấp, lệch thấp), (neo cao, lệch cao)) theo từng trục -> 8 góc."""
    cs = []
    for i in range(8):
        px, py, pz = x[i & 1], y[(i >> 1) & 1], z[(i >> 2) & 1]
        cs.append(((px[0], py[0], pz[0]), (px[1], py[1], pz[1])))
    return cs

def box(kit, x, y, z, faces=ALL, col=WALL, rule=0.0, glow=0.0):
    hexa(kit, box_corners(x, y, z), faces, col, rule, glow)

def cyl(kit, anc, cx, cz, y0, y1, r, col, seg=8, top=True):
    """Trụ đứng (bồn nước) chỉ bằng lệch quanh một neo cố định: không méo theo (w, h, d). Không vẽ đáy."""
    pts = [(cx + r * math.cos(2 * math.pi * (i + 0.5) / seg), cz - r * math.sin(2 * math.pi * (i + 0.5) / seg)) for i in range(seg)]
    V = lambda p, y: (anc, (p[0], y, p[1]))
    for i in range(seg):
        a, b = pts[i], pts[(i + 1) % seg]      # đi ngược chiều kim đồng hồ nhìn từ trên (+Y): x tăng góc, z = −sin
        kit.face([V(a, y0), V(b, y0), V(b, y1), V(a, y1)], col)
    if top:
        kit.face([V(p, y1) for p in pts], col)

def ax(s, a, o):
    return (s * a, s * o)

def X(s, lo, hi):
    """Khoảng x theo dấu mặt s: lo, hi = (neo, lệch) cho mặt +X; mặt −X thì lật và đổi thứ tự."""
    a, b = ax(s, *lo), ax(s, *hi)
    return (a, b) if s > 0 else (b, a)

def F(s, f):
    """Đổi tên mặt ±x theo dấu."""
    if s > 0 or f[1] != 'x': return f
    return ('-x' if f[0] == '+' else '+x')

# ===== Các bộ phận dùng chung =====
def parapet(kit, height, t, col=WALL):
    """Tường chắn mái quanh mép mái, dày t, cao height. Hai thanh dọc Z (mặt ±X) chạy hết chiều sâu, hai thanh dọc X chèn giữa."""
    for s in (1, -1):
        box(kit, X(s, (0.5, -t), (0.5, 0.0)), ((1, 0.0), (1, height)), ((-0.5, 0.0), (0.5, 0.0)),
            (F(s, '+x'), F(s, '-x'), '+y', '+z', '-z'), col)
        zr = ((0.5, -t), (0.5, 0.0)) if s > 0 else ((-0.5, 0.0), (-0.5, t))
        box(kit, ((-0.5, t), (0.5, -t)), ((1, 0.0), (1, height)), zr, ('+z' if s > 0 else '-z', '-z' if s > 0 else '+z', '+y'), col)

def balcony(kit, s, base, z, depth, slab_col, rail_col, rule, ends=True):
    """Ban công trên mặt s·X: sàn dày 0,15 m sâu depth, lan can đặc cao 1,1 m dày 0,08 m ở mép ngoài.
    z = ((neo, lệch), (neo, lệch)); ends=False khi hai đầu bị tường ngăn che (nhà ống)."""
    e = ('+z', '-z') if ends else ()
    box(kit, X(s, (0.5, 0.0), (0.5, depth)), ((0, base), (0, base + 0.15)), z, (F(s, '+x'), '+y', '-y') + e, slab_col, rule)
    box(kit, X(s, (0.5, depth - 0.08), (0.5, depth)), ((0, base + 0.15), (0, base + 1.25)), z, (F(s, '+x'), F(s, '-x'), '+y') + e, rail_col, rule)

# ===== Họ 1: khách sạn kính (h ≥ 45 m) =====
def fam1():
    k = Kit(1)
    box(k, ((-0.5, -0.6), (0.5, 0.6)), ((0, 0.0), (0, 3.0)), ((-0.5, -0.6), (0.5, 0.6)), ('+x', '-x', '+y', '+z', '-z'), wall(0.72))   # đế thương mại nhô 0,6 m
    box(k, ((0.5, 0.6), (0.5, 2.8)), ((0, 3.3), (0, 3.6)), ((-0.25, 0.0), (0.25, 0.0)), ('+x', '+y', '-y', '+z', '-z'), CANOPY)       # mái đón sảnh
    for zz in (-0.25, 0.25):                                                                                                          # hai cột mái đón
        zo = (0.15, 0.4) if zz < 0 else (-0.4, -0.15)
        box(k, ((0.5, 2.35), (0.5, 2.6)), ((0, 0.0), (0, 3.3)), ((zz, zo[0]), (zz, zo[1])), ('+x', '-x', '+z', '-z'), METAL)
    for kk, b in floors(1):                                                                                                           # ban công dải mặt sông mỗi tầng
        balcony(k, 1, b, ((-0.5, 0.0), (0.5, 0.0)), 1.2, WALL, GLASS, b)
    parapet(k, 1.2, 0.3, wall(0.9))
    box(k, ((-0.5, 3.0), (0.5, -3.0)), ((1, 0.0), (1, 4.0)), ((-0.5, 3.0), (0.5, -3.0)), ('+x', '-x', '+y', '+z', '-z'), wall(0.85))  # vương miện: khối mái lùi
    box(k, ((-0.5, 2.4), (0.5, -2.4)), ((1, 4.0), (1, 4.5)), ((-0.5, 2.4), (0.5, -2.4)), ALL, wall(1.0))                             # gờ mái vương miện
    for zz in (-0.3, 0.3):                                                                                                            # chân khung biển hiệu
        box(k, ((0.5, -1.05), (0.5, -0.85)), ((1, 0.0), (1, 2.0)), ((zz, -0.1), (zz, 0.1)), ('+x', '-x', '+z', '-z'), METAL)
    box(k, ((0.5, -1.1), (0.5, -0.8)), ((1, 2.0), (1, 6.0)), ((-0.35, 0.0), (0.35, 0.0)), ALL, METAL)                               # khung biển hiệu mái
    k.face([((0.5, 1, 0.35), (-0.79, 2.25, -0.25)), ((0.5, 1, -0.35), (-0.79, 2.25, 0.25)),                                          # mặt chữ sáng về đêm (hướng +X)
            ((0.5, 1, -0.35), (-0.79, 5.75, 0.25)), ((0.5, 1, 0.35), (-0.79, 5.75, -0.25))], (0.96, 0.90, 0.74, 0.0), 0, 1.0)
    box(k, ((0, -0.15), (0, 0.15)), ((1, 4.5), (1, 14.0)), ((0, -0.15), (0, 0.15)), ('+x', '-x', '+z', '-z'), METAL)                 # ăng-ten
    box(k, ((0, -0.2), (0, 0.2)), ((1, 14.0), (1, 14.4)), ((0, -0.2), (0, 0.2)), ('+x', '-x', '+y', '+z', '-z'), (1.0, 0.12, 0.05, 0.0), 0, 1.0)  # đèn báo không
    return k

# ===== Họ 2: chung cư (20–45 m) =====
def fam2():
    k = Kit(2)
    for kk, b in floors(2):                                                                                                           # ban công hai mặt mỗi tầng
        for s in (1, -1):
            balcony(k, s, b, ((-0.5, 0.0), (0.5, 0.0)), 1.2, WALL, (0.90, 0.90, 0.88, 0.0), b)
    parapet(k, 1.1, 0.2)
    box(k, ((0, -3.5), (0, 0.0)), ((1, 0.0), (1, 3.0)), ((0, -2.0), (0, 2.0)), ('+x', '-x', '+z', '-z'), wall(0.9))                  # tum thang
    box(k, ((0, -3.8), (0, 0.3)), ((1, 3.0), (1, 3.25)), ((0, -2.3), (0, 2.3)), ALL, wall(1.0))                                       # mái tum
    box(k, ((0, 1.0), (0, 3.4)), ((1, 0.0), (1, 1.0)), ((0, -1.4), (0, 1.4)), ('+x', '-x', '+z', '-z', '+y'), METAL)                  # giá bồn nước
    for zc in (-0.7, 0.7):                                                                                                            # hai bồn inox
        cyl(k, (0.0, 1.0, 0.0), 2.2, zc, 1.0, 2.5, 0.55, INOX)
    return k

# ===== Họ 3: thương mại (14–30 m) =====
SIGNS = [(0.80, 0.12, 0.10), (0.10, 0.32, 0.78), (0.96, 0.76, 0.10)]
def fam3():
    k = Kit(3)
    box(k, ((0.5, 0.0), (0.5, 2.5)), ((0, 3.0), (0, 3.35)), ((-0.5, 0.5), (0.5, -0.5)), ('+x', '+y', '-y', '+z', '-z'), CANOPY)      # mái đón tầng trệt
    zs = [(-0.5, -1 / 6), (-1 / 6, 1 / 6), (1 / 6, 0.5)]
    for (z0, z1), c in zip(zs, SIGNS):                                                                                               # ba biển hiệu (sáng đêm)
        box(k, ((0.5, 0.0), (0.5, 0.25)), ((0, 3.6), (0, 5.0)), ((z0, 0.4), (z1, -0.4)), ('+x', '+y', '-y', '+z', '-z'), c + (0.0,), 0, 0.9)
    for kk, b in floors(3, 3):                                                                                                        # gờ sàn hai mặt từ tầng 3 (ngoài bảng spec, quyết định của agent)
        for s in (1, -1):
            box(k, X(s, (0.5, 0.0), (0.5, 0.35)), ((0, b), (0, b + 0.25)), ((-0.5, 0.0), (0.5, 0.0)), (F(s, '+x'), '+y', '-y', '+z', '-z'), wall(0.85), b)
    parapet(k, 1.0, 0.25)
    box(k, ((-0.25, 0.0), (0.05, 0.0)), ((1, 0.0), (1, 2.2)), ((-0.3, 0.0), (0.0, 0.0)), ('+x', '-x', '+y', '+z', '-z'), wall(0.8))  # hộp kỹ thuật
    box(k, ((0.1, 0.0), (0.3, 0.0)), ((1, 0.0), (1, 1.2)), ((0.1, 0.0), (0.35, 0.0)), ('+x', '-x', '+y', '+z', '-z'), (0.62, 0.64, 0.66, 0.0))  # cụm máy lạnh
    return k

# ===== Họ 4: văn phòng (≥ 30 m) =====
def fam4():
    k = Kit(4)
    for s in (1, -1):
        for i in range(9):                                                                                                            # lam đứng suốt chiều cao, mặt ±X
            zz = -0.5 + i / 8
            zo = (0.0, 0.3) if i == 0 else ((-0.3, 0.0) if i == 8 else (-0.12, 0.12))
            box(k, X(s, (0.5, 0.0), (0.5, 0.7)), ((0, 3.0), (1, 0.4)), ((zz, zo[0]), (zz, zo[1])), (F(s, '+x'), '+z', '-z'), ALU)
        for i in range(1, 6):                                                                                                         # lam mặt ±Z
            xx = -0.5 + i / 6
            zr = ((0.5, 0.0), (0.5, 0.7)) if s > 0 else ((-0.5, -0.7), (-0.5, 0.0))
            box(k, ((xx, -0.12), (xx, 0.12)), ((0, 3.0), (1, 0.4)), zr, ('+z' if s > 0 else '-z', '+x', '-x'), ALU)
    for kk, b in floors(4):                                                                                                           # gờ ngang mỗi tầng, mặt ±X, hai đầu chìm trong lam góc
        for s in (1, -1):
            box(k, X(s, (0.5, 0.0), (0.5, 0.45)), ((0, b), (0, b + 0.2)), ((-0.5, 0.1), (0.5, -0.1)), (F(s, '+x'), '+y', '-y'), wall(0.8), b)
    box(k, ((-0.5, -0.9), (0.5, 0.9)), ((1, 0.4), (1, 1.2)), ((-0.5, -0.9), (0.5, 0.9)), ALL, wall(0.85))                            # mũ mái
    box(k, ((-0.25, 0.0), (0.25, 0.0)), ((1, 1.2), (1, 4.5)), ((-0.25, 0.0), (0.25, 0.0)), ('+x', '-x', '+y', '+z', '-z'), wall(0.7))  # khối kỹ thuật mái
    return k

# ===== Họ 5: dãy nhà ống thấp tầng (< 20 m), 5 khoang dọc Z =====
AWN = [(0.72, 0.16, 0.14), (0.14, 0.40, 0.62), (0.20, 0.50, 0.30), (0.85, 0.55, 0.12), (0.55, 0.20, 0.45)]
RAIL5 = [METAL, (0.92, 0.92, 0.90, 0.0), (0.18, 0.34, 0.26, 0.0), wall(0.9)]
def fam5(rng):
    k = Kit(5)
    NB = 5
    zb = [-0.5 + i / NB for i in range(NB + 1)]
    for i, z in enumerate(zb):                                                                                                        # tường ngăn khoang nhô ra mặt sông, cao hơn mái 1 m
        zo = (0.0, 0.24) if i == 0 else ((-0.24, 0.0) if i == NB else (-0.12, 0.12))
        box(k, ((0.5, 0.0), (0.5, 1.35)), ((0, 0.0), (1, 1.0)), ((z, zo[0]), (z, zo[1])), ('+x', '+z', '-z', '+y'), wall(0.88))
    parapet(k, 1.0, 0.2)
    for i in range(NB):
        z0, z1 = zb[i], zb[i + 1]
        zr = ((z0, 0.12), (z1, -0.12))
        rail = RAIL5[rng.randrange(len(RAIL5))]
        depth = rng.choice((0.9, 1.1, 1.25))
        for kk, b in floors(5):                                                                                                       # ban công từng khoang, thỉnh thoảng bỏ một tầng
            if kk > 2 and rng.random() < 0.2: continue
            balcony(k, 1, b, zr, depth, WALL, rail, b, ends=False)
        c = AWN[rng.randrange(len(AWN))] + (0.0,)                                                                                     # mái hiên tầng trệt, dốc ra ngoài, dày 0,12 m
        back, front = 2.75 + rng.choice((0.0, 0.15)), 2.35
        cs = box_corners(((0.5, 0.0), (0.5, 1.6)), ((0, 0.0), (0, 0.0)), zr)
        cs = [(a, (o[0], (front if j & 1 else back) - (0.0 if (j >> 1) & 1 else 0.12), o[2])) for j, (a, o) in enumerate(cs)]
        hexa(k, cs, ('+x', '+y', '-y', '+z', '-z'), c)
        zc = (z0 + z1) / 2
        cx = -rng.uniform(1.5, 4.0)
        if rng.random() < 0.7:                                                                                                        # tum thang + bồn trên tum
            box(k, ((0, cx - 1.6), (0, cx + 1.6)), ((1, 0.0), (1, 2.8)), ((zc, -1.0), (zc, 1.0)), ('+x', '-x', '+y', '+z', '-z'), wall(0.92))
            tank_at(k, cx - 0.4, zc, 2.8, rng)
        else:                                                                                                                         # không tum: bồn trên giá cao trên sân thượng
            tank_at(k, cx, zc, 0.0, rng, frame_h=1.1)
    return k

def tank_at(kit, cx, zc, y0, rng, frame_h=0.35):
    """Bồn inox của một khoang nhà ống: neo x = 0 (giữa nhà), z = tâm khoang, y = mái."""
    r = rng.choice((0.45, 0.5, 0.55)); hgt = rng.choice((1.0, 1.2, 1.4)); a = 2 * r + 0.2
    anc = (0.0, 1.0, zc)
    box(kit, ((0.0, cx - a / 2), (0.0, cx + a / 2)), ((1, y0), (1, y0 + frame_h)), ((zc, -a / 2), (zc, a / 2)), ('+x', '-x', '+z', '-z', '+y'), METAL)
    cyl(kit, anc, cx, 0.0, y0 + frame_h, y0 + frame_h + hgt, r, INOX)

# ===== Ghi vào Blender =====
def to_bl(p):
    """glTF (x, y, z) -> Blender (x, −z, y)."""
    return (p[0], -p[2], p[1])

def resolve(anc, off, size):
    return tuple(anc[i] * size[i] + off[i] for i in range(3))

def make_mesh(name, kit, size, resolved=False, wall_col=None, hmax=None):
    """resolved=False: lưới kit (vị trí = hình giải ở size, thuộc tính _ANC/_OFF/_RULE/_GLOW/Col).
    resolved=True: bản xem trước đã giải ở size, bỏ chi tiết tầng có _RULE > h − 3, màu đã nhân màu tường."""
    verts, polys, anc, off, rule, glow, col = [], [], [], [], [], [], []
    h = size[1]
    for vs, c, r, g in kit.faces:
        if resolved and r > h - 3: continue
        idx = []
        for a, o in vs:
            idx.append(len(verts)); verts.append(to_bl(resolve(a, o, size)))
            anc.append(a); off.append(o); rule.append(r); glow.append(g)
            if resolved and c[3] > 0.5: col.append((c[0] * wall_col[0], c[1] * wall_col[1], c[2] * wall_col[2], 1.0))
            elif resolved: col.append((min(1, c[0] + g * 0.3), min(1, c[1] + g * 0.3), min(1, c[2] + g * 0.3), 1.0))
            else: col.append(c)
        polys.append(idx)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], polys)
    me.update()
    for p in me.polygons: p.use_smooth = False
    if not resolved:
        def put(nm, typ, data, n):
            at = me.attributes.new(nm, typ, 'POINT')
            flat = [x for v in data for x in v] if n > 1 else list(data)
            at.data.foreach_set('vector' if n > 1 else 'value', flat)
        put('_ANC', 'FLOAT_VECTOR', anc, 3); put('_OFF', 'FLOAT_VECTOR', off, 3)
        put('_RULE', 'FLOAT', rule, 1); put('_GLOW', 'FLOAT', glow, 1)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    ca.data.foreach_set('color', [x for v in col for x in v])
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    return me

def collection(name):
    c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c); return c

def body_mesh(name, size, col):
    """Thân hộp trơn của bản xem trước (chân ở y = 0)."""
    w, h, d = size
    k = Kit(0)
    box(k, ((-0.5, 0), (0.5, 0)), ((0, 0), (1, 0)), ((-0.5, 0), (0.5, 0)), ALL, WALL)
    return make_mesh(name, k, size, True, col)

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)                    # (đặt lại cả tùy chọn, nên tắt bản sao lưu sau dòng này)
    bpy.context.preferences.filepaths.save_version = 0                 # không tạo .blend1
    rng = random.Random(SEED)
    kits = {1: fam1(), 2: fam2(), 3: fam3(), 4: fam4(), 5: fam5(rng)}
    ck, cp = collection('kit'), collection('preview')
    pos_z = 0.0
    for f, kit in kits.items():
        me = make_mesh(f'fam{f}', kit, REF[f])
        ob = bpy.data.objects.new(f'fam{f}', me); ck.objects.link(ob)
        ob['ref'] = list(REF[f]); ob['fam'] = f
        ob.location = (0, 0, 0); ob.hide_set(False)
        size, wc = SAMPLE[f]
        # bản xem trước: xếp dọc trục Z glTF (Blender −Y), mặt sông +X quay về phía camera
        for nm, mm in ((f'prev{f}_kit', make_mesh(f'prev{f}_kit', kit, size, True, wc)), (f'prev{f}_body', body_mesh(f'prev{f}_body', size, wc))):
            o = bpy.data.objects.new(nm, mm); cp.objects.link(o)
            o.location = (0, -pos_z, 0)
        pos_z += size[2] + 14
        print(f'fam{f}: {kit.tris()} tam giác, {len(kit.faces)} mặt')
    ck.hide_render = False; cp.hide_render = False
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    print('đã lưu', BLEND)

main()
