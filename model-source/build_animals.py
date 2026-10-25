import bpy, math, random, os
from mathutils import Vector
random.seed(42)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'dist','assets','models')
os.makedirs(os.path.join(ROOT,'output'),exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.65):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) or m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
skin=mat('Elephant grey',(.30,.34,.32),0,.87);ivory=mat('Ivory',(.85,.80,.63));dark=mat('Dark eyes',(.009,.014,.012),.1,.23);gold=mat('Mineral gold',(.65,.43,.12),.75,.3);cloth=mat('Deep jade',(.035,.18,.15),.15,.7);nail=mat('Hoof nails',(.49,.48,.4));pink=mat('Pink lips',(.73,.35,.34));black=mat('Black fur',(.028,.044,.046));white=mat('Ivory white fur',(.77,.78,.69));face=mat('Monkey face',(.74,.67,.59));teal=mat('Green plumage',(.025,.26,.12),.30,.46);blue=mat('Peacock sapphire',(.015,.12,.20),.65,.28);bronze=mat('Feather bronze',(.25,.23,.075),.36,.52);lichen=mat('Silver lichen',(.42,.58,.43))
def ell(name,loc,scale,ma,segments=24):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=16,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(ma)
 for p in o.data.polygons:p.use_smooth=True
 return o
