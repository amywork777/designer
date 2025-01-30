import functions_framework
from firebase_admin import initialize_app, storage
import json

initialize_app()

@functions_framework.http
def process_3d(request):
    # ... rest of your code ... 