const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`Signaling server running on ws://localhost:${PORT}`);

// hostId -> { ws, deviceName, deviceAddress }
let hosts = {};

wss.on('connection', ws => {
  let clientId = uuidv4(); // untuk client yang connect
  console.log(`Client connected: ${clientId}`);

  ws.on('message', message => {
    let data;
    try { data = JSON.parse(message); } catch(e) { return; }

    switch(data.action) {
      case 'register_host':
        if(data.hostId && data.deviceName && data.deviceAddress) {
          hosts[data.hostId] = {
            ws,
            deviceName: data.deviceName,
            deviceAddress: data.deviceAddress
          };
          console.log(`Host registered: ${data.deviceName} (${data.deviceAddress})`);
        }
        break;

      case 'get_host_list':
        const hostList = Object.entries(hosts).map(([id, info]) => ({
          hostId: id,
          deviceName: info.deviceName,
          deviceAddress: info.deviceAddress
        }));
        ws.send(JSON.stringify({ action: 'host_list', hosts: hostList }));
        break;

      case 'start_stream':
      case 'sdp_offer':
      case 'sdp_answer':
      case 'ice_candidate':
        const targetHost = hosts[data.to];
        if(targetHost && targetHost.ws.readyState === WebSocket.OPEN){
          targetHost.ws.send(JSON.stringify(data));
        }
        break;
    }
  });

  ws.on('close', () => {
    // hapus host jika ws disconnect
    for(let id in hosts){
      if(hosts[id].ws === ws){
        console.log(`Host disconnected: ${hosts[id].deviceName}`);
        delete hosts[id];
      }
    }
  });
});
