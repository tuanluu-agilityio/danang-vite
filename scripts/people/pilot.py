"""/* ===== Sinh nhân vật người treo dù lượn dạng người thật (D-035): public/people/pilot.glb ===== */

Cách chạy (máy người phát triển, không cần cho build):
    npm run gen:pilot
    # tức: node scripts/people/blender.mjs scripts/people/pilot.py  (Blender nền: -b --python-exit-code 1 --python ...)
    # bỏ ảnh xem trước:  npm run gen:pilot -- -- --no-preview
Đường dẫn Blender: biến môi trường BLENDER (mặc định Blender 4.5 LTS, xem scripts/people/blender.mjs). Đã thử: 4.5.10 LTS.

Nguồn: Microsoft Rocketbox (MIT) Military_Male_01, cùng commit ghim với convert.py; FBX / TGA tải vào scripts/people/.cache/
(gitignore, ≈ 130 MB). Dùng lại hàm của convert.py (tải nguồn, F-curve, chọn vòng lặp, sửa JSON của GLB) như crowd.py.
Spec: docs/superpowers/specs/2026-11-12-nguoi-du-luon-that-design.md §3.

Chỉnh sửa so với nguồn:
    - bỏ lưới dao găm (vật liệu sm002_combat_knife), bỏ empty "Bip01 Footsteps";
    - texture màu: thân (đồng phục + áo giáp vải) -> ô liu sẫm, trang bị + mũ -> than, giày + găng -> than đen (giảm bão hòa
      về 0, nhân màu, gamma GAMMA); đầu (da, kính) giữ nguyên;
    - tô phủ phù hiệu cờ / cấp hiệu / bảng tên (PATCH_CLONE chép vải lân cận, PATCH_FLAT đổ màu trung vị), cả normal map;
    - gộp 4 vật liệu thành 1 bằng atlas (ATLAS): màu ATLAS_PX JPEG, normal ATLAS_PX JPEG, ORM ORM_PX (G = độ nhám suy từ
      specular map, B = kim loại 0, R = 1);
    - đoạn sit: m_sit_chair_breathe_01, vòng lặp SIT_LEN s khớp đầu cuối, FPS khung/giây, không kênh ngón tay / mặt,
      hông đứng yên tại gốc tọa độ.
Kết quả (hệ glTF / three): mét, +Y lên, mặt hướng +X, gốc tọa độ tại xương Bip01 Pelvis ở tư thế chuẩn (đứng);
scenes[0].extras = { height: cao tư thế đứng (m), hip: cao hông trên gót chân tư thế đứng (m) }.

Cuối script in bảng (byte, tam giác, khớp, vật liệu, ảnh, đoạn sit, tư thế ngồi đo từ chính glb) và xuất ảnh kiểm tra (nạp
lại glb vừa xuất) vào scripts/people/.cache/preview-pilot/: tpose.jpg (trước / sau), sit.jpg (4 khung), close.jpg (mặt, tay).
"""
import bpy, bmesh, os, sys, math, importlib.util
import numpy as np
from mathutils import Vector

# ===== Đường dẫn; nạp convert.py làm thư viện (khối chạy của nó nằm sau if __name__ == '__main__') =====
HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True                                          # không để __pycache__ lại trong scripts/people/
_spec = importlib.util.spec_from_file_location('rb_convert', os.path.join(HERE, 'convert.py'))
cv = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(cv)
OUT = cv.OUT
PREV = os.path.join(cv.CACHE, 'preview-pilot')
NAME = 'Military_Male_01'
SRC = f'Assets/Avatars/Professions/{NAME}/'
CLIP = 'm_sit_chair_breathe_01'                                         # đoạn ngồi thở (thư mục static)

# ===== Thông số =====
FPS = 30                        # khung/giây nướng đoạn sit
SIT_LEN = (4.0, 6.0)            # s, khoảng tìm độ dài vòng lặp sit
SIT_START = 4.0                 # s, điểm đầu được dời tối đa chừng này để vòng lặp khớp hơn
CLOSE_S = 0.3                   # s, khép vòng: đoạn cuối kéo dần về tư thế khung đầu
GAMMA = 1.15                    # độ tương phản khi đổi màu (lũy thừa độ sáng đã chuẩn hóa)
LREF = 0.5                      # độ sáng nguồn (sRGB) ứng đúng màu đích; vải ACU: trung vị 0,41, phân vị 75 là 0,53
KMAX = 1.6                      # trần hệ số sáng (điểm sáng nhất của rằn ri không thành xanh nõn chuối)
OLIVE = (0.36, 0.40, 0.26)      # màu thân (sRGB 0..1): ô liu sẫm
CHAR = (0.20, 0.21, 0.20)       # màu trang bị + mũ: than
BLACK = (0.085, 0.085, 0.09)    # màu giày + găng: than đen (ước lượng)
ATLAS_PX, ORM_PX = 1024, 512    # px, cạnh atlas màu / normal và ORM
JPEG_Q = 85                     # chất lượng JPEG (bộ xuất glTF áp cho mọi ảnh)
ROUGH = (0.95, 0.55)            # độ nhám ứng specular 0 và 1 (suy tuyến tính, ước lượng)
CAP = int(2.5 * 1024 * 1024)    # byte, trần pilot.glb (spec §3)

# Ô atlas (px, gốc trên trái, cạnh ATLAS_PX): thân 640², mũ 384², đầu 384², trang bị 640 × 320 (ảnh nguồn 2:1)
ATLAS = {'sm002_body': (0, 0, 640, 640), 'sm002_helmet': (640, 0, 384, 384),
         'sm002_head': (640, 640, 384, 384), 'sm002_equipment': (0, 640, 640, 320)}
TEXN = {'sm002_body': 'body', 'sm002_helmet': 'helmet', 'sm002_head': 'head', 'sm002_equipment': 'equipment'}
TINT = {'sm002_body': OLIVE, 'sm002_helmet': CHAR, 'sm002_equipment': CHAR}     # đầu không đổi màu
# Phù hiệu (px trên ảnh nguồn 2048, gốc trên trái; tìm bằng ảnh nguồn + ảnh xem trước):
# (vật liệu, x0, y0, x1, y1, dx, dy) chép vải tại (x + dx, y + dy) vào ô, mép mềm FEATHER px
PATCH_CLONE = [('sm002_body', 262, 1074, 424, 1306, 0, 236),      # tay áo trái: cờ, cấp hiệu, bảng tên
               ('sm002_body', 1624, 1076, 1776, 1286, 0, 236)]    # tay áo phải: cấp hiệu, phù hiệu đơn vị
# (vật liệu, x0, y0, x1, y1): đổ màu trung vị của ô (băng tên, cấp hiệu nhỏ: nền trơn còn lại)
PATCH_FLAT = [('sm002_body', 966, 734, 1064, 770),                  # băng tên sau lưng áo giáp
              ('sm002_body', 1134, 1904, 1194, 1960),               # cấp hiệu nhỏ ở thắt lưng
              ('sm002_helmet', 1240, 1130, 1370, 1196)]             # băng tên trên mũ
FEATHER = 10
# cổ giày (màu da bò) và mép thân giày nằm trên mặt lưới thuộc xương bắp chân cùng ống quần: chọn theo tâm UV trong các ô
# này (px ảnh nguồn; hai ô đầu: cổ giày, hai ô sau: mép thân giày cạnh đế)
BOOT_TOPS = [(100, 830, 500, 1030), (1560, 830, 1980, 1030), (500, 1900, 780, 2048), (1270, 1900, 1550, 2048)]
BOOT_BONES = ('Foot', 'Toe0')                                       # mặt lưới thuộc giày: xương trội là bàn / mũi chân
CALF_BONES = ('Calf',)                                              # cổ giày: mặt thuộc bắp chân có tâm UV trong BOOT_TOPS
GLOVE_BONES = ('Hand', 'Finger')                                    # găng: bàn tay / ngón ...
GLOVES = [(0, 1720, 480, 2048), (1560, 1720, 2048, 2048)]           # ... có tâm UV trong hai ô găng (px ảnh nguồn); bỏ cổ tay áo

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
NO_PREVIEW = '--no-preview' in ARGV


# ===== Tải nguồn =====
def fetch_all():
    d = os.path.join(cv.CACHE, 'src', NAME)
    fbx = cv.fetch(SRC + f'Export/{NAME}.fbx', os.path.join(d, NAME + '.fbx'))
    for p in ('body', 'equipment', 'helmet', 'head'):
        for t in ('color_acu' if p != 'head' else 'color', 'normal', 'specular'):
            cv.fetch(SRC + f'Textures/sm002_{p}_{t}.tga', os.path.join(d, f'sm002_{p}_{t}.tga'))
    clip = cv.fetch(cv.ANIM_DIR['static'] + CLIP + '.max.fbx', os.path.join(cv.CACHE, 'anim', CLIP + '.max.fbx'))
    return fbx, clip, d


# ===== Ảnh <-> mảng numpy (hàng 0 = mép DƯỚI ảnh như Blender; giá trị sRGB 0..1 của ảnh 8 bit) =====
def img_np(img):
    w, h = img.size; px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def np_img(name, a, colorspace='sRGB'):
    h, w = a.shape[:2]; im = bpy.data.images.new(name, w, h, alpha=False)
    im.colorspace_settings.name = colorspace; im.pixels.foreach_set(a.astype(np.float32).ravel()); im.update(); return im


def resize(a, w, h):
    """Thu nhỏ mảng ảnh bằng Image.scale của Blender (lọc tốt hơn lấy mẫu điểm)."""
    im = np_img('_tmp', a, 'Non-Color'); im.scale(w, h); r = img_np(im); bpy.data.images.remove(im); return r


