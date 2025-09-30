// signaling-server.js
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let hosts = {};   // hostId -> ws
let clients = {}; // clientId -> ws

console.log(`Signaling server running on ws://localhost:${PORT}`);

wss.on('connection', ws => {
  console.log('New connection');

  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch (e) {
      console.log('Invalid JSON:', msg);
      return;
    }

    const action = data.action;
    const targetId = data.to;

    switch (action) {
      case 'register_host':
        if (!data.hostId) return;
        hosts[data.hostId] = ws;
        ws.hostId = data.hostId;
        console.log(`Host registered: ${data.hostId}`);
        break;

      case 'register_client':
        if (!data.clientId) return;
        clients[data.clientId] = ws;
        ws.clientId = data.clientId;
        console.log(`Client registered: ${data.clientId}`);
        break;

      case 'list_hosts':
        // Kirim daftar host aktif ke client
        const hostList = Object.keys(hosts).map(id => ({
          hostId: id,
          deviceName: hosts[id].deviceName || `Device ${id}`,
          deviceAddress: hosts[id].deviceAddress || id
        }));
        ws.send(JSON.stringify({ action: 'host_list', hosts: hostList }));
        break;

      default:
        // Forward semua message ke targetId (host/client)
        if (targetId && (hosts[targetId] || clients[targetId])) {
          const targetWs = hosts[targetId] || clients[targetId];
          targetWs.send(JSON.stringify(data));
        } else {
          console.log('Target not found or no targetId:', data);
        }
        break;
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
});
