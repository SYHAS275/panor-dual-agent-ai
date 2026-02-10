$cameraName = "HP True Vision FHD Camera"
$serverUrl = "rtsp://localhost:8554/cam"

Write-Host "Streaming from '$cameraName' to '$serverUrl'..."
ffmpeg -f dshow -i video="$cameraName" -c:v libx264 -preset ultrafast -tune zerolatency -g 30 -keyint_min 30 -sc_threshold 0 -f rtsp $serverUrl
