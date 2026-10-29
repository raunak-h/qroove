# DNS (Cloudflare)

Zone `sataklela.com` is on Cloudflare. Qroove uses one record:

| Type  | Name                     | Target                                    | Proxy                 |
| ----- | ------------------------ | ----------------------------------------- | --------------------- |
| CNAME | `qroove`                 | the target Railway displays               | DNS only (grey cloud) |
| TXT   | `_railway-verify.qroove` | `railway-verify=…` value Railway displays | n/a                   |

## Adding or changing the domain

1. `railway domain qroove.sataklela.com --service web` prints the required CNAME target. The ownership TXT
   record (`_railway-verify`) is not printed there: read it with the Railway MCP `domain-status` tool or the
   dashboard. Without it the certificate stays at "validating ownership" and the site serves the wrong
   certificate.
2. Create the record in Cloudflare (dashboard, or the `cloudflare` MCP server) with **Proxy status: DNS
   only**. Railway issues the TLS certificate once it sees the CNAME; this takes a few minutes.
3. Check `curl -s https://qroove.sataklela.com/api/health`.

## Turning the proxy on (optional)

Only after the certificate is active. Set SSL/TLS mode to **Full (strict)** first. Live updates use
Server-Sent Events; the server already sends `Cache-Control: no-cache` and `X-Accel-Buffering: no` on streams,
which Cloudflare honours. Keep **Rocket Loader** off for this hostname and do not add caching rules for
`/api/*`. If streams stall after enabling the proxy, switch back to DNS only; the client falls back to
polling every 10 s regardless.
