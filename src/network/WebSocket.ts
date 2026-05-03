// import { Logging } from 'homebridge';
// import { FBXSessionCredentials } from '../freeboxOS/FreeboxSession';

// import * as fs from 'fs';
// import https from 'https';
// import WebSocket from 'ws';

// export class FreeboxWebSocket {
//   private eventsAPI: string = 'ws/event';
//   private webSocket: WebSocket;
//   private httpsAgent: https.Agent;

//   constructor(
//     public readonly log: Logging,
//     private readonly webSocketUrl: string,
//     private credentials: FBXSessionCredentials,
//   ) {
//     this.warn(`Using  ${this.webSocketUrl}/`);
//     const ca = fs.readFileSync('FBXCerts.crt');
//     this.httpsAgent = new https.Agent({
//       ca: ca,
//       keepAlive: true,
//     });
//     // this.httpsAgent.on('keylog', (line, _tlsSocket) => {
//     //   this.debug(`SSL KEYS event: ${line}`);
//     // });
//     this.webSocket = new WebSocket(`${this.webSocketUrl}/`,
//       // 'json',
//       {
//         headers: { ['X-Fbx-App-Auth']: this.credentials.session_token || '' },
//         agent: this.httpsAgent,
//       },
//     );
//     // webSocket.addEventListener('open', (event) => {
//     //   this.debug('Connection opened ! '+ JSON.stringify(event));
//     // });
//     this.webSocket.addEventListener('open', this.openEvent.bind(this));
//     this.webSocket.addEventListener('message', this.onMessage.bind(this));
//     // this.webSocket.on('error', this.error);

//   }

//   private debug(s: string) {
//     this.log.debug(`FreeboxWebSocket -> ${s}`);
//   }

//   private info(s: string) {
//     this.log.info(`FreeboxWebSocket -> ${s}`);
//   }

//   private warn(s: string) {
//     this.log.warn(`FreeboxWebSocket -> ${s}`);
//   }

//   private error(s: string) {
//     this.log.error(`FreeboxWebSocket -> ${s}`);
//   }

//   private success(s: string) {
//     this.log.success(`FreeboxWebSocket -> ${s}`);
//   }

//   private openSocket() {
//     this.webSocket.close();
//     this.webSocket = new WebSocket(`${this.webSocketUrl}/`,
//       // 'json',
//       {
//         headers: { ['X-Fbx-App-Auth']: this.credentials.session_token || '' },
//         agent: this.httpsAgent,
//       },
//     );
//   }

//   private async openEvent(event: WebSocket.Event) {
//     this.debug('Connection opened ! ' + JSON.stringify(event));
//     const o = {
//       request_id: 1,
//       action:'register',
//       events: {

//       },
//     };
//     this.webSocket.send(JSON.stringify(o));
//   }

//   private async onMessage(event: WebSocket.Event) {
//     this.debug('Message from server ' + JSON.stringify(event));
//   }

//   async newCredentials(credentials: FBXSessionCredentials) {
//     this.credentials = credentials;
//     this.openSocket();
//   }
// }