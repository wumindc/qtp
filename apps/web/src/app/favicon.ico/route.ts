export function GET() {
  // @author codex: Keep local browser QA clean by serving a tiny favicon instead of a 404.
  return new Response(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0a0a0a"/><text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#fff">Q</text></svg>',
    {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
