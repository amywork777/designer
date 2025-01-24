from firebase_functions import https_fn
import tempfile
import os
import json
import requests
import traceback
import subprocess

def convert_glb_to_stl(input_path: str, output_path: str) -> int:
    """Run Blender with the conversion script"""
    # Debug: Print environment info
    print("Current working directory:", os.getcwd())
    print("Directory contents:", os.listdir())
    print("PATH environment:", os.environ.get('PATH'))
    
    # Check if blender exists in common locations
    possible_paths = [
        '/usr/bin/blender',
        '/usr/local/bin/blender',
        '/opt/blender/blender'
    ]
    
    for path in possible_paths:
        print(f"Checking for Blender at {path}:", os.path.exists(path))
    
    # Try to find blender in PATH
    try:
        which_output = subprocess.check_output(['which', 'blender'], text=True)
        print("Blender found at:", which_output)
    except subprocess.CalledProcessError:
        print("Could not find blender using 'which'")
    
    # Use the full path to blender
    blender_path = '/usr/bin/blender'
    print(f"Attempting to use Blender at: {blender_path}")
    
    try:
        # Check if input file exists
        if not os.path.exists(input_path):
            raise Exception(f"Input GLB file not found at {input_path}")
            
        print(f"Input file size: {os.path.getsize(input_path)} bytes")
        
        # Check if Blender is available
        try:
            version_process = subprocess.run([blender_path, '--version'], 
                                          capture_output=True, 
                                          text=True)
            print("Blender version:", version_process.stdout)
        except Exception as e:
            print("Error checking Blender version:", str(e))
            raise Exception("Blender not available in the environment")
        
        # Run conversion
        print(f"Running Blender conversion...")
        process = subprocess.run(
            [
                blender_path,
                '--background',
                '--python-expr',
                BLENDER_SCRIPT.format(
                    input_path=input_path,
                    output_path=output_path
                )
            ],
            capture_output=True,
            text=True
        )
        
        print("Blender stdout:", process.stdout)
        print("Blender stderr:", process.stderr)
        
        if process.returncode != 0:
            raise Exception(f"Blender conversion failed with code {process.returncode}: {process.stderr}")
        
        if not os.path.exists(output_path):
            raise Exception("STL file was not created by Blender script")
        
        file_size = os.path.getsize(output_path)
        if file_size == 0:
            raise Exception("STL file is empty")
            
        print(f"Successfully created STL file. Size: {file_size} bytes")
        return file_size
        
    except FileNotFoundError as e:
        print(f"FileNotFoundError: {e}")
        print("System PATH:", os.environ.get('PATH'))
        raise
    except Exception as e:
        print(f"Other error: {e}")
        raise

def convert_glb(request):
    """HTTP Function wrapper for convert_glb"""
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
        return https_fn.Response('', status=204, headers=headers)

    try:
        print("Starting GLB conversion request")
        request_json = request.get_json()
        print("Request data:", json.dumps(request_json, indent=2))
        
        glb_url = request_json.get('glbUrl')
        design_id = request_json.get('designId')
        
        if not glb_url or not design_id:
            return https_fn.Response(json.dumps({
                'error': 'Missing required parameters',
                'received': request_json
            }), status=400)

        print(f"Processing GLB URL: {glb_url}")
        print(f"Design ID: {design_id}")

        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"Created temp directory: {temp_dir}")
            
            input_path = os.path.join(temp_dir, f"{design_id}.glb")
            output_path = os.path.join(temp_dir, f"{design_id}.stl")
            
            # Download GLB file
            print(f"Downloading GLB file...")
            response = requests.get(glb_url)
            print(f"Download response status: {response.status_code}")
            
            if response.status_code != 200:
                raise Exception(f"Failed to download GLB: {response.status_code}")
            
            with open(input_path, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded GLB file: {os.path.getsize(input_path)} bytes")
            
            # Convert GLB to STL
            print("Starting GLB to STL conversion...")
            file_size = convert_glb_to_stl(input_path, output_path)
            print(f"Conversion complete. STL file size: {file_size}")
            
            # Read and return STL file
            print("Reading STL file for response...")
            with open(output_path, 'rb') as f:
                stl_data = f.read()
            
            print("Preparing response...")
            return https_fn.Response(
                stl_data,
                headers={
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': f'attachment; filename="{design_id}.stl"',
                    'Content-Length': str(file_size)
                },
                status=200
            )
            
    except Exception as e:
        error_details = {
            'error': 'Conversion failed',
            'message': str(e),
            'type': type(e).__name__,
            'traceback': traceback.format_exc()
        }
        print("Error details:", json.dumps(error_details, indent=2))
        return https_fn.Response(json.dumps(error_details), status=500)