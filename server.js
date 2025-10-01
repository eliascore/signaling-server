// signaling-server.js
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let hosts = {};   // hostId -> { ws, deviceName, deviceAddress }
let clients = {}; // clientId -> ws

console.log(`Signaling server running on ws://localhost:${PORT}`);

// Heartbeat untuk deteksi koneksi mati
function heartbeat() { this.isAlive = true; }

wss.on('connection', ws => {
  console.log('New connection');
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch (e) {
      console.log('Invalid JSON:', msg);
      ws.send(JSON.stringify({ action: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { action, to } = data;

    switch (action) {
      case 'register_host': {
        if (!data.hostId) return;
        hosts[data.hostId] = {
          ws,
          deviceName: data.deviceName || `Device ${data.hostId}`,
          deviceAddress: data.deviceAddress || data.hostId
        };
        ws.hostId = data.hostId;
        console.log(`Host registered: ${data.hostId}`);
        break;
      }

      case 'register_client': {
        if (!data.clientId) return;
        clients[data.clientId] = ws;
        ws.clientId = data.clientId;
        console.log(`Client registered: ${data.clientId}`);
        break;
      }

      case 'list_hosts': {
        const hostList = Object.entries(hosts).map(([id, obj]) => ({
          hostId: id,
          deviceName: obj.deviceName,
          deviceAddress: obj.deviceAddress
        }));
        ws.send(JSON.stringify({ action: 'host_list', hosts: hostList }));
        break;
      }

      default: {
        if (to && (hosts[to] || clients[to])) {
          const targetWs = hosts[to]?.ws || clients[to];
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify(data));
            console.log(`Forwarded ${action} from ${ws.hostId || ws.clientId} -> ${to}`);
          } else {
            console.log(`Target ${to} not open`);
          }
        } else {
          console.log('Target not found:', data);
          ws.send(JSON.stringify({ action: 'error', message: 'Target not found' }));
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws.hostId) {
      delete hosts[ws.hostId];
      console.log(`Host disconnected: ${ws.hostId}`);
    }
    if (ws.clientId) {
      delete clients[ws.clientId];
      console.log(`Client disconnected: ${ws.clientId}`);
    }
  });

  ws.on('error', err => {
    console.error('WebSocket error:', err);
  });
});

// Ping/pong interval untuk cleanup koneksi zombie
const interval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      console.log('Terminating dead connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});
