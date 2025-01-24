from firebase_functions import https_fn, options
from firebase_admin import initialize_app, storage
from gradio_client import Client, handle_file
import time
import json
import requests
import httpx
import tempfile
import os
import traceback
from functools import wraps
from convert_glb import convert_glb
import subprocess

# Define the Blender script template
BLENDER_SCRIPT = '''
import bpy
import os

# Delete default cube
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import GLB
bpy.ops.import_scene.gltf(filepath="{input_path}")

# Select all objects
bpy.ops.object.select_all(action='SELECT')

# Export as STL
bpy.ops.export_mesh.stl(
    filepath="{output_path}",
    use_selection=True,
    global_scale=1.0,
    use_scene_unit=False,
    ascii=False,
    use_mesh_modifiers=True
)
'''

# Increase timeout to 540 seconds (9 minutes) and memory to 4GB
options.set_global_options(
    region="us-central1",
    memory=4096,  # 4 GiB
    timeout_sec=540  # 9 minutes
)

# Initialize Firebase Admin
app = initialize_app(options={
    'storageBucket': 'taiyaki-test1.firebasestorage.app'
})

def retry_operation(max_retries=3, initial_delay=5):
    def decorator(operation):
        @wraps(operation)
        def wrapper(*args, **kwargs):
            last_exception = None
            delay = initial_delay
            
            for attempt in range(max_retries):
                try:
                    print(f"Attempt {attempt + 1} of {max_retries} for {operation.__name__}")
                    return operation(*args, **kwargs)
                except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
                    last_exception = e
                    print(f"Timeout on attempt {attempt + 1}: {str(e)}")
                    print(f"Error traceback: {traceback.format_exc()}")
                except Exception as e:
                    if "has not enabled verbose error reporting" in str(e):
                        print("Gradio verbose error detected, checking if processing completed...")
                        if 'result' in locals() and result:
                            return result
                    last_exception = e
                    print(f"Error on attempt {attempt + 1}: {str(e)}")
                    print(f"Error traceback: {traceback.format_exc()}")
                
                if attempt < max_retries - 1:
                    sleep_time = delay * (2 ** attempt)  # Exponential backoff
                    print(f"Waiting {sleep_time} seconds before retry...")
                    time.sleep(sleep_time)
            
            print(f"All {max_retries} attempts failed for {operation.__name__}")
            raise last_exception
        return wrapper
    return decorator

@retry_operation(max_retries=3, initial_delay=5)
def download_image(url: str, temp_path: str) -> None:
    with httpx.Client(timeout=httpx.Timeout(
        connect=30.0,    # 30 seconds for connection
        read=180.0,      # 3 minutes for reading
        write=60.0,      # 1 minute for writing
        pool=60.0        # 1 minute for connection pool
    )) as client:
        response = client.get(url)
        response.raise_for_status()
        with open(temp_path, 'wb') as f:
            f.write(response.content)

@retry_operation(max_retries=3, initial_delay=5)
def run_preprocessing(client: Client, temp_path: str):
    try:
        file_data = handle_file(temp_path)
        result = client.submit(
            image=file_data,
            api_name="/preprocess_image"
        )
        try:
            return result.result(timeout=300)  # 5 minutes
        except Exception as e:
            if "has not enabled verbose error reporting" in str(e):
                time.sleep(5)  # Wait a bit and try again
                return result.result(timeout=300)
            raise
    except Exception as e:
        print(f"Preprocessing error: {str(e)}")
        print(f"Error traceback: {traceback.format_exc()}")
        raise

@retry_operation(max_retries=3, initial_delay=5)
def run_3d_generation(client: Client, temp_path: str):
    try:
        file_data = handle_file(temp_path)
        result = client.submit(
            image=file_data,
            multiimages=[],
            seed=0,
            ss_guidance_strength=7.5,
            ss_sampling_steps=12,
            slat_guidance_strength=3,
            slat_sampling_steps=12,
            multiimage_algo="stochastic",
            api_name="/image_to_3d"
        )
        try:
            return result.result(timeout=420)  # 7 minutes
        except Exception as e:
            if "has not enabled verbose error reporting" in str(e):
                time.sleep(5)  # Wait a bit and try again
                return result.result(timeout=420)
            raise
    except Exception as e:
        print(f"3D generation error: {str(e)}")
        print(f"Error traceback: {traceback.format_exc()}")
        raise

@retry_operation(max_retries=3, initial_delay=5)
def run_glb_extraction(client: Client):
    try:
        result = client.submit(
            0.95,
            1024,
            api_name="/extract_glb"
        )
        try:
            return result.result(timeout=300)  # 5 minutes
        except Exception as e:
            if "has not enabled verbose error reporting" in str(e):
                time.sleep(5)  # Wait a bit and try again
                return result.result(timeout=300)
            raise
    except Exception as e:
        print(f"GLB extraction error: {str(e)}")
        print(f"Error traceback: {traceback.format_exc()}")
        raise

def upload_to_firebase(local_path, destination_path):
    """
    Upload a file to Firebase Storage and return its public URL.
    Note: This assumes your bucket is publicly readable via IAM
    (allUsers: roles/storage.objectViewer).
    """
    try:
        bucket = storage.bucket()
        blob = bucket.blob(destination_path)
        blob.upload_from_filename(local_path)
        
        # Construct a direct URL (assuming the bucket is public via IAM).
        public_url = f"https://storage.googleapis.com/{bucket.name}/{destination_path}"
        return public_url

    except Exception as e:
        print(f"Error uploading to Firebase: {str(e)}")
        print(f"Error traceback: {traceback.format_exc()}")
        raise

def convert_glb_to_stl(glb_path: str, stl_path: str):
    print("Current working directory:", os.getcwd())
    print("Directory contents:", os.listdir())
    print("PATH environment:", os.environ.get('PATH'))
    
    # Update the Blender path to match the downloaded version
    blender_path = '/usr/local/blender-3.6.0-linux-x64/blender'
    print(f"Attempting to use Blender at: {blender_path}")
    
    try:
        process = subprocess.run(
            [
                blender_path,  # Use full path instead of just 'blender'
                '--background',
                '--python-expr',
                BLENDER_SCRIPT.format(
                    input_path=glb_path,
                    output_path=stl_path
                )
            ],
            capture_output=True,
            text=True
        )
        
        print("Blender stdout:", process.stdout)
        print("Blender stderr:", process.stderr)
        
        if process.returncode != 0:
            raise Exception(f"Blender conversion failed: {process.stderr}")
            
    except Exception as e:
        print(f"Error running Blender: {e}")
        print("System PATH:", os.environ.get('PATH'))
        raise

@https_fn.on_request()
def process_3d(request: https_fn.Request) -> https_fn.Response:
    """Process 3D endpoint with improved error handling and retries"""
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
        return https_fn.Response('', status=204, headers=headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }

    temp_files = []
    start_time = time.time()

    try:
        print(f"Starting process_3d at {time.time()}")
        
        # Create Gradio client
        client = Client("eleelenawa/TRELLIS")
        print(f"{time.time() - start_time:.2f}s: Created Gradio client")

        # Start session
        try:
            client.predict(api_name="/start_session")
            time.sleep(2)  # Brief pause after session start
            print(f"{time.time() - start_time:.2f}s: Started session")
        except Exception as e:
            if "has not enabled verbose error reporting" not in str(e):
                raise
            print("Ignoring Gradio verbose error warning")

        # Get request data
        request_json = request.get_json()
        print(f"Request data: {json.dumps(request_json, indent=2)}")
        
        image_url = request_json.get('image_url')
        user_id = request_json.get('userId', 'default')
        
        if not image_url:
            return https_fn.Response(
                json.dumps({"error": "No image URL provided"}),
                headers=headers,
                status=400
            )

        timestamp = int(time.time() * 1000)
        
        # Download image
        temp_path = os.path.join(tempfile.gettempdir(), f"temp_image_{timestamp}.png")
        temp_files.append(temp_path)
        print(f"{time.time() - start_time:.2f}s: Downloading image...")
        download_image(image_url, temp_path)
        print(f"{time.time() - start_time:.2f}s: Image downloaded")

        # Run preprocessing
        print(f"{time.time() - start_time:.2f}s: Starting preprocessing...")
        preprocessed_result = run_preprocessing(client, temp_path)
        preprocessed_path = preprocessed_result[0] if isinstance(preprocessed_result, (list, tuple)) else preprocessed_result
        temp_files.append(preprocessed_path)
        
        preprocessed_url = upload_to_firebase(
            preprocessed_path,
            f"processed/{user_id}/{timestamp}/preprocessed.png"
        )
        print(f"{time.time() - start_time:.2f}s: Preprocessing complete")

        # Run 3D generation
        print(f"{time.time() - start_time:.2f}s: Starting 3D generation...")
        three_d_result = run_3d_generation(client, temp_path)
        video_path = three_d_result['video']
        temp_files.append(video_path)
        
        video_url = upload_to_firebase(
            video_path,
            f"processed/{user_id}/{timestamp}/preview.mp4"
        )
        print(f"{time.time() - start_time:.2f}s: 3D generation complete")

        # Extract GLB
        print(f"{time.time() - start_time:.2f}s: Starting GLB extraction...")
        glb_result = run_glb_extraction(client)
        
        glb_urls = []
        if isinstance(glb_result, (list, tuple)):
            for idx, one_glb in enumerate(glb_result):
                temp_files.append(one_glb)
                glb_url = upload_to_firebase(
                    one_glb,
                    f"processed/{user_id}/{timestamp}/model_{idx}.glb"
                )
                glb_urls.append(glb_url)
        else:
            temp_files.append(glb_result)
            glb_url = upload_to_firebase(
                glb_result,
                f"processed/{user_id}/{timestamp}/model.glb"
            )
            glb_urls = [glb_url]
        print(f"{time.time() - start_time:.2f}s: GLB extraction complete")

        total_time = time.time() - start_time
        return https_fn.Response(
            json.dumps({
                "success": True,
                "preprocessed_url": preprocessed_url,
                "video_url": video_url,
                "glb_urls": glb_urls,
                "timestamp": timestamp,
                "userId": user_id,
                "processing_time": total_time
            }),
            headers=headers,
            status=200
        )

    except Exception as e:
        error_time = time.time() - start_time
        print(f"Error in process_3d at {error_time:.2f}s: {str(e)}")
        print(f"Error type: {type(e)}")
        print(f"Error traceback: {traceback.format_exc()}")
        
        if "has not enabled verbose error reporting" in str(e):
            # If we get here but have results, return success
            if 'video_url' in locals() and 'glb_urls' in locals():
                return https_fn.Response(
                    json.dumps({
                        "success": True,
                        "preprocessed_url": preprocessed_url if 'preprocessed_url' in locals() else None,
                        "video_url": video_url,
                        "glb_urls": glb_urls,
                        "timestamp": timestamp,
                        "userId": user_id,
                        "processing_time": error_time,
                        "warning": "Completed with Gradio verbose error warning"
                    }),
                    headers=headers,
                    status=200
                )
        
        return https_fn.Response(
            json.dumps({
                "error": str(e),
                "error_type": str(type(e)),
                "traceback": traceback.format_exc()
            }),
            headers=headers,
            status=500
        )
        
    finally:
        # Clean up temp files
        for temp_file in temp_files:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    print(f"Cleaned up: {temp_file}")
                except Exception as e:
                    print(f"Error cleaning up file: {e}")

