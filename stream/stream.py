from flask import Flask, Response
from flask_cors import CORS
import cv2

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

camera = cv2.VideoCapture(0)


def generate_frames():
    while True:
        success, frame = camera.read()
        if not success:
            break
        ret, buffer = cv2.imencode(".jpg", frame)
        frame = buffer.tobytes()
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")


@app.route("/")
def index():
    return """
    <html>
    <head>
        <title>Webcam Stream</title>
        <style>
            body { background: #000; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; }
            img { max-width: 100%; max-height: 100%; border: 2px solid #333; border-radius: 8px; }
        </style>
    </head>
    <body>
        <img src="/video" />
    </body>
    </html>
    """


@app.route("/video")
def video():
    response = Response(
        generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame"
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Cache-Control"] = "no-cache"
    return response


if __name__ == "__main__":
    print("Starting PANOR.AI Stream Server...")
    print("Stream URL: http://localhost:8080/video")
    print("Press Ctrl+C to stop")
    app.run(host="0.0.0.0", port=8080, threaded=True)
