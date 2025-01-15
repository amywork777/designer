# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn
from firebase_admin import initialize_app

initialize_app()

@https_fn.on_request(
    region="us-central1"
)
def new_test(req: https_fn.Request) -> https_fn.Response:
    """Simple test function."""
    return https_fn.Response(
        "Hello World! Function is working!",
        status=200,
        headers={"Content-Type": "text/plain"}
    )