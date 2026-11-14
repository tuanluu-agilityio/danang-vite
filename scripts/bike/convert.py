"""/* ===== Xử lý mô hình xe tay ga "Motor Scooter" (Grab3D, CC0 1.0) thành public/bike/scooter.glb cho chế độ Lái xe máy (D-040) ===== */

Cách chạy (máy người phát triển, không cần cho build):
    npm run gen:bike
    # tức: node scripts/people/blender.mjs scripts/bike/convert.py   (Blender 4.5; không ở đường dẫn mặc định thì đặt biến BLENDER)
    # bỏ ảnh xem trước:  node scripts/people/blender.mjs scripts/bike/convert.py -- --no-preview

Nguồn: scripts/bike/src/scooter.glb (https://grab3d.com/models/vehicles/scooter/, CC0 1.0; LICENSE.txt + manifest.json cạnh tệp).
Mô hình thô (toạ độ Blender sau khi nạp glb, Z lên): mũi -Y, trái +X; nút `scooter` (rỗng) -> `scooter_body` (1 vật liệu, texture PBR nướng 2048 px),
`scooter_steering` (6 vật liệu màu phẳng; gốc trên trục cổ lái nghiêng 22 độ, trục (0, 0,375, 0,927)), `scooter_wheel_front` / `_rear` (3 vật liệu màu phẳng,
gốc ở trục, lăn quanh X cục bộ, bán kính 0,215 m). Script làm:
    1. đưa mọi lưới về toạ độ thế giới; dời gốc về giữa hai trục, xoay +90 độ quanh Z (mũi +X, trái +Y Blender = -Z glTF);
    2. cổ lái -> nút `front` (gốc trên trục cổ lái, thuộc tính tùy biến `axis` = trục trong hệ glTF): 4 vật liệu màu phẳng nướng thành màu đỉnh trên
       vật liệu `trim`, mặt đèn (scooter_lamp_butter_x) -> `lamp_head`, mặt gương -> `mirror`; thêm mặt đồng hồ (đĩa tròn trên đầu cổ lái, UV 0..1) -> `dash`;
    3. mỗi bánh -> một lưới vật liệu `trim` (màu đỉnh); hai bánh trùng hình học thì dùng chung lưới; `wheel_f` là con của `front` (lái theo cổ lái);
    4. thân -> nút `body` (vật liệu `body`, texture nướng thu về <= 1024 px JPEG 85); thêm tấm đèn hậu (`lamp_tail`), hai xi nhan sau + hai xi nhan trước trên yếm
       (`lamp_sig_l`, `lamp_sig_r`); vị trí lấy bằng tia chiếu vào bề mặt thân (in ra);
    5. nút rỗng neo: `grip_l` / `grip_r` (con của `front`; tâm hộp bao phần cao su ở hai đầu ghi đông), `foot_l` / `foot_r` (sàn để chân), `seat` (đỉnh yên),
       `eye` (trên `seat` 0,68 m, lùi 0,05 m) là con của `body`;
    6. xuất glb, nạp lại, in bảng; ảnh xem trước vào scripts/bike/.cache/preview/ (front, rear, side, rider, night, anchors — ảnh anchors có quả cầu màu
       đánh dấu neo, chỉ trong ảnh, không trong glb). Tất định: chạy hai lần ra cùng byte.
Quy ước bên dùng (src/explore/bike/model.ts): bánh lăn quanh Z cục bộ (xe tiến: góc âm); `front` xoay quanh `axis` (dương = rẽ trái); trái của xe là -Z.
"""
import bpy, bmesh, os, sys, math
from mathutils import Matrix, Vector

# ===== Đường dẫn, thông số =====
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(HERE, 'src', 'scooter.glb')
OUT = os.path.join(REPO, 'public', 'bike', 'scooter.glb')
PREV = os.path.join(HERE, '.cache', 'preview')
TEX_MAX = 1024              # px, cạnh dài tối đa của ảnh
JPEG_Q = 85                 # chất lượng JPEG
AXIS_SRC = Vector((0.0, 0.375, 0.927)).normalized()   # trục cổ lái trong toạ độ Blender của nguồn (manifest.json)
EYE_UP, EYE_BACK = 0.68, 0.05                         # m, mắt so với đỉnh yên: cao hơn, lùi sau
SEAT_Y = 0.40               # m, toạ độ Y nguồn (mũi -Y) của chỗ ngồi trên yên (yên dài 0,2..0,8, người lái ngồi nửa trước)
FOOT_Y, FOOT_X = -0.12, 0.12   # m, chỗ đặt chân trên sàn (nguồn): Y giữa yếm và mũi yên, X hai bên tim
TAIL_Z, TAIL_R = 0.61, 0.055   # m, tâm (cao) và bán kính kính đèn hậu tròn có sẵn trong texture ở đuôi (đo bằng tia, nguồn)
RSIG_X = 0.10               # m, xi nhan sau: hai sườn hộp đèn hậu, cùng độ cao
FSIG_X, FSIG_Z = 0.11, 0.88    # m, xi nhan trước: hai góc trên mặt trước yếm
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
NO_PREVIEW = '--no-preview' in ARGV

# màu tuyến tính (base, emission) của các vật liệu thêm vào
LAMP = {
    'lamp_tail': ((0.35, 0.01, 0.01), (1.0, 0.03, 0.02)),
    'lamp_sig_l': ((0.55, 0.22, 0.02), (1.0, 0.38, 0.02)),
    'lamp_sig_r': ((0.55, 0.22, 0.02), (1.0, 0.38, 0.02)),
}


# ===== Vật liệu =====
def principled(m):
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def base_of(m):
    i = principled(m).inputs
    assert not i['Base Color'].links, f'vật liệu {m.name} không phải màu phẳng'
    return tuple(i['Base Color'].default_value)


