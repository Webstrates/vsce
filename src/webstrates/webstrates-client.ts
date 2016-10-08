const W3CWebSocket = require('websocket').w3cwebsocket;
const fs = require("fs");
const Client = require('webstrates').Client;

import { FileDocument } from './file-document';

class WebstratesClient {

  private client: any;

  constructor(address: String, port: Number = -1) {

    // Create Web socket connection to Webstrates server
    const websocket = this.createWebSocket(address, port);

    // Create Webstrates client
    this.client = new Client(websocket);
  }

  /**
   * Open a webstrate as file and using the client to connect to the Webstrates server.
   * 
   * @param  {String} webstrateId Webstrate document id.
   * @param  {string} filePath Path to file to store webstrate document content.
   */
  openDocumentAsFile(webstrateId: String, filePath: string) {
    const document = this.client.openDocument(webstrateId, false);
    return new FileDocument(document, filePath);
  }

  /**
   * Create a Web socket connection to the Webstrates server using the host address to connect.
   * The host address could also contain the port.
   *  
   * @param  {String} address The host address (e.g., webstrates.cs.au.dk or localhost:7007).
   * @param  {Number=-1} port The port number. No port number assumes default Web socket port.
   */
  private createWebSocket(address: String, port: Number = -1) {
    // https://github.com/theturtle32/WebSocket-Node/blob/19108bbfd7d94a5cd02dbff3495eafee9e901ca4/docs/W3CWebSocket.md
    return new W3CWebSocket(
      // requestUrl
      port > -1 ? `${address}:${port}/ws/` : `${address}/ws/`,
      // requestedProtocols
      undefined,
      // origin
      undefined,
      // headers
      {
        // cookie: "session=XXX"
      },
      // requestOptions
      undefined,
      // clientConfig
      {
        maxReceivedFrameSize: 1024 * 1024 * 20 // 20 MB
      });
  }
}

export { WebstratesClient };
