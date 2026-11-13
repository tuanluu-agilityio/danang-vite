"""/* ===== Ảnh xem trước bộ phụ kiện nhà (collection preview của riverside_buildings.blend) ===== */
Cách chạy: node scripts/people/blender.mjs blender/scripts/render_preview.py
Ra: blender/.cache/preview-river.png (nhìn từ phía sông, +X), preview-back.png (nhìn từ phía sau, thấy mái),
    preview-prev1..5.png (từng họ, chéo từ phía sông).
Workbench, màu theo đỉnh, BẬT loại mặt sau (backface culling) nên mặt lật ngược sẽ thành lỗ thủng trên ảnh.
"""
import bpy, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
BLEND = os.path.join(ROOT, 'blender', 'scenes', 'riverside_buildings.blend')
OUT = os.path.join(ROOT, 'blender', '.cache')

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
bpy.data.collections['kit'].hide_render = True
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'; sh.color_type = 'VERTEX'; sh.show_backface_culling = True
sh.show_shadows = True; sh.show_cavity = True; sh.cavity_type = 'WORLD'
sc.render.resolution_x, sc.render.resolution_y = 1400, 900
sc.render.film_transparent = False
os.makedirs(OUT, exist_ok=True)

tgt = bpy.data.objects.new('target', None); sc.collection.objects.link(tgt); tgt.location = (0, -80, 22)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 35
con = cam.constraints.new('TRACK_TO'); con.target = tgt; con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'
sc.world = sc.world or bpy.data.worlds.new('w')
sh.background_type = 'VIEWPORT'; sh.background_color = (0.62, 0.70, 0.78)
shots = [('river', (125, 10, 55), (0, -80, 22)), ('back', (-120, -170, 95), (0, -80, 22))]
for o in bpy.data.collections['preview'].objects:                     # mỗi họ một ảnh gần, chéo từ phía sông (+X)
    if not o.name.endswith('_body'): continue
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    cy = sum(v[1] for v in vs) / len(vs); h = max(v[2] for v in vs)
    r = max(48.0, h * 1.7)
    shots.append((o.name.split('_')[0], (r * 0.85, cy + r * 0.5, h * 1.1 + 12), (0, cy, h * 0.6)))
for name, loc, at in shots:
    cam.location = loc; tgt.location = at
    sc.render.filepath = os.path.join(OUT, f'preview-{name}.png')
    bpy.ops.render.render(write_still=True)
    print('ảnh', sc.render.filepath)
