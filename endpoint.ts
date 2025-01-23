export default (req: Request) => {
  if (req.url.includes("/health")) {
    return new Response(JSON.stringify({ ok: true }))
  }

  return new Response(JSON.stringify({ ok: false }))
}
