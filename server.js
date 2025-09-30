const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Render akan set PORT lewat environment variable
const PORT = process.env.PORT || 8080;

// Membuat WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`Signaling server running on ws://localhost:${PORT}`);

// Struktur data host: hostId -> { ws, deviceName, deviceAddress }
let hosts = {};

// Ketika ada client / host connect
wss.on('connection', ws => {
  let clientId = uuidv4(); // ID unik untuk setiap koneksi
  console.log(`Client connected: ${clientId}`);

  ws.on('message', message => {
    let data;
    try { data = JSON.parse(message); } catch(e) { return; }

    switch(data.action) {

      // Registrasi host
      case 'register_host':
        if(data.hostId && data.deviceName && data.deviceAddress){
          hosts[data.hostId] = {
            ws,
            deviceName: data.deviceName,
            deviceAddress: data.deviceAddress
          };
          console.log(`Host registered: ${data.deviceName} (${data.deviceAddress})`);
        }
        break;

      // Client request list host
      case 'get_host_list':
        const hostList = Object.entries(hosts).map(([id, info]) => ({
          hostId: id,
          deviceName: info.deviceName,
          deviceAddress: info.deviceAddress
        }));
        ws.send(JSON.stringify({ action: 'host_list', hosts: hostList }));
        break;

      // Request start streaming atau forward SDP/ICE
      case 'start_stream':
      case 'sdp_offer':
      case 'sdp_answer':
      case 'ice_candidate':
        const targetHost = hosts[data.to];
        if(targetHost && targetHost.ws.readyState === WebSocket.OPEN){
          targetHost.ws.send(JSON.stringify(data));
        }
        break;

      default:
        console.log("Unknown action:", data.action);
    }
  });

  ws.on('close', () => {
    // Hapus host jika ws disconnect
    for(let id in hosts){
      if(hosts[id].ws === ws){
        console.log(`Host disconnected: ${hosts[id].deviceName}`);
        delete hosts[id];
      }
    }
  });
});