def rows(H, y0, y1):
    """Hàng (gốc dưới) của dải y0..y1 tính từ mép trên."""
    return H - y1, H - y0


# ===== Mặt nạ vùng UV: tô các tam giác UV của những mặt chọn vào ảnh W × H =====
def uv_mask(me, polys, W, H, grow=3):
    m = np.zeros((H, W), dtype=bool); uv = me.uv_layers.active.data
    for lt in me.loop_triangles:
        if lt.polygon_index not in polys: continue
        P = np.array([[uv[l].uv[0] * W, uv[l].uv[1] * H] for l in lt.loops])
        x0, y0 = np.floor(P.min(0)).astype(int); x1, y1 = np.ceil(P.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
        if x1 < x0 or y1 < y0: continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = P
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-9: continue
        l1 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / d; l2 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / d
        m[y0:y1 + 1, x0:x1 + 1] |= (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
    for _ in range(grow):                                   # nở vài px để phủ đường nối UV
        g = m.copy(); g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]; m = g
    return m


def dominant_polys(ob, me, keys, mat_index):
    """Mặt (thuộc vật liệu mat_index) có đa số đỉnh mà xương trọng số lớn nhất chứa một trong keys."""
    names = {g.index: g.name for g in ob.vertex_groups}; dom = {}
    for v in me.vertices:
        if v.groups: dom[v.index] = names[max(v.groups, key=lambda g: g.weight).group]
    out = set()
    for p in me.polygons:
        if p.material_index != mat_index: continue
        hit = sum(1 for vi in p.vertices if any(k in dom.get(vi, '') for k in keys))
        if hit * 2 > len(p.vertices): out.add(p.index)
    return out


# ===== Đổi màu: giảm bão hòa về 0, độ sáng chia LREF, lũy thừa GAMMA, nhân màu (vải rằn ri sáng vừa -> đúng màu đích) =====
def recolor(a, tint, mask=None):
    L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    sel = (L > 0.02) if mask is None else mask
    k = np.clip(L / LREF, 0, KMAX) ** GAMMA
    for c in range(3): a[..., c] = np.where(sel, np.clip(k * tint[c], 0, 1), a[..., c])


def in_rects(me, p, W, H, rects):
    """Tâm UV của mặt p (px, gốc trên trái) nằm trong một ô."""
    uv = me.uv_layers.active.data; P = me.polygons[p].loop_indices
    x = sum(uv[l].uv[0] for l in P) / len(P) * W; y = (1 - sum(uv[l].uv[1] for l in P) / len(P)) * H
    return any(x0 <= x < x1 and y0 <= y < y1 for x0, y0, x1, y1 in rects)


def tan_mask(a, rects):
    """Điểm ảnh màu da bò (hue 15–60°, bão hòa > 0,12, sáng > 0,3) trong các ô; đóng lỗ (dây giày tối) bằng nở rồi co."""
    H, W = a.shape[:2]; mx = a[..., :3].max(-1); mn = a[..., :3].min(-1); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    hue = np.where(mx == r, ((g - b) / np.maximum(mx - mn, 1e-6)) % 6, (b - r) / np.maximum(mx - mn, 1e-6) + 2) * 60
    tan = (hue > 15) & (hue < 60) & (sat > 0.12) & (mx > 0.3)
    box = np.zeros((H, W), bool)
    for x0, y0, x1, y1 in rects: r0, r1 = rows(H, y0, y1); box[r0:r1, x0:x1] = True
    m = tan & box
    def grow(m, n, op):
        for _ in range(n):
            g = m.copy(); sh = [(np.s_[1:], np.s_[:-1]), (np.s_[:-1], np.s_[1:])]
            for d, s_ in sh:
                g[d] = op(g[d], m[s_]); g[:, d] = op(g[:, d], m[:, s_])
            m = g
        return m
    return grow(grow(m, 8, np.logical_or), 8, np.logical_and) & box


def feather_rect(H, W, x0, y0, x1, y1):
    """Trọng số 0..1 của ô (gốc trên trái), mép mềm FEATHER px, trả (r0, r1, wgt) theo hàng gốc dưới."""
    r0, r1 = rows(H, y0, y1); h, w = r1 - r0, x1 - x0
    fy = np.minimum(np.arange(h) + 1, h - np.arange(h)) / FEATHER; fx = np.minimum(np.arange(w) + 1, w - np.arange(w)) / FEATHER
    return r0, r1, np.clip(np.minimum.outer(fy, fx), 0, 1)[..., None]


def patch_out(mat, col, nrm):
    """Tô phủ phù hiệu trên ảnh màu (đã đổi màu) và normal map của vật liệu mat."""
    H, W = col.shape[:2]; n = 0
    for m, x0, y0, x1, y1, dx, dy in PATCH_CLONE:
        if m != mat: continue
        r0, r1, wt = feather_rect(H, W, x0, y0, x1, y1); s0, s1 = rows(H, y0 + dy, y1 + dy)
        for a in (col, nrm):
            src = a[s0:s1, x0 + dx:x1 + dx].copy(); a[r0:r1, x0:x1] = a[r0:r1, x0:x1] * (1 - wt) + src * wt
        n += 1
    for m, x0, y0, x1, y1 in PATCH_FLAT:
        if m != mat: continue
        r0, r1, wt = feather_rect(H, W, x0, y0, x1, y1)
        for a, flat in ((col, None), (nrm, np.array([0.5, 0.5, 1.0, 1.0], dtype=np.float32))):
            v = flat if flat is not None else np.median(a[r0:r1, x0:x1].reshape(-1, 4), axis=0)
            a[r0:r1, x0:x1] = a[r0:r1, x0:x1] * (1 - wt) + v * wt
        n += 1
    return n


# ===== Nhân vật: nhập, bỏ dao, đổi màu, atlas, một vật liệu =====
def build_mesh(d, log):
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    for o in [o for o in bpy.data.objects if o.type == 'EMPTY']: bpy.data.objects.remove(o, do_unlink=True)   # Bip01 Footsteps
    ob = next(o for o in bpy.data.objects if o.type == 'MESH'); ob.name = ob.data.name = 'pilot'
    me = ob.data; mats = [m.name for m in me.materials]
    # bỏ mặt dao (và đỉnh chỉ thuộc dao)
    bad = [i for i, m in enumerate(mats) if any(k in m.lower() for k in ('knife', 'pistol', 'weapon', 'gun'))]
    bm = bmesh.new(); bm.from_mesh(me); kf = [f for f in bm.faces if f.material_index in bad]
    bmesh.ops.delete(bm, geom=kf, context='FACES'); bm.to_mesh(me); bm.free(); me.update()
    log.append(f'bỏ {len(kf)} mặt dao ({[mats[i] for i in bad]})')
    for ca in list(me.color_attributes): me.color_attributes.remove(ca)      # màu đỉnh nguồn không dùng (bớt COLOR_0/1)
    me.calc_loop_triangles(); uv = me.uv_layers.active.data
    U = np.array([l.uv[:] for l in uv]); log.append(f'UV nguồn {U.min(0).round(3)} .. {U.max(0).round(3)}')
    mi = {m: i for i, m in enumerate(mats)}
    # ảnh nguồn đổi màu + tô phù hiệu, rồi thu vào atlas
    col_at = np.zeros((ATLAS_PX, ATLAS_PX, 4), np.float32); col_at[..., 3] = 1
    nrm_at = np.tile(np.array([0.5, 0.5, 1.0, 1.0], np.float32), (ATLAS_PX, ATLAS_PX, 1))
    orm_at = np.zeros((ATLAS_PX, ATLAS_PX, 4), np.float32); orm_at[..., 0] = 1; orm_at[..., 1] = ROUGH[0]; orm_at[..., 3] = 1
    boots = gloves = None
    for m, (x, y, w, h) in ATLAS.items():
        t = TEXN[m]; cc = 'color' if m == 'sm002_head' else 'color_acu'
        col = img_np(bpy.data.images.load(os.path.join(d, f'sm002_{t}_{cc}.tga')))
        nrm = img_np(bpy.data.images.load(os.path.join(d, f'sm002_{t}_normal.tga')))
        spc = img_np(bpy.data.images.load(os.path.join(d, f'sm002_{t}_specular.tga')))
        H, W = col.shape[:2]
        if m in TINT:
            if m == 'sm002_body':
                tops = {p for p in dominant_polys(ob, me, CALF_BONES, mi[m]) if in_rects(me, p, W, H, BOOT_TOPS)}
                boots = uv_mask(me, dominant_polys(ob, me, BOOT_BONES, mi[m]) | tops, W, H) | tan_mask(col, BOOT_TOPS)
                gloves = uv_mask(me, {p for p in dominant_polys(ob, me, GLOVE_BONES, mi[m]) if in_rects(me, p, W, H, GLOVES)}, W, H)
                rest = ~(boots | gloves) & (col[..., :3].max(-1) > 0.02)
                recolor(col, BLACK, (boots | gloves) & (col[..., :3].max(-1) > 0.02)); recolor(col, TINT[m], rest)
                log.append(f'giày {int(boots.sum())} px, găng {int(gloves.sum())} px (ảnh {W}×{H})')
            else:
                recolor(col, TINT[m])
            log.append(f'{m}: tô {patch_out(m, col, nrm)} phù hiệu')
        r0 = ATLAS_PX - y - h
        col_at[r0:r0 + h, x:x + w] = resize(col, w, h); nrm_at[r0:r0 + h, x:x + w] = resize(nrm, w, h)
        s = resize(spc, w, h); S = s[..., :3].mean(-1)
        orm_at[r0:r0 + h, x:x + w, 1] = ROUGH[0] + (ROUGH[1] - ROUGH[0]) * np.clip(S, 0, 1)
        # UV của vật liệu này vào ô atlas
        for p in me.polygons:
            if p.material_index != mi[m]: continue
            for li in p.loop_indices:
                u, v = uv[li].uv; uv[li].uv = ((x + u * w) / ATLAS_PX, (r0 + v * h) / ATLAS_PX)
        log.append(f'{m}: ô atlas {w}×{h} tại ({x}, {y})')
    orm_at = resize(orm_at, ORM_PX, ORM_PX); orm_at[..., 0] = 1; orm_at[..., 2] = 0
    ic = np_img('pilot_color', col_at); inn = np_img('pilot_normal', nrm_at, 'Non-Color'); io = np_img('pilot_orm', orm_at, 'Non-Color')
    for im in (ic, inn, io): im.pack()
    os.makedirs(PREV, exist_ok=True)                # bản sao atlas màu để xem bằng mắt
    cp = np_img('atlas_preview', col_at); cp.filepath_raw = os.path.join(PREV, 'atlas.jpg'); cp.file_format = 'JPEG'; cp.save(quality=90)
    bpy.data.images.remove(cp)
    # một vật liệu
    mat = bpy.data.materials.new('pilot'); mat.use_nodes = True; nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Metallic'].default_value = 0.0
    tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = ic; nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = inn; nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    to = nt.nodes.new('ShaderNodeTexImage'); to.image = io; sp = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(to.outputs['Color'], sp.inputs['Color']); nt.links.new(sp.outputs['Green'], bsdf.inputs['Roughness'])
    nt.links.new(sp.outputs['Blue'], bsdf.inputs['Metallic'])
    for p in me.polygons: p.material_index = 0
    me.materials.clear(); me.materials.append(mat)
    for m in list(bpy.data.materials):
        if m != mat: bpy.data.materials.remove(m)
    for im in list(bpy.data.images):
        if im not in (ic, inn, io): bpy.data.images.remove(im)
    return arm, ob


# ===== Đoạn sit: gắn, nướng, chọn vòng lặp, khép vòng, bỏ ngón / mặt, giữ hông tại tư thế chuẩn =====
def add_sit(sc, arm, path, info):
    base = set(bpy.data.objects); before = set(bpy.data.actions)
    face = cv.descendants(arm, 'Bip01 Head')
    keep = {b.name for b in arm.data.bones if b.name not in face and 'Finger' not in b.name}
    bpy.ops.import_scene.fbx(filepath=path); sc.render.fps = FPS; sc.render.fps_base = 1
    src = next(o for o in bpy.data.objects if o not in base and o.type == 'ARMATURE')
    f0, f1 = (int(round(x)) for x in src.animation_data.action.frame_range)
    cmp_bones = [b for b in keep if b != 'Bip01 Pelvis' and b in src.pose.bones]
    lo, hi = int(SIT_LEN[0] * FPS), int(SIT_LEN[1] * FPS)
    if f1 - f0 < lo: raise SystemExit(f'đoạn {CLIP} chỉ {(f1 - f0) / FPS:.2f} s < {SIT_LEN[0]} s')
    a, b, err = cv.pick_loop(sc, src, f0, f1, lo, hi, cmp_bones, starts=int(SIT_START * FPS))
    for pb in arm.pose.bones:
        if pb.name in keep and pb.name in src.pose.bones:
            c = pb.constraints.new('COPY_TRANSFORMS'); c.target = src; c.subtarget = pb.name
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=a, frame_end=b, only_selected=False, visual_keying=True,
                     clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        for c in list(pb.constraints): pb.constraints.remove(c)
    act = arm.animation_data.action; act.name = 'sit'; act.use_fake_user = True
    for fc in cv.fcurves(act):                      # bỏ kênh xương không diễn (mặt, ngón)
        bn = cv.bone_of(fc)
        if bn is not None and bn not in keep: cv.fc_remove(act, fc)
    TOL = {'location': 0.05, 'scale': 1e-3, 'rotation_quaternion': 2e-3}
    for fc in cv.fcurves(act):                      # kênh gần hằng (nhiễu nướng) -> hằng
        prop = fc.data_path.rsplit('.', 1)[-1]
        if prop not in TOL or cv.bone_of(fc) == 'Bip01 Pelvis': continue
        v = [kp.co.y for kp in fc.keyframe_points]
        if v and max(v) - min(v) < TOL[prop]:
            mv = sum(v) / len(v)
            for kp in fc.keyframe_points: kp.co.y = kp.handle_left.y = kp.handle_right.y = mv
    # khép vòng: CLOSE_S cuối kéo dần về đúng tư thế khung đầu
    nb = int(CLOSE_S * FPS); grp = {}
    for fc in cv.fcurves(act): grp.setdefault((fc.data_path, fc.data_path.endswith('rotation_quaternion')), {})[fc.array_index] = fc
    for (dp, isq), g in grp.items():
        va = {i: fc.evaluate(a) for i, fc in g.items()}; vb = {i: fc.evaluate(b) for i, fc in g.items()}
        if isq and sum(va[i] * vb[i] for i in va) < 0: va = {i: -x for i, x in va.items()}
        for i, fc in g.items():
            dv = va[i] - vb[i]
            for kp in fc.keyframe_points:
                s = (kp.co.x - (b - nb)) / nb
                if s > 0: s = s * s * (3 - 2 * s); kp.co.y += dv * s; kp.handle_left.y += dv * s; kp.handle_right.y += dv * s
    # hông đứng yên tại vị trí tư thế chuẩn: trừ độ lệch vị trí thế giới của hông ở từng khung
    pb = arm.pose.bones['Bip01 Pelvis']; M = (arm.matrix_world.to_3x3() @ pb.bone.matrix_local.to_3x3()).inverted()
    rest = arm.matrix_world @ pb.bone.head_local
    pel = [fc for fc in cv.fcurves(act) if fc.data_path == 'pose.bones["Bip01 Pelvis"].location']
    off = {}; drop = 0.0                            # drop: hông nguồn lệch tư thế chuẩn tối đa (m), để báo cáo
    for fr in range(a, b + 1):
        cv.setf(sc, fr); dw = cv.wpos(arm, 'Bip01 Pelvis') - rest; off[fr] = M @ dw; drop = max(drop, dw.length)
    for fc in pel:
        for kp in fc.keyframe_points:
            dd = off[int(round(kp.co.x))][fc.array_index]; kp.co.y -= dd; kp.handle_left.y -= dd; kp.handle_right.y -= dd
    hx = 0.0
    for fr in range(a, b + 1): cv.setf(sc, fr); hx = max(hx, (cv.wpos(arm, 'Bip01 Pelvis') - rest).length)
    info.update(src=CLIP, frames=(a, b), src_range=(f0, f1), dur=round((b - a) / FPS, 3), loop_err=round(err, 2),
                pelvis_moved=round(drop, 3), pelvis_left=round(hx, 4))
    print(f'  SIT {info}')
    arm.animation_data.action = None
    for o in [o for o in bpy.data.objects if o not in base]: bpy.data.objects.remove(o, do_unlink=True)
    for x in [x for x in bpy.data.actions if x not in before and x != act]: bpy.data.actions.remove(x)
    for pb in arm.pose.bones: pb.matrix_basis.identity()


def convert():
    fbx, clip, d = fetch_all()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.fps = FPS; sc.render.fps_base = 1
    bpy.ops.import_scene.fbx(filepath=fbx)
    log = []; arm, ob = build_mesh(d, log)
    for l in log: print('  ' + l)
    arm.animation_data_clear(); arm.animation_data_create()
    for x in list(bpy.data.actions): bpy.data.actions.remove(x)
    info = {}; add_sit(sc, arm, clip, info)
    # mặt Rocketbox nhìn -Y của Blender; quay +90° quanh Z -> nhìn +X; rồi dời để hông tư thế chuẩn ở gốc
    arm.rotation_euler.z += math.pi / 2; bpy.context.view_layer.update()
    arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    hip0 = arm.matrix_world @ arm.data.bones['Bip01 Pelvis'].head_local
    arm.location -= hip0; bpy.context.view_layer.update()
    toe, foot = arm.matrix_world @ arm.data.bones['Bip01 L Toe0'].head_local, arm.matrix_world @ arm.data.bones['Bip01 L Foot'].head_local
    dg = bpy.context.evaluated_depsgraph_get(); e = ob.evaluated_get(dg); me = e.to_mesh(); me.calc_loop_triangles()
    tris = len(me.loop_triangles); zs = [(ob.matrix_world @ v.co).z for v in me.vertices]; e.to_mesh_clear()
    height, hip = max(zs) - min(zs), -min(zs)
    hp = arm.matrix_world @ arm.data.bones['Bip01 Pelvis'].head_local
    arm.data.pose_position = 'POSE'
    print(f'  hướng mặt: mũi chân - cổ chân = ({toe.x - foot.x:.3f}, {toe.y - foot.y:.3f}) m, cao {height:.3f} m, hông {hip:.3f} m, hông tư thế chuẩn tại {tuple(round(c, 4) for c in hp)}')
    assert toe.x - foot.x > 0.05 and abs(toe.y - foot.y) < 0.06, 'mặt không hướng +X'
    assert hp.length < 1e-4, 'hông tư thế chuẩn không ở gốc'
    # xuất kiểu ACTIONS (đoạn gắn trực tiếp): bộ xuất coi kênh có F-curve là "có diễn" nên giữ cả kênh hằng khác tư thế
    # chuẩn (vd. gối phải gập suốt đoạn); kiểu NLA_TRACKS coi mọi kênh là nướng và bỏ kênh hằng -> mất tư thế ngồi
    act = bpy.data.actions['sit']; arm.animation_data.action = act
    if hasattr(act, 'slots') and len(act.slots): arm.animation_data.action_slot = act.slots[0]
    os.makedirs(OUT, exist_ok=True); out = os.path.join(OUT, 'pilot.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                              export_image_format='JPEG', export_image_quality=JPEG_Q, export_yup=True, export_extras=False,
                              export_frame_step=1, export_force_sampling=True, export_optimize_animation_size=True,
                              export_optimize_animation_keep_anim_armature=False,
                              export_anim_slide_to_zero=True, export_tangents=False, export_cameras=False, export_lights=False,
                              export_morph=False, export_skins=True, export_all_influences=False, export_reset_pose_bones=True)

    def patch(j):
        j['scenes'][0]['extras'] = {'height': round(height, 3), 'hip': round(hip, 3)}
    j = cv.glb_patch(out, patch)
    an = j['animations'][0]; tgt = [j['nodes'][c['target']['node']]['name'] for c in an['channels']]
    imgs = [(im.get('name'), im.get('mimeType')) for im in j.get('images', [])]
    mat = j['materials'][0]['pbrMetallicRoughness'] if j.get('materials') else {}
    return dict(bytes=os.path.getsize(out), tris=tris, joints=len(j['skins'][0]['joints']), meshes=len(j['meshes']),
                prims=sum(len(m['primitives']) for m in j['meshes']), mats=[m.get('name') for m in j.get('materials', [])],
                imgs=imgs, mat=mat, normal=j['materials'][0].get('normalTexture'), height=round(height, 3), hip=round(hip, 3),
                sit=info, anims=[a['name'] for a in j['animations']], channels=len(an['channels']),
                finger_ch=[n for n in tgt if 'Finger' in n], pelvis_ch=[c['target']['path'] for c, n in zip(an['channels'], tgt) if n.endswith('Pelvis')],
                root=[(n.get('name'), n.get('translation'), n.get('rotation')) for n in j['nodes'] if n.get('name') in ('Bip01', 'Bip01 Pelvis', 'Bip01_Pelvis')])


# ===== Ảnh kiểm tra: nạp lại glb, chụp chữ T trước / sau, 4 khung sit, cận mặt + tay; đo tư thế ngồi =====
def render_sheet(sc, cam, shots, name, w_, h_):
    tmp = os.path.join(PREV, 'tmp'); os.makedirs(tmp, exist_ok=True); files = []
    sc.render.resolution_x, sc.render.resolution_y = w_, h_
    for i, (setup, eye, look, lens) in enumerate(shots):
        setup(); cam.location = Vector(eye); cam.data.lens = lens
        cam.rotation_euler = (Vector(look) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        fp = os.path.join(tmp, f'{name}_{i}.png'); sc.render.filepath = fp; bpy.ops.render.render(write_still=True); files.append(fp)
    sheet = np.zeros((h_, len(files) * w_, 4), dtype=np.float32)
    for i, fp in enumerate(files):
        im = bpy.data.images.load(fp); sheet[:, i * w_:(i + 1) * w_] = img_np(im); bpy.data.images.remove(im); os.remove(fp)
    out = bpy.data.images.new(name, len(files) * w_, h_, alpha=False); out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = os.path.join(PREV, name + '.jpg'); out.file_format = 'JPEG'; out.save(quality=88); return out.filepath_raw


def preview():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, 'pilot.glb'))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE'); bpy.context.view_layer.update()
    def W(n):
        pb = next(b for b in arm.pose.bones if b.name in (n, n.replace(' ', '_')))
        return (arm.matrix_world @ pb.matrix).translation.copy()
    sizes = {i.name: tuple(i.size) for i in bpy.data.images}
    if arm.animation_data is None: arm.animation_data_create()
    for t in arm.animation_data.nla_tracks: t.mute = True
    act = next(a for a in bpy.data.actions if a.name == 'sit' or a.name.startswith('sit'))
    os.makedirs(PREV, exist_ok=True)
    sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.35, 0.40, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 2.2
    sun.rotation_euler = (math.radians(45), 0, math.radians(70)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    def rest():
        arm.animation_data.action = None; arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    def at(u):
        def f():
            arm.data.pose_position = 'POSE'; arm.animation_data.action = act
            if hasattr(act, 'slots') and len(act.slots): arm.animation_data.action_slot = act.slots[0]
            f0, f1 = act.frame_range; cv.setf(sc, f0 + (f1 - f0) * u)
        return f
    rest(); head = W('Bip01 Head'); lh = W('Bip01 L Hand')
    files = []
    files.append(render_sheet(sc, cam, [(rest, (4.6, 0, 0.0), (0, 0, 0.0), 50), (rest, (-4.6, 0, 0.0), (0, 0, 0.0), 50)], 'tpose', 520, 620))
    # sit: góc 3/4 trước, nhìn hơi từ dưới lên như người xem dưới dù
    files.append(render_sheet(sc, cam, [(at(u), (2.6, -2.2, -0.6), (0.15, 0, -0.1), 50) for u in (0, 0.25, 0.5, 0.75)], 'sit', 360, 460))
    files.append(render_sheet(sc, cam, [(rest, (head.x + 0.75, head.y - 0.25, head.z + 0.05), tuple(head + Vector((0, 0, 0.06))), 60),
                                        (rest, (lh.x + 0.45, lh.y + 0.15, lh.z + 0.25), tuple(lh), 60),
                                        (at(0.0), (0.9, -0.9, 0.2), (0.25, 0, -0.1), 45)], 'close', 420, 420))
    # tay áo (chỗ phù hiệu cũ) nhìn từ trên-trước-ngoài, ngực, lưng áo giáp
    ua = {s_: (W(f'Bip01 {s_} UpperArm') + W(f'Bip01 {s_} Forearm')) / 2 for s_ in 'LR'}
    sp = W('Bip01 Spine2')
    ft = (W('Bip01 L Foot') + W('Bip01 R Foot')) / 2
    files.append(render_sheet(sc, cam, [(rest, tuple(ua['L'] + Vector((0.1, 0.9, 0.3))), tuple(ua['L']), 50),
                                        (rest, tuple(ua['R'] + Vector((0.1, -0.9, 0.3))), tuple(ua['R']), 50),
                                        (rest, tuple(ft + Vector((0.8, -0.5, 0.25))), tuple(ft + Vector((0, 0, 0.1))), 50),
                                        (rest, tuple(sp + Vector((1.0, -0.2, 0.05))), tuple(sp), 50),
                                        (rest, tuple(sp + Vector((-1.0, 0.2, 0.05))), tuple(sp), 50)], 'detail', 420, 420))
    # đo tư thế ngồi (hệ Blender sau khi nạp glb: +X trước mặt, +Z lên, +Y bên trái người)
    pose = []
    for u in (0, 0.5):
        at(u)(); P = W('Bip01 Pelvis')
        rel = {n: tuple(round(c, 3) for c in (W('Bip01 ' + n) - P)) for n in ('L Hand', 'R Hand', 'L Calf', 'R Calf', 'L Foot', 'R Foot', 'Head', 'Neck')}
        def ang(a, b, c):
            v1, v2 = W('Bip01 ' + a) - W('Bip01 ' + b), W('Bip01 ' + c) - W('Bip01 ' + b); return round(math.degrees(v1.angle(v2)), 1)
        th = W('Bip01 L Calf') - W('Bip01 L Thigh'); sh = W('Bip01 L Foot') - W('Bip01 L Calf')
        rel['đùi T so với nằm ngang (°)'] = round(math.degrees(math.asin(-th.z / th.length)), 1)
        rel['ống chân T so với thẳng đứng (°)'] = round(math.degrees(math.acos(-sh.z / sh.length)), 1)
        rel['gối T (°)'] = ang('L Thigh', 'L Calf', 'L Foot'); rel['khuỷu T (°)'] = ang('L UpperArm', 'L Forearm', 'L Hand')
        rel['khuỷu P (°)'] = ang('R UpperArm', 'R Forearm', 'R Hand'); rel['hông'] = tuple(round(c, 4) for c in P)
        pose.append((u, rel))
    return files, sizes, pose


def write_license():
    """Thêm (hoặc thay) dòng ghi nguồn pilot.glb sau dòng Commit của LICENSE-Rocketbox.txt (convert.py viết phần đầu)."""
    path = os.path.join(OUT, 'LICENSE-Rocketbox.txt'); mark = 'Người treo dù lượn / Paraglider pilot:'
    lines = [l for l in open(path, encoding='utf8').read().split('\n') if not l.startswith(mark)]
    lines.insert(2, f'{mark} pilot.glb chuyển đổi bằng scripts/people/pilot.py từ {NAME} (đã bỏ dao, đổi màu sang ô liu / than, '
                    f'tô phủ phù hiệu, gộp vật liệu thành một atlas, thêm đoạn sit từ {CLIP})')
    with open(path, 'w', encoding='utf8', newline='\n') as f: f.write('\n'.join(lines))


# ===== Chạy =====
r = convert()
write_license()
pv = None if NO_PREVIEW else preview()
print('\n===== KẾT QUẢ =====')
for k in ('bytes', 'tris', 'joints', 'meshes', 'prims', 'mats', 'imgs', 'mat', 'normal', 'height', 'hip', 'anims', 'channels', 'finger_ch', 'pelvis_ch', 'root'):
    print(f'{k:10s} {r[k]}')
print(f"sit        {r['sit']}")
print(f"trần byte  {CAP} -> {'ĐẠT' if r['bytes'] <= CAP else 'VƯỢT'}")
if pv:
    files, sizes, pose = pv
    print(f'ảnh nạp lại: {sizes}')
    for u, rel in pose: print(f'tư thế sit u={u}: {rel}')
    for f in files: print('ảnh xem trước:', f)