def new_mat(name, base, rough, emit=None, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = principled(m); i = p.inputs
    i['Base Color'].default_value = (*base, 1); i['Roughness'].default_value = rough; i['Metallic'].default_value = metal
    if emit: i['Emission Color'].default_value = (*emit, 1); i['Emission Strength'].default_value = 1.0
    return m


def trim_mat():
    """Vật liệu màu đỉnh: nút Color Attribute -> Base Color (bộ xuất glTF chỉ xuất COLOR_0 cho vật liệu dùng nó)"""
    m = new_mat('trim', (1, 1, 1), 0.45)
    ca = m.node_tree.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
    m.node_tree.links.new(ca.outputs['Color'], principled(m).inputs['Base Color'])
    return m


# ===== Nạp, đưa về toạ độ thế giới =====
def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    o = {k: bpy.data.objects['scooter_' + k] for k in ('body', 'steering', 'wheel_front', 'wheel_rear')}
    piv = {k: o[k].matrix_world.translation.copy() for k in o}
    for k, ob in o.items():
        mw = ob.matrix_world.copy(); ob.parent = None
        ob.data.transform(mw); ob.matrix_world = Matrix.Identity(4)
    bpy.data.objects.remove(bpy.data.objects['scooter'], do_unlink=True)
    return o, piv


# ===== Tia chiếu vào cảnh (toạ độ nguồn) =====
def ray(o, d, skip=()):
    dg = bpy.context.evaluated_depsgraph_get(); sc = bpy.context.scene
    o = Vector(o); d = Vector(d).normalized()
    for _ in range(8):
        ok, loc, n, _i, ob, _m = sc.ray_cast(dg, o, d)
        if not ok: return None
        if ob.name not in skip and n.dot(d) < 0: return loc, n, ob.name
        o = loc + d * 1e-4
    return None


def box(pts):
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def mat_verts(ob, sub):
    me = ob.data; mi = [i for i, m in enumerate(me.materials) if sub in m.name][0]
    vs = {v for p in me.polygons if p.material_index == mi for v in p.vertices}
    return [me.vertices[i].co.copy() for i in vs]


# ===== Lưới nhỏ dựng bằng code =====
def plate(name, mat, c, n, up, w, h, r, depth, seg=4):
    """Tấm bo góc (hình chữ nhật w × h, bán kính góc r) mặt trước nổi khỏi bề mặt 2 mm theo pháp tuyến n, lún vào trong `depth`"""
    n = n.normalized(); u = up - n * up.dot(n); u.normalize(); s = u.cross(n).normalized()
    ring = []
    for k, (cx, cy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        a0 = k * math.pi / 2
        for j in range(seg + 1):
            a = a0 + j * (math.pi / 2) / seg
            ring.append((cx * (w / 2 - r) + r * math.cos(a), cy * (h / 2 - r) + r * math.sin(a)))
    bm = bmesh.new()
    f = [bm.verts.new(c + n * 0.002 + s * x + u * y) for x, y in ring]
    b = [bm.verts.new(c - n * depth + s * x + u * y) for x, y in ring]
    bm.faces.new(f)
    bm.faces.new(list(reversed(b)))
    for i in range(len(ring)):
        j = (i + 1) % len(ring); bm.faces.new((f[j], f[i], b[i], b[j]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob


def disc(name, mat, c, n, fwd, rad, depth, seg=32):
    """Đĩa tròn mặt đồng hồ: mặt trên UV 0..1 (u theo bên phải người lái s, v theo hướng tới fwd), thành bên lún `depth` theo -n"""
    n = n.normalized(); v = fwd - n * fwd.dot(n); v.normalize(); s = v.cross(n).normalized()
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    t = [bm.verts.new(c + (s * math.cos(a) + v * math.sin(a)) * rad) for a in (2 * math.pi * k / seg for k in range(seg))]
    b = [bm.verts.new(p.co - n * depth) for p in t]
    top = bm.faces.new(t)
    if top.normal.dot(n) < 0: top.normal_flip()
    for i in range(seg):
        j = (i + 1) % seg; side = bm.faces.new((t[i], t[j], b[j], b[i]))
        if side.normal.dot((t[i].co + t[j].co) / 2 - c) < 0: side.normal_flip()
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        for lp in f.loops:
            d = lp.vert.co - c; d = d - n * d.dot(n)       # chiếu lên mặt đĩa: thành bên lấy UV của điểm vành phía trên
            lp[uvl].uv = (min(1, max(0, 0.5 + 0.5 * d.dot(s) / rad)), min(1, max(0, 0.5 + 0.5 * d.dot(v) / rad)))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob


def join(target, others):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [target] + others: ob.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    return target


# ===== Màu đỉnh từ vật liệu màu phẳng =====
def bake_colors(ob, keep):
    """Gán màu đỉnh (góc mặt) = màu phẳng của vật liệu từng mặt; mặt có vật liệu thuộc `keep` (tên mới) giữ vật liệu riêng, màu đỉnh trắng"""
    me = ob.data
    col = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    me.color_attributes.active_color = col
    for p in me.polygons:
        m = me.materials[p.material_index]
        c = (1, 1, 1, 1) if m.name in keep or m.name == 'trim' else base_of(m)
        for li in p.loop_indices: col.data[li].color = c


def remap(ob, order, rule):
    """Đổi danh sách vật liệu của lưới thành `order`; rule(tên cũ) -> tên mới"""
    me = ob.data; old = [m.name for m in me.materials]
    new = {name: i for i, name in enumerate(order)}
    idx = [new[rule(n)] for n in old]
    pi = [idx[p.material_index] for p in me.polygons]
    me.materials.clear()                                # clear() đặt lại chỉ số vật liệu của mặt: gán sau
    for name in order: me.materials.append(bpy.data.materials[name])
    for p, k in zip(me.polygons, pi): p.material_index = k


# ===== Dựng =====
def build():
    o, piv = load()
    body, steer, wf, wr = o['body'], o['steering'], o['wheel_front'], o['wheel_rear']
    # --- vị trí đèn / neo: tia chiếu trên toạ độ nguồn (mũi -Y, trái +X, Z lên)
    # đèn hậu: kính tròn có sẵn trong texture ở đuôi (z ≈ 0,54..0,68, mặt kính y ≈ 0,96); lưới kính nguồn có mặt lật nên lấy điểm chạm bất kể chiều pháp tuyến
    dg = bpy.context.evaluated_depsgraph_get()
    ok, tl, _n, _i, _o, _m = bpy.context.scene.ray_cast(dg, Vector((0, 3, TAIL_Z)), Vector((0, -1, 0)))
    assert ok; tail = (tl, Vector((0, 1, 0))); print('  den hau:', tail)
    rsig = {s: ray((s * RSIG_X, 3, TAIL_Z), (0, -1, 0)) for s in (1, -1)}; print('  xi nhan sau (suon hop den hau):', rsig)
    fsig = {s: ray((s * FSIG_X, -3, FSIG_Z), (0, 1, 0), skip=('scooter_steering',)) for s in (1, -1)}; print('  xi nhan truoc (yem):', fsig)
    # mặt đồng hồ: đè lên đĩa kem có sẵn trên đầu cổ lái (vật liệu trim_cream): tâm hộp bao, pháp tuyến trung bình theo diện tích
    cr = mat_verts(steer, 'cream'); mn, mx = box(cr); dash_c = (mn + mx) / 2; dash_r = (mx.x - mn.x) / 2
    me = steer.data; ci = [i for i, m in enumerate(me.materials) if 'cream' in m.name][0]
    dn = sum((p.normal * p.area for p in me.polygons if p.material_index == ci), Vector()).normalized()
    dash_c = dash_c + dn * ((mx - mn).dot(dn) / 2)       # lên mặt trên của đĩa
    print('  mat dong ho: tam', tuple(round(c, 3) for c in dash_c), 'phap tuyen', tuple(round(c, 3) for c in dn), 'ban kinh', round(dash_r, 3))
    seat = ray((0, SEAT_Y, 2), (0, 0, -1)); print('  yen:', seat)
    feet = {s: ray((s * FOOT_X, FOOT_Y, 0.6), (0, 0, -1)) for s in (1, -1)}; print('  san de chan:', feet)
    rub = mat_verts(steer, 'rubber')
    grips = {}
    for s in (1, -1):
        mn, mx = box([p for p in rub if p.x * s > 0.2]); grips[s] = (mn + mx) / 2
        print('  tay nam', 'trai' if s > 0 else 'phai', tuple(round(c, 3) for c in mn), tuple(round(c, 3) for c in mx))
    for k, v in (('tail', tail), ('rsig', rsig[1]), ('fsig', fsig[1]), ('seat', seat), ('feet', feet[1])): assert v, f'tia {k} không trúng'
    # --- vật liệu
    for m in list(bpy.data.materials):
        if m.name == 'scooter_body_pbr': m.name = 'body'
        elif m.name == 'scooter_lamp_butter_x':
            m.name = 'lamp_head'; i = principled(m).inputs
            i['Emission Color'].default_value = i['Base Color'].default_value; i['Emission Strength'].default_value = 1.0
        elif m.name == 'scooter_mirror_glass_x': m.name = 'mirror'
    trim_mat()
    for k, (b, e) in LAMP.items(): new_mat(k, b, 0.3, e)
    new_mat('dash', (0.02, 0.025, 0.03), 0.4)
    # --- lưới nhỏ trên thân (toạ độ nguồn)
    up = Vector((0, 0, 1))
    extra = [plate('tail', bpy.data.materials['lamp_tail'], tail[0], tail[1], up, 2 * TAIL_R, 2 * TAIL_R, TAIL_R, 0.02, seg=8)]
    for s, nm in ((1, 'lamp_sig_l'), (-1, 'lamp_sig_r')):
        extra.append(plate('rs' + nm, bpy.data.materials[nm], rsig[s][0], rsig[s][1], up, 0.035, 0.05, 0.012, 0.02))
        extra.append(plate('fs' + nm, bpy.data.materials[nm], fsig[s][0], fsig[s][1], up, 0.05, 0.03, 0.012, 0.02))
    join(body, extra)
    remap(body, ['body', 'lamp_tail', 'lamp_sig_l', 'lamp_sig_r'], lambda n: n)
    # --- cổ lái: màu đỉnh, đèn, gương, đồng hồ
    keep = ('lamp_head', 'mirror')
    bake_colors(steer, keep)
    d = disc('dash', bpy.data.materials['dash'], dash_c + dn * 0.003, dn, Vector((0, -1, 0)), dash_r * 0.95, 0.008)
    join(steer, [d])
    col = steer.data.color_attributes['Col']
    for p in steer.data.polygons:
        if steer.data.materials[p.material_index].name == 'dash':
            for li in p.loop_indices: col.data[li].color = (1, 1, 1, 1)
    remap(steer, ['trim', 'lamp_head', 'mirror', 'dash'], lambda n: n if n in ('lamp_head', 'mirror', 'dash') else 'trim')
    # --- bánh
    for w in (wf, wr):
        bake_colors(w, ())
        remap(w, ['trim'], lambda n: 'trim')
    # --- đổi hướng: gốc giữa hai trục, mũi +X (xoay +90 độ quanh Z)
    mid = (piv['wheel_front'] + piv['wheel_rear']) / 2
    zb = min(v.co.z for w in (wf, wr) for v in w.data.vertices)
    T = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Translation((-mid.x, -mid.y, -zb))
    for ob in (body, steer, wf, wr): ob.data.transform(T)
    P = {k: T @ v for k, v in piv.items()}
    root = bpy.data.objects.new('scooter', None); bpy.context.scene.collection.objects.link(root)
    body.name = body.data.name = 'body'; body.parent = root
    steer.name = steer.data.name = 'front'
    steer.data.transform(Matrix.Translation(-P['steering'])); steer.location = P['steering']; steer.parent = root
    ax = T.to_3x3() @ AXIS_SRC                          # trục trong Blender đích; glTF (x, y, z) = (X, Z, -Y)
    steer['axis'] = [round(ax.x, 6), round(ax.z, 6), round(-ax.y, 6)]
    for w, k, name in ((wf, 'wheel_front', 'wheel_f'), (wr, 'wheel_rear', 'wheel_r')):
        w.name = w.data.name = name
        w.data.transform(Matrix.Translation(-P[k]))
    wr.location = P['wheel_rear']; wr.parent = root
    wf.location = P['wheel_front'] - P['steering']; wf.parent = steer
    a = [v.co.copy() for v in wf.data.vertices]; b = [v.co.copy() for v in wr.data.vertices]
    diff = max((p - q).length for p, q in zip(a, b)) if len(a) == len(b) else 1
    print(f'  banh truoc so voi sau: lech lon nhat {diff:.5f} m')
    if diff < 1e-4:
        old = wr.data; wr.data = wf.data; bpy.data.meshes.remove(old); wf.data.name = 'wheel'
    # --- nút neo (toạ độ đích)
    def empty(name, pos, parent, ppos):
        e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e)
        e.empty_display_size = 0.05; e.location = pos - ppos; e.parent = parent
        return e
    zero = Vector((0, 0, 0))
    for s, nm in ((1, 'grip_l'), (-1, 'grip_r')): empty(nm, T @ grips[s], steer, P['steering'])
    for s, nm in ((1, 'foot_l'), (-1, 'foot_r')): empty(nm, T @ feet[s][0], body, zero)
    sp = T @ seat[0]; empty('seat', sp, body, zero)
    empty('eye', sp + Vector((-EYE_BACK, 0, EYE_UP)), body, zero)
    # --- ảnh: thu cạnh dài, mã hoá lại JPEG
    tmp = os.path.join(HERE, '.cache', 'tex'); os.makedirs(tmp, exist_ok=True)
    for im in sorted(bpy.data.images, key=lambda i: i.name):
        if max(im.size) > TEX_MAX:
            r = TEX_MAX / max(im.size); im.scale(max(1, int(im.size[0] * r)), max(1, int(im.size[1] * r)))
        path = os.path.join(tmp, im.name + '.jpg')
        st = bpy.context.scene.render.image_settings; st.file_format = 'JPEG'; st.quality = JPEG_Q; st.color_mode = 'RGB'
        im.save_render(path, scene=bpy.context.scene)
        new = bpy.data.images.load(path); name = im.name; new.pack()
        new.colorspace_settings.name = im.colorspace_settings.name
        for m in bpy.data.materials:
            if not m.node_tree: continue
            for nd in m.node_tree.nodes:
                if nd.type == 'TEX_IMAGE' and nd.image == im: nd.image = new
        bpy.data.images.remove(im); new.name = name
        print(f'  anh {name}: {new.size[0]}x{new.size[1]} JPEG {os.path.getsize(path)} byte')
    for m in [m for m in bpy.data.materials if m.users == 0]: bpy.data.materials.remove(m)


def export():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True, export_image_format='AUTO',
                              export_jpeg_quality=JPEG_Q, export_cameras=False, export_lights=False, export_animations=False,
                              export_tangents=False, export_texcoords=True, export_normals=True, export_extras=True,
                              export_vertex_color='MATERIAL')


# ===== Bảng kết quả =====
def report():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=OUT)
    tris = 0
    for o in sorted(bpy.data.objects, key=lambda o: o.name):
        if o.type == 'MESH':
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
            ws = [o.matrix_world @ v.co for v in o.data.vertices]
            print('  %-8s mat %5d  vl %s  x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f' % (o.name, len(o.data.polygons), [m.name for m in o.data.materials], min(w.x for w in ws), max(w.x for w in ws), min(w.y for w in ws), max(w.y for w in ws), min(w.z for w in ws), max(w.z for w in ws)))
        else: print('  nut %-8s cha %-8s' % (o.name, o.parent.name if o.parent else '-'), tuple(round(c, 3) for c in o.matrix_world.translation), dict(o.items()) if o.keys() else '')
    print('  tong tam giac', tris, ' byte', os.path.getsize(OUT))


# ===== Ảnh xem trước: nạp lại chính glb đầu ra (toạ độ Blender: mũi +X, trái +Y, Z lên) =====
def preview():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=OUT)
    sc = bpy.context.scene
    os.makedirs(PREV, exist_ok=True)
    sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.resolution_x, sc.render.resolution_y = 720, 540
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.001)); pl = bpy.context.active_object
    pm = bpy.data.materials.new('road'); pm.diffuse_color = (0.25, 0.25, 0.27, 1); pl.data.materials.append(pm)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(45), math.radians(10), math.radians(-35))
    tgt = bpy.data.objects.new('tgt', None); sc.collection.objects.link(tgt)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    eye = bpy.data.objects['eye'].matrix_world.translation.copy()
    dash = bpy.data.objects['front'].matrix_world.translation.copy()

    def shot(name, pos, look, lens, day=True):
        bg.inputs[0].default_value = (0.55, 0.65, 0.8, 1) if day else (0.01, 0.012, 0.02, 1)
        bg.inputs[1].default_value = 1.0 if day else 0.4
        sun.data.energy = 3.5 if day else 0.0
        cam.location = pos; tgt.location = look; cam.data.lens = lens
        sc.render.filepath = os.path.join(PREV, name + '.png'); bpy.ops.render.render(write_still=True)
        print('  anh xem truoc:', sc.render.filepath)
    shot('front', (3.2, 1.4, 1.3), (0, 0, 0.6), 50)
    shot('rear', (-3.2, -1.4, 1.3), (0, 0, 0.6), 50)
    shot('side', (0.0, -4.0, 0.7), (0, 0, 0.65), 50)
    shot('rider', eye + Vector((0, 0, 0.02)), dash + Vector((1.2, 0, -0.35)), 22)
    shot('night', (3.0, -1.6, 1.0), (0, 0, 0.6), 50, False)
    # ảnh neo: quả cầu màu tại các nút rỗng (chỉ trong cảnh xem trước)
    cols = {'grip_l': (1, 0, 0), 'grip_r': (1, 0.5, 0), 'foot_l': (0, 0, 1), 'foot_r': (0, 0.6, 1), 'seat': (0, 1, 0), 'eye': (1, 0, 1)}
    for n, c in cols.items():
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=bpy.data.objects[n].matrix_world.translation)
        s = bpy.context.active_object; m = bpy.data.materials.new('dbg_' + n); m.use_nodes = True
        principled(m).inputs['Base Color'].default_value = (*c, 1); principled(m).inputs['Emission Color'].default_value = (*c, 1); principled(m).inputs['Emission Strength'].default_value = 2
        s.data.materials.append(m)
    shot('anchors', (1.6, -2.6, 1.6), (0, 0, 0.8), 45)
    shot('anchors_top', (-0.2, -0.01, 3.2), (-0.2, 0, 0.6), 40)


build()
export()
report()
if not NO_PREVIEW: preview()
