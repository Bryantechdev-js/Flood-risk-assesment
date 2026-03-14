"""
Run this file to start the Flood Detection API server.
Usage: python start.py
"""
import uvicorn
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    print("=" * 50)
    print("  Flood Detection API")
    print("=" * 50)
    print("  Docs:   http://localhost:8000/docs")
    print("  ReDoc:  http://localhost:8000/redoc")
    print("  Health: http://localhost:8000/")
    print("=" * 50)

    uvicorn.run("main:app", host="localhost", port=8000, reload=True, log_level="info")
