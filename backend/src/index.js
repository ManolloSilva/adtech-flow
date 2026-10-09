import http from 'http';

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'adtech-flow-backend' }));
    return;
  }

  if (req.url === '/api/auction/simulate' && req.method === 'POST') {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        auctionId: 'auc-synthetic-' + Date.now(),
        winningBidder: 'thetradedesk',
        winningCpm: 3.45,
        currency: 'USD',
        status: 'completed',
      })
    );
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 AdTech Flow Mock Server running on http://localhost:${PORT}`);
});