def tube(name,pts,radii,ma,sides=12):
 verts=[];faces=[]
 for i,p in enumerate(pts):
  d=Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(i-1,0)]);d.normalize();ref=Vector((1,0,0)) if abs(d.x)<.8 else Vector((0,1,0));a=d.cross(ref).normalized();b=d.cross(a).normalized()
  for j in range(sides):verts.append(Vector(p)+radii[i]*(math.cos(j*math.tau/sides)*a+math.sin(j*math.tau/sides)*b))
 for i in range(len(pts)-1):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.append(tuple(reversed(range(sides))));faces.append(tuple((len(pts)-1)*sides+j for j in range(sides)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(ma)
 for p in mesh.polygons:p.use_smooth=True
 return o
def export(name,build):
 before=set(bpy.data.objects);root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);build()
 if name=='elephant':
  skins=[o for o in set(bpy.data.objects)-before-{root} if o.type=='MESH' and o.data.materials and o.data.materials[0]==skin]
  bpy.ops.object.select_all(action='DESELECT')
  for o in skins:o.select_set(True)
  bpy.context.view_layer.objects.active=skins[0];bpy.ops.object.join();o=bpy.context.object;o.name='elephant_sculpted_skin'
  remesh=o.modifiers.new('Unified sculpt','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.013;remesh.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=remesh.name)
  sm=o.modifiers.new('Sculpt polish','SMOOTH');sm.factor=1.1;sm.iterations=7;bpy.ops.object.modifier_apply(modifier=sm.name)
  for poly in o.data.polygons:poly.use_smooth=True
 objects=set(bpy.data.objects)-before-{root}
 for o in objects:o.parent=root
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=root;bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
 for o in objects:o.hide_set(True);o.hide_render=True
 root.hide_set(True);root.hide_render=True
 return root,list(objects)
def elephant():
 ell('body',(0,.1,1.0),(.44,.72,.48),skin);ell('back_arch',(0,.13,1.31),(.39,.58,.25),skin)
 ell('head',(0,-.57,1.27),(.32,.34,.39),skin);ell('forehead_L',(-.11,-.62,1.53),(.19,.23,.24),skin);ell('forehead_R',(.11,-.62,1.53),(.19,.23,.24),skin)
 for side in [-1,1]:
  ear=ell('ear_'+str(side),(side*.32,-.47,1.24),(.245,.038,.34),skin);ear.rotation_euler.z=side*.25
  ell('eye_'+str(side),(side*.252,-.806,1.38),(.023,.014,.020),dark);ell('eye_glint_'+str(side),(side*.26,-.824,1.39),(.007,.006,.007),ivory)
  for y in [-.39,.54]:
   tube('leg_'+str(side)+'_'+str(y),[(side*.29,y,1.0),(side*.31,y-.015,.61),(side*.31,y-.06,.17)],[.145,.12,.13],skin,18)
   ell('foot',(side*.31,y-.08,.13),(.155,.18,.13),skin)
   for n in [-1,0,1]:ell('nail',(side*.31+n*.06,y-.225,.115),(.033,.027,.054),nail,12)
  tube('tusk_'+str(side),[(side*.18,-.78,1.05),(side*.22,-.99,.96),(side*.23,-1.17,.98),(side*.22,-1.24,1.05)],[.044,.035,.02,.002],ivory)
 pts=[];rs=[]
 for i in range(32):
  t=i/31;pts.append((.045*math.sin(t*4),-.83-.19*math.sin(t*math.pi)+.08*t,1.26-t*1.0+.14*max(0,(t-.7)/.3)**2));rs.append(.115*(1-t)+.027*t)
 tube('trunk',pts,rs,skin,20);tube('trunk_finger',[pts[-1],(.045,-.79,.39),(.045,-.81,.42)],[.026,.018,.002],skin)
 tube('tail',[(0,.7,1.02),(.02,.9,.8),(.1,.97,.4),(.12,.98,.3)],[.04,.025,.016,.008],skin);ell('tail_tuft',(.12,.98,.27),(.035,.035,.1),black)
 crease=mat('Elephant grey folds',(.23,.27,.25),0,.95)
 for j in range(19):
  t=.16+j*.037;z=1.26-t+.14*max(0,(t-.7)/.3)**2;cy=-.83-.19*math.sin(t*math.pi)+.08*t;cx=.045*math.sin(t*4);radius=.115*(1-t)+.027*t
  tube('trunk_crease',[(cx+math.sin(a)*radius,cy-math.cos(a)*radius-.002,z+.005*math.cos(a*2)) for a in [-1.15+i/16*2.3 for i in range(17)]],[.002]*17,crease,5)
 for side in [-1,1]:
  for j in range(5):
   tube('ear_fold',[(side*(.34+i*.028),-.507-j*.002,1.44-j*.065-.07*math.sin(i/7*math.pi)) for i in range(8)],[.0028]*8,crease,5)
 verts=[];faces=[]
 for i in range(25):
  a=-1.6+i/24*3.2
  for j in range(12):y=-.29+j/11*.83;verts.append((math.sin(a)*.455,y,1.0+math.cos(a)*.52))
 for i in range(24):
  for j in range(11):n=i*12+j;faces.append((n,n+1,n+13,n+12))
 mesh=bpy.data.meshes.new('cloth');mesh.from_pydata(verts,[],faces);mesh.materials.append(cloth);o=bpy.data.objects.new('spirit_saddle',mesh);bpy.context.collection.objects.link(o)
 for y in [-.30,.54]:tube('spirit_gold_border',[(math.sin(a)*.466,y,1.0+math.cos(a)*.53) for a in [-1.6+i/40*3.2 for i in range(41)]],[.013]*41,gold,8)
 ell('spirit_forehead',(0,-.878,1.48),(.07,.015,.10),gold)
def fur(name,center,scale,ma,count):
 verts=[];faces=[]
 for k in range(count):
  z=random.uniform(-1,1);a=random.random()*math.tau;r=math.sqrt(1-z*z);n=Vector((r*math.cos(a),r*math.sin(a),z));p=Vector(center)+Vector((n.x*scale[0],n.y*scale[1],n.z*scale[2]));tip=p+n*random.uniform(.015,.035)+Vector((0,0,-.015));u=n.cross(Vector((0,0,1)))
  if u.length<.01:u=Vector((1,0,0))
  u.normalize();v=n.cross(u);start=len(verts)
  for j in range(4):verts.append(p+(u*math.cos(j*math.pi/2)+v*math.sin(j*math.pi/2))*.004)
  verts.append(tip)
  for j in range(4):faces.append((start+j,start+(j+1)%4,start+4))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(ma);o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
def monkey():
 ell('body',(0,.03,.49),(.25,.20,.34),black);ell('chest',(0,-.13,.5),(.18,.105,.28),white);ell('belly',(0,-.14,.33),(.19,.11,.17),white)
 fur('black_body_fur',(0,.03,.49),(.25,.2,.34),black,1700);fur('white_chest_fur',(0,-.13,.5),(.18,.105,.28),white,800)
 for s in [-1,1]:
  ell('thigh',(s*.19,.0,.2),(.16,.22,.15),black);ell('foot',(s*.20,-.20,.075),(.09,.18,.065),black)
  tube('arm_'+str(s),[(s*.19,-.02,.70),(s*.29,-.12,.44),(s*.27,-.25,.17)],[.095,.07,.045],black,16);ell('hand',(s*.27,-.26,.12),(.057,.063,.056),face)
  for k in range(4):tube('finger',[(s*.27+(k-1.5)*.021,-.29,.13),(s*.27+(k-1.5)*.021,-.35,.09)],[.014,.009],black,8)
  fur('shoulder_fur',(s*.19,-.02,.70),(.10,.13,.16),white,350)
 ell('head',(0,-.03,.94),(.19,.17,.21),black);ell('face',(0,-.17,.94),(.127,.076,.158),face)
 for s in [-1,1]:
  ell('cheek',(s*.125,-.135,.94),(.07,.05,.13),white);ell('eye_patch',(s*.065,-.226,.985),(.039,.013,.027),face);ell('eye',(s*.063,-.243,.99),(.017,.009,.014),dark);ell('glint',(s*.058,-.251,.997),(.005,.004,.005),ivory);ell('ear',(s*.18,-.015,.96),(.035,.035,.059),face)
 ell('muzzle',(0,-.236,.91),(.074,.035,.048),face);ell('upper_lip',(0,-.265,.895),(.055,.018,.018),pink);ell('lower_lip',(0,-.263,.876),(.052,.017,.019),pink);ell('upturned_nose',(0,-.245,.956),(.025,.021,.02),face)
 for s in [-1,1]:ell('nostril',(s*.013,-.26,.962),(.009,.005,.008),dark)
 for s in [-1,1]:
  fur('cheek_ruff',(s*.145,-.10,.90),(.075,.075,.16),white,900)
  tube('brow',[(s*.029,-.23,1.023),(s*.060,-.235,1.034),(s*.10,-.217,1.020)],[.009,.012,.006],black,8)
 for k in range(18):tube('crest',[(random.uniform(-.06,.06),random.uniform(-.05,.06),1.10),(random.uniform(-.045,.045),-.07,1.18+random.random()*.045)],[.017,.001],black,8)
 tube('tail',[(0,.17,.32),(.18,.38,.21),(.42,.43,.12),(.62,.23,.09),(.59,.0,.12)],[.055,.045,.036,.027,.007],black)
 for s in [-1,1]:
  for k in range(5):tube('spirit_lichen',[(s*.15,-.12,.76),(s*(.23+k*.02),-.16,.5),(s*(.20+k*.02),-.19,.25-random.random()*.1)],[.008,.005,.001],lichen)
 ell('spirit_medallion',(0,-.245,.68),(.06,.014,.074),gold)
def peacock():
 ell('body',(0,0,.42),(.17,.27,.23),teal);ell('wing_L',(-.15,.03,.44),(.07,.24,.15),bronze);ell('wing_R',(.15,.03,.44),(.07,.24,.15),bronze)
 tube('neck',[(0,-.13,.47),(0,-.23,.67),(0,-.25,.88),(0,-.27,.99)],[.10,.065,.045,.05],teal,20);ell('head',(0,-.29,1.0),(.065,.093,.067),teal)
 for s in [-1,1]:
  ell('face_gold',(s*.055,-.31,1.005),(.012,.049,.04),gold);ell('face_white',(s*.065,-.32,1.017),(.006,.027,.023),ivory);ell('eye',(s*.072,-.335,1.022),(.009,.014,.012),dark);tube('leg',[(s*.075,-.01,.35),(s*.078,-.03,.14),(s*.08,-.10,.035)],[.021,.015,.014],bronze,10)
  for k in [-1,0,1]:tube('toe',[(s*.08,-.10,.035),(s*.08+k*.045,-.21,.02)],[.012,.003],bronze,8)
 tube('beak',[(0,-.36,1.0),(0,-.46,.97)],[.03,.003],bronze)
 for k in range(7):
  x=(k-3)*.012;tube('crest',[(x,-.275,1.055),(x*1.3,-.25,1.19)],[.003,.002],bronze,6);ell('crest_tip',(x*1.3,-.25,1.19),(.009,.01,.023),teal,12)
 for layer in range(3):
  count=[41,33,25][layer]
  for k in range(count):
   angle=-1.25+k/(count-1)*2.5;r=[1.20,.98,.76][layer]*(1+.045*math.sin(k*2));base=Vector((0,.19-layer*.035,.43));direction=Vector((math.sin(angle),.015,math.cos(angle)));side=Vector((math.cos(angle),0,-math.sin(angle)));verts=[];faces=[]
   for j in range(19):
    f=j/18;width=.071*math.sin(math.pi*f)**.65;center=base+direction*(r*f)
    for sign in [-1,1]:verts.append(center+side*width*sign+Vector((0,.015*math.sin(f*7),0)))
   for j in range(18):n=j*2;faces.append((n,n+1,n+3,n+2))
   mesh=bpy.data.meshes.new('feather');mesh.from_pydata(verts,[],faces);mesh.materials.append(teal if k%5 else bronze);o=bpy.data.objects.new('fan_feather',mesh);bpy.context.collection.objects.link(o);tube('fan_quill',[base,base+direction*r],[.0018,.0007],bronze,6)
   tip=base+direction*r*.82;tip.y-=.018
   for name,rx,rz,ma,dep in [('outer',.045,.067,gold,0),('green',.035,.055,teal,-.007),('blue',.024,.036,blue,-.014),('core',.012,.022,dark,-.021)]:
    ob=ell('fan_eye_'+name,(tip.x,tip.y+dep,tip.z),(rx,.005,rz),ma,16);ob.rotation_euler.y=angle
   for j in range(13):
    f=.16+j*.052;center=base+direction*(r*f)
    for sign in [-1,1]:tube('fan_barb',[center,center+direction*.06+side*(sign*.063*math.sin(f*math.pi))],[.0018,.0005],bronze,4)
 for j in range(8):
  z=.50+j*.047;cy=-.13-(z-.47)*.30;radius=.087-(z-.5)*.13
  for k in range(10):
   a=k/10*math.tau;scale=ell('neck_scale',(math.cos(a)*radius,cy+math.sin(a)*radius,z),(.020,.008,.032),teal if (j+k)%4 else bronze,12);scale.rotation_euler.z=a-math.pi/2
 for j in range(6):tube('train',[(0,.15,.40),((j-2.5)*.035,.40,.18),((j-2.5)*.045,.75,.08)],[.02,.028,.003],teal,8)
models=[export('elephant',elephant),export('monkey',monkey),export('peacock',peacock)]
for i,(root,objs) in enumerate(models):
 root.hide_set(False);root.hide_render=False;root.location.x=(i-1)*2.2
 for o in objs:o.hide_set(False);o.hide_render=False
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(mat('Background',(.06,.10,.085)))
world=bpy.context.scene.world;world.use_nodes=True;next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.18,.23,.21,1);next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.35
for loc,power,size,col in [((1,-4,7),1600,5,(1,.85,.63)),((-4,1,4),1200,4,(.5,.8,1)),((4,3,5),2000,3,(1,.7,.3))]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.data.color=col;l.rotation_euler=(Vector((0,0,.6))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-7,3.2));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.7))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7.2;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 for d in prefs.devices:d.use=d.type!='CPU';print('RENDER DEVICE',d.name,d.type,d.use)
 scene.cycles.device='GPU'
except Exception as e:print('GPU config',e)
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(ROOT,'output','animal-models.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'model-source','lingmai-animals.blend'));bpy.ops.render.render(write_still=True)
print('MODELS COMPLETE')
