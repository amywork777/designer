import bpy
import sys
import os
import struct
from mathutils import Matrix

def write_stl(filepath, ob):
    """Manual STL writing"""
    mesh = ob.data
    face_count = len(mesh.polygons)
    print(f"Writing {face_count} faces to STL file")
    
    with open(filepath, 'wb') as fp:
        # Write STL header (80 bytes)
        fp.write(b'Binary STL Writer\0' + b' ' * 66)
        
        # Write number of faces
        fp.write(struct.pack('<I', face_count))
        
        # Get transformation matrix
        matrix = ob.matrix_world.copy()
        
        # Iterate over faces and write data
        for face in mesh.polygons:
            # Transform normal
            normal = matrix.to_3x3() @ face.normal
            normal.normalize()
            
            # Write normal
            fp.write(struct.pack('<3f', 
                float(normal.x),
                float(normal.y),
                float(normal.z)
            ))
            
            # Write vertices
            for vert_idx in face.vertices:
                # Transform vertex position
                vert = matrix @ mesh.vertices[vert_idx].co
                fp.write(struct.pack('<3f',
                    float(vert.x),
                    float(vert.y),
                    float(vert.z)
                ))
            
            # Attribute byte count (unused)
            fp.write(struct.pack('<H', 0))

def convert_glb_to_stl(input_path, output_path):
    print(f"Converting {input_path} to {output_path}")
    
    try:
        # Clear existing objects
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
        
        # Import GLB
        print("Importing GLB file...")
        bpy.ops.import_scene.gltf(filepath=input_path)
        
        # Get all mesh objects
        mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        print(f"Found {len(mesh_objects)} mesh objects")
        
        if not mesh_objects:
            raise Exception("No mesh objects found in GLB file")
        
        # Select all mesh objects
        bpy.ops.object.select_all(action='DESELECT')
        for obj in mesh_objects:
            obj.select_set(True)
            print(f"Selected mesh: {obj.name}")
            print(f"- Vertices: {len(obj.data.vertices):,}")
            print(f"- Faces: {len(obj.data.polygons):,}")
        
        # Set active object
        bpy.context.view_layer.objects.active = mesh_objects[0]
        
        # Join objects if multiple
        if len(mesh_objects) > 1:
            print(f"\nJoining {len(mesh_objects)} mesh objects")
            bpy.ops.object.join()
        
        # Get final mesh object
        mesh_obj = bpy.context.active_object
        if not mesh_obj:
            raise Exception("No active mesh object after processing")
        
        print(f"\nFinal mesh: {mesh_obj.name}")
        print(f"- Vertices: {len(mesh_obj.data.vertices):,}")
        print(f"- Faces: {len(mesh_obj.data.polygons):,}")
        
        # Prepare mesh
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=0.0001)
        bpy.ops.mesh.quads_convert_to_tris(quad_method='BEAUTY', ngon_method='BEAUTY')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        
        # Apply transformations
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        
        # Write STL file
        print("\nWriting STL file...")
        write_stl(output_path, mesh_obj)
        
        if not os.path.exists(output_path):
            raise Exception("STL file was not created")
        
        file_size = os.path.getsize(output_path)
        if file_size == 0:
            raise Exception("STL file is empty")
            
        print(f"\nConversion completed successfully")
        print(f"STL file created: {output_path}")
        print(f"File size: {file_size:,} bytes")
        
    except Exception as e:
        print(f"\nError during conversion: {str(e)}")
        raise

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: blender --background --python script.py -- input.glb output.stl")
        sys.exit(1)
        
    input_file = sys.argv[-2]
    output_file = sys.argv[-1]
    
    try:
        convert_glb_to_stl(input_file, output_file)
    except Exception as e:
        print(f"Conversion failed: {str(e)}")
        sys.exit(1)