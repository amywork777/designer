

from firebase_functions import https_fn, options
from gradio_client import Client, handle_file
import time
import json
import sys
import requests
import tempfile
import os
from pathlib import Path

# Configure Firebase Functions
options.set_global_options(
    region="us-central1",
    memory=2048,
    timeout_sec=540
)

# Test image URL for when no image is provided
TEST_IMAGE_URL = "https://firebasestorage.googleapis.com/v0/b/taiyaki-test1.firebasestorage.app/o/designs%2F1736917995583_img-WnGSWq6GSUHxox6T7RvnWItV.png?alt=media&token=d5727bf3-b638-41ad-9ba8-5a076b3fa229"

def download_and_save_image(url):
    """Download image from URL and save to temporary file"""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Create temporary file with .png extension
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"temp_image_{int(time.time())}.png")
        
        # Save the image
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        print(f"Image saved temporarily at: {temp_path}")
        return temp_path
    
    except Exception as e:
        print(f"Error downloading image: {e}")
        raise

@https_fn.on_request()
def test_deploy(request: https_fn.Request) -> https_fn.Response:
    """Health check endpoint"""
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
        return https_fn.Response('', status=204, headers=headers)

    try:
        # Initialize client to test connection
        client = Client("eleelenawa/TRELLIS")
        
        response_data = {
            "status": "healthy",
            "timestamp": time.time(),
            "test_image_url": TEST_IMAGE_URL
        }
        
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        }
        
        return https_fn.Response(
            json.dumps(response_data),
            headers=headers,
            status=200
        )
    except Exception as e:
        print(f"Error: {e}")
        print(f"Error type: {type(e)}")
        return https_fn.Response(
            json.dumps({"error": str(e)}),
            status=500
        )

@https_fn.on_request()
def process_3d(request: https_fn.Request) -> https_fn.Response:
    """Process 3D endpoint"""
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

    temp_file_path = None

    try:
        # Initialize client
        print("Initializing client...")
        client = Client("eleelenawa/TRELLIS")
        
        print("Starting session...")
        session_result = client.predict(api_name="/start_session")
        time.sleep(2)

        # Get image URL from request or use test URL
        if request.method == 'POST':
            request_json = request.get_json()
            image_url = request_json.get('image_url', TEST_IMAGE_URL)
        else:
            image_url = TEST_IMAGE_URL

        # Download and save image
        print(f"Downloading image from: {image_url}")
        temp_file_path = download_and_save_image(image_url)
        print(f"Image saved at: {temp_file_path}")

        # Submit jobs to queue using the temporary file
        print("Preprocessing image...")
        job = client.submit(
            image=handle_file(temp_file_path),
            api_name="/preprocess_image"
        )
        preprocessed = job.result()
        print("Preprocessing complete")

        print("Generating 3D asset...")
        job = client.submit(
            image=handle_file(temp_file_path),
            multiimages=[],
            seed=0,
            ss_guidance_strength=7.5,
            ss_sampling_steps=12,
            slat_guidance_strength=3,
            slat_sampling_steps=12,
            multiimage_algo="stochastic",
            api_name="/image_to_3d"
        )
        result = job.result()
        print("3D generation complete")
        print(f"Video file location: {result['video']}")
        
        time.sleep(5)
        
        print("Extracting GLB...")
        job = client.submit(
            0.95,
            1024,
            api_name="/extract_glb"
        )
        glb_result = job.result()
        print(f"GLB Result: {glb_result}")

        return https_fn.Response(
            json.dumps({
                "success": True,
                "preprocessed": preprocessed,
                "video_url": result.get('video', ''),
                "glb_result": glb_result
            }),
            headers=headers,
            status=200
        )

    except Exception as e:
        print(f"Error: {e}")
        print(f"Error type: {type(e)}")
        return https_fn.Response(
            json.dumps({
                "error": str(e),
                "error_type": str(type(e))
            }),
            headers=headers,
            status=500
        )
        
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                print(f"Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                print(f"Error cleaning up temporary file: {e}")
