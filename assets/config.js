// Public frontend configuration. Set to your published SMARTGATE Cloudflare tunnel hostname.
window.SMARTGATE_API_BASE = location.hostname==='localhost'||location.hostname==='127.0.0.1' ? 'http://127.0.0.1:1100' : 'https://smartgate.mdmsportal.uk';
