import { randomBytes } from 'crypto';
import { createServer, type Server } from 'http';

export interface PlaidLinkPage {
  url: string;
  close: () => void;
}

function createPlaidLinkHtml(linkToken: string): string {
  const token = JSON.stringify(linkToken);
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Connect an institution</title>
      </head>
      <body>
        <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
        <script>
          const handler = Plaid.create({
            token: ${token},
            onSuccess: (publicToken, metadata) => {
              const params = new URLSearchParams({
                public_token: publicToken,
                institution_id: metadata.institution?.institution_id || '',
                institution_name: metadata.institution?.name || ''
              });
              location.href = 'finpulse-plaid://success?' + params.toString();
            },
            onExit: () => { location.href = 'finpulse-plaid://exit'; }
          });
          handler.open();
        </script>
      </body>
    </html>`;
}

function closeServer(server: Server): void {
  if (server.listening) server.close();
}

export function startPlaidLinkPage(linkToken: string): Promise<PlaidLinkPage> {
  const pagePath = `/${randomBytes(24).toString('hex')}`;
  const html = createPlaidLinkHtml(linkToken);
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== pagePath) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src https://cdn.plaid.com 'unsafe-inline'; frame-src https://*.plaid.com; connect-src https://*.plaid.com; img-src data: https://*.plaid.com; style-src 'unsafe-inline'",
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(html);
  });

  return new Promise((resolve, reject) => {
    const handleError = (error: Error) => {
      closeServer(server);
      reject(error);
    };
    server.once('error', handleError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', handleError);
      const address = server.address();
      if (!address || typeof address === 'string') {
        closeServer(server);
        reject(new Error('Unable to start the local Plaid Link page.'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}${pagePath}`,
        close: () => closeServer(server)
      });
    });
  });
}