@https_fn.on_request()
def convert_glb_http(request: https_fn.Request) -> https_fn.Response:
    """HTTP Function wrapper for convert_glb"""
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
        return https_fn.Response('', status=204, headers=headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }

    temp_files = []
    start_time = time.time()

    try:
        # Get request data
        request_json = request.get_json()
        print(f"Request data: {json.dumps(request_json, indent=2)}")
        
        glb_url = request_json.get('glbUrl')
        design_id = request_json.get('designId')
        
        if not glb_url or not design_id:
            return https_fn.Response(
                json.dumps({"error": "Missing required parameters"}),
                headers=headers,
                status=400
            )

        print(f"Starting GLB conversion at {time.time()}")
        print(f"GLB URL: {glb_url}")
        print(f"Design ID: {design_id}")

        # Create temp directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            # Setup file paths
            glb_path = os.path.join(temp_dir, f"{design_id}.glb")
            stl_path = os.path.join(temp_dir, f"{design_id}.stl")
            temp_files.extend([glb_path, stl_path])

            # Download GLB file
            print(f"{time.time() - start_time:.2f}s: Downloading GLB...")
            download_image(glb_url, glb_path)  # Reusing your existing download function
            print(f"{time.time() - start_time:.2f}s: GLB downloaded")

            # Convert GLB to STL
            print(f"{time.time() - start_time:.2f}s: Starting conversion...")
            convert_glb_to_stl(glb_path, stl_path)  # Your conversion function
            print(f"{time.time() - start_time:.2f}s: Conversion complete")

            # Upload STL to Firebase
            print(f"{time.time() - start_time:.2f}s: Uploading STL...")
            stl_url = upload_to_firebase(
                stl_path,
                f"conversions/{design_id}/{design_id}.stl"
            )
            print(f"{time.time() - start_time:.2f}s: Upload complete")

            total_time = time.time() - start_time
            return https_fn.Response(
                json.dumps({
                    "success": True,
                    "stlUrl": stl_url,
                    "designId": design_id,
                    "processing_time": total_time
                }),
                headers=headers,
                status=200
            )

    except Exception as e:
        error_time = time.time() - start_time
        print(f"Error in convert_glb_http at {error_time:.2f}s: {str(e)}")
        print(f"Error type: {type(e)}")
        print(f"Error traceback: {traceback.format_exc()}")
        
        return https_fn.Response(
            json.dumps({
                "error": str(e),
                "error_type": str(type(e)),
                "traceback": traceback.format_exc()
            }),
            headers=headers,
            status=500
        )
        
    finally:
        # Clean up temp files
        for temp_file in temp_files:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    print(f"Cleaned up: {temp_file}")
                except Exception as e:
                    print(f"Error cleaning up file: {e}")