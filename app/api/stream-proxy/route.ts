import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for streaming

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url);

    // Only allow http/https protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }

    // Fetch the stream with headers to bypass ngrok interstitial
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for initial connection

    const response = await fetch(url, {
      headers: {
        "Accept": "multipart/x-mixed-replace; boundary=frame, image/jpeg, image/png, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "ngrok-skip-browser-warning": "69420", // Bypass ngrok free tier interstitial page
        "bypass-tunnel-reminder": "true", // For other tunnel services
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Check if it's an ngrok interstitial HTML page
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        return NextResponse.json(
          { error: "Received HTML instead of stream. The ngrok tunnel may require browser verification first. Try opening the URL directly in a browser tab first, then retry." },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: `Stream returned ${response.status}` },
        { status: response.status }
      );
    }

    // Check if we got HTML (ngrok interstitial) instead of stream
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "Received HTML page instead of video stream. Please open the ngrok URL in browser first to bypass the warning, then try again." },
        { status: 502 }
      );
    }

    // Forward the stream with CORS headers
    const headers = new Headers();
    headers.set("Content-Type", contentType || "multipart/x-mixed-replace; boundary=frame");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "*");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Connection", "keep-alive");
    headers.set("X-Accel-Buffering", "no"); // Disable nginx buffering if behind nginx

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Stream proxy error:", error);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Connection timeout - stream server took too long to respond" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect to stream" },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
