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
import subprocess

###############################################################################
# Cloud Functions Settings and Initialization
###############################################################################
options.set_global_options(
    region="us-central1",
    memory=4096,  # 4 GiB
    timeout_sec=540  # 9 minutes
)

app = initialize_app(options={
    'storageBucket': 'taiyaki-test1.firebasestorage.app'
})

###############################################################################
# Storage Path Utilities
###############################################################################
def get_storage_path(user_id: str, design_id: str, filename: str) -> str:
    """
    Get standardized storage path following v2 structure:
    v2/users/{userId}/{designId}/filename  - for authenticated users
    v2/anonymous/{designId}/filename       - for anonymous users
    """
    base = f"v2/{'users/' + user_id if user_id != 'anonymous' else 'anonymous'}"
    return f"{base}/{design_id}/{filename}"

def get_folder_path_from_url(url: str) -> tuple[str, str, str]:
    """
    Extract user_id, design_id and filename from a Firebase Storage URL
    Returns: (user_id, design_id, filename)
    """
    try:
        # Extract path between /o/ and ?alt=media
        path_start = url.find('/o/') + 3
        path_end = url.find('?alt=media')
        if path_start < 0 or path_end < 0:
            raise ValueError("Invalid storage URL format")
            
        full_path = url[path_start:path_end].replace('%2F', '/')
        parts = full_path.split('/')
        
        # Handle both v2 and legacy paths
        if 'v2' in parts:
            v2_index = parts.index('v2')
            if parts[v2_index + 1] == 'users':
                return parts[v2_index + 2], parts[v2_index + 3], parts[v2_index + 4]
            else:  # anonymous
                return 'anonymous', parts[v2_index + 2], parts[v2_index + 3]
        else:
            # Legacy path - construct v2 path components
            design_folder = parts[-2]
            filename = parts[-1]
            user_id = parts[1] if len(parts) > 3 else 'anonymous'
            return user_id, design_folder, filename
            
    except Exception as e:
        print(f"Error parsing URL: {e}")
        print(f"URL: {url}")
        raise ValueError(f"Could not parse storage URL: {str(e)}")

###############################################################################
# Exponential Retry Decorator
###############################################################################
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
                    last_exception = e
                    print(f"Error on attempt {attempt + 1}: {str(e)}")
                    print(f"Error traceback: {traceback.format_exc()}")
                
                if attempt < max_retries - 1:
                    sleep_time = delay * (2 ** attempt)
                    print(f"Waiting {sleep_time} seconds before retry...")
                    time.sleep(sleep_time)
            print(f"All {max_retries} attempts failed for {operation.__name__}")
            raise last_exception
        return wrapper
    return decorator

###############################################################################
# Firebase Storage Operations
###############################################################################
@retry_operation(max_retries=3, initial_delay=5)
def download_file(url: str, temp_path: str) -> None:
    with httpx.Client(timeout=httpx.Timeout(connect=30.0, read=180.0, write=60.0, pool=60.0)) as client:
        response = client.get(url)
        response.raise_for_status()
        with open(temp_path, 'wb') as f:
            f.write(response.content)

def upload_to_firebase(local_path: str, destination_path: str) -> str:
    """Upload file to Firebase Storage and return public URL."""
    try:
        bucket = storage.bucket()
        blob = bucket.blob(destination_path)
        blob.upload_from_filename(local_path)
        return f"https://storage.googleapis.com/{bucket.name}/{destination_path}"
    except Exception as e:
        print(f"Error uploading to Firebase: {e}")
        print(f"Error traceback: {traceback.format_exc()}")
        raise

# [Rest of your original Blender script remains exactly the same]
BLENDER_SCRIPT = r'''
[Your existing Blender script code here]
'''

###############################################################################
# Advanced GLB to STL Conversion
###############################################################################
def convert_glb_to_stl_advanced(glb_path: str, stl_path: str) -> int:
    """Run Blender conversion with the advanced script."""
    print("\n[convert_glb_to_stl_advanced] Starting advanced conversion.")
    print("Current working directory:", os.getcwd())
    print("Directory contents:", os.listdir())
    
    blender_path = '/usr/local/blender-3.6.0-linux-x64/blender'
    print(f"Using Blender at: {blender_path}")

    script_for_blender = BLENDER_SCRIPT \
        .replace("__GLB_PATH__", glb_path) \
        .replace("__STL_PATH__", stl_path)

    try:
        process = subprocess.run(
            [blender_path, '--background', '--python-expr', script_for_blender],
            capture_output=True,
            text=True
        )
        print("Blender stdout:", process.stdout)
        print("Blender stderr:", process.stderr)

        if process.returncode != 0:
            raise Exception(f"Blender advanced script failed:\n{process.stderr}")
        
        if not os.path.exists(stl_path):
            raise Exception("STL file was not created.")
        
        file_size = os.path.getsize(stl_path)
        if file_size == 0:
            raise Exception("STL file is empty after advanced conversion.")

        return file_size
    except Exception as e:
        print("Error during advanced Blender conversion:", e)
        raise

###############################################################################
# Main Cloud Functions
###############################################################################
@https_fn.on_request()
def process_3d(request: https_fn.Request) -> https_fn.Response:
    """Process uploaded image into 3D model with preprocessing."""
    if request.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    temp_files = []
    start_time = time.time()

    try:
        print(f"[process_3d] Starting at {time.time()}")
        
        # Initialize Gradio client
        client = Client("eleelenawa/TRELLIS")
        print(f"{time.time() - start_time:.2f}s: Created Gradio client")

        try:
            client.predict(api_name="/start_session")
            time.sleep(2)
        except Exception as e:
            print(f"[process_3d] Ignoring Gradio session error: {e}")

        # Get request data
        request_json = request.get_json()
        print(f"Request data: {json.dumps(request_json, indent=2)}")
        
        image_url = request_json.get('image_url')
        user_id = request_json.get('userId', 'anonymous')
        design_id = request_json.get('designId')
        
        if not image_url or not design_id:
            return https_fn.Response(
                json.dumps({"error": "Missing required parameters"}),
                headers=headers,
                status=400
            )

        # Download original image
        with tempfile.TemporaryDirectory() as temp_dir:
            image_path = os.path.join(temp_dir, "original.png")
            temp_files.append(image_path)
            
            download_file(image_url, image_path)
            print(f"{time.time() - start_time:.2f}s: Downloaded original image")

            # Process with Gradio
            preprocessed_result = run_preprocessing(client, image_path)
            preprocessed_path = preprocessed_result[0] if isinstance(preprocessed_result, tuple) else preprocessed_result
            temp_files.append(preprocessed_path)

            # Upload preprocessed image
            preprocessed_url = upload_to_firebase(
                preprocessed_path,
                get_storage_path(user_id, design_id, "preprocessed.png")
            )

            # Generate 3D model
            three_d_result = run_3d_generation(client, image_path)
            video_path = three_d_result['video']
            temp_files.append(video_path)

            # Upload preview video
            video_url = upload_to_firebase(
                video_path,
                get_storage_path(user_id, design_id, "preview.mp4")
            )

            # Extract and upload GLB files
            glb_result = run_glb_extraction(client)
            glb_urls = []
            
            if isinstance(glb_result, (list, tuple)):
                for idx, glb in enumerate(glb_result):
                    glb_url = upload_to_firebase(
                        glb,
                        get_storage_path(user_id, design_id, f"model_{idx}.glb")
                    )
                    glb_urls.append(glb_url)
            else:
                glb_url = upload_to_firebase(
                    glb_result,
                    get_storage_path(user_id, design_id, "model.glb")
                )
                glb_urls = [glb_url]

            return https_fn.Response(json.dumps({
                "success": True,
                "preprocessed_url": preprocessed_url,
                "video_url": video_url,
                "glb_urls": glb_urls,
                "processing_time": time.time() - start_time
            }), headers=headers)

    except Exception as e:
        print(f"[process_3d] Exception: {e}")
        print(traceback.format_exc())
        return https_fn.Response(
            json.dumps({"error": str(e), "traceback": traceback.format_exc()}),
            headers=headers,
            status=500
        )
    finally:
        for temp_file in temp_files:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass

@https_fn.on_request()
def convert_glb_http(request: https_fn.Request) -> https_fn.Response:
    """Convert GLB to STL using advanced Blender script."""
    if request.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    temp_files = []
    start_time = time.time()

    try:
        request_json = request.get_json()
        print(f"[convert_glb_http] Request data: {json.dumps(request_json, indent=2)}")

        glb_url = request_json.get('glbUrl')
        user_id = request_json.get('userId', 'anonymous')
        design_id = request_json.get('designId')

        if not all([glb_url, design_id]):
            return https_fn.Response(
                json.dumps({"error": "Missing required parameters"}),
                headers=headers,
                status=400
            )

        with tempfile.TemporaryDirectory() as temp_dir:
            glb_path = os.path.join(temp_dir, "input.glb")
            stl_path = os.path.join(temp_dir, "output.stl")
            temp_files.extend([glb_path, stl_path])

            # Download GLB
            download_file(glb_url, glb_path)
            print(f"{time.time() - start_time:.2f}s: GLB downloaded")

            # Convert to STL
            file_size = convert_glb_to_stl_advanced(glb_path, stl_path)
            print(f"{time.time() - start_time:.2f}s: Conversion complete")

            # Upload STL
            stl_url = upload_to_firebase(
                stl_path,
                get_storage_path(user_id, design_id, "stl.stl")
            )

            return https_fn.Response(json.dumps({
                "success": True,
                "stlUrl": stl_url,
                "fileSize": file_size
            }), headers=headers)

    except Exception as e:
        print(f"[convert_glb_http] ERROR: {e}")
        print(traceback.format_exc())
        return https_fn.Response(
            json.dumps({"error": str(e), "traceback": traceback.format_exc()}),
            headers=headers,
            status=500
        )
    finally:
        for temp_file in temp_files:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass