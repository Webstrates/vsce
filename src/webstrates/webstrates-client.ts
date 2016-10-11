const W3CWebSocket = require('websocket').w3cwebsocket;
const fs = require("fs");
const path = require("path");
const ee = require("event-emitter");
const Client = require('webstrates').Client;

import * as vscode from 'vscode';

import { WebstratesEditor } from './editor';
import { FileDocument } from './file-document';
import { Utils } from './utils';
import { Dictionary } from '../collections';

class WebstratesClient {

  private client: any;
  private documentsToWebstrates: Dictionary<vscode.TextDocument, FileDocument>;
  private emitter: any;

  constructor(hostname: string, port: number = -1) {
    this.emitter = ee({});
    this.documentsToWebstrates = new Dictionary<vscode.TextDocument, FileDocument>();
    this.connect(hostname, port);
  }

  onDidConnect(listener) {
    this.emitter.on("connected", listener);

    return {
      dispose: () => {
        this.emitter.off("connected", listener);
      }
    }
  }

  onDidDisconnect(listener) {
    this.emitter.on("disconnected", listener);

    return {
      dispose: () => {
        this.emitter.off("disconnected", listener);
      }
    }
  }

  /**
   * 
   * 
   * @param {String} webstrateId
   * @param {string} filePath
   * @returns {Thenable<FileDocument>}
   * 
   * @memberOf WebstrateFilesManager
   */
  public requestWebstrate(webstrateId: String, filePath: string): Thenable<FileDocument> {

    return new Promise((resolve, reject) => {

      WebstratesEditor.Log(`Requesting webstrate '${webstrateId}' to ${filePath}`);

      // add WebstrateFile to currently open files
      // this is required to close connection workspace.onDidCloseTextDocument
      const fileDocument = this.openDocumentAsFile(webstrateId, filePath);
      fileDocument.onDidConnect(() => {
        WebstratesEditor.Log(`Loaded webstrate '${webstrateId}'`);
      });

      fileDocument.onDidDisconnect(() => {
        WebstratesEditor.Log(`Disconnected webstrate '${webstrateId}'`);
      });

      fileDocument.onUpdate(() => {
        vscode.workspace.openTextDocument(filePath).then(doc => {

          // associate text document with webstrate file
          this.documentsToWebstrates.add(doc, fileDocument);

          vscode.window.showTextDocument(doc).then(editor => {
            // editor.setDecorations()
            // WebstrateFileManager.Log(`language id ${doc.languageId}`);
          });
        });

        resolve(fileDocument);
      });

      fileDocument.connect();
    });
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  public saveWebstrate(textDocument: vscode.TextDocument) {
    this.getFileDocument(textDocument).then(fileDocument => {
      fileDocument.save(textDocument.getText());
    });
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  public closeWebstrate(textDocument: vscode.TextDocument, deleteLocalFile: boolean = true) {

    const webstrate = this.getFileDocument(textDocument)
      .then(fileDocument => {
        fileDocument.close(deleteLocalFile);
      }, error => {
        console.error(`error ${error}`);
      });

    // remove webstrate from open webstrates
    this.documentsToWebstrates.remove(textDocument);
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  public getFileDocument(textDocument: vscode.TextDocument): Thenable<FileDocument> {

    // find webstrate file associated with the same text document
    return new Promise<FileDocument>((resolve, reject) => {
      let document = this.documentsToWebstrates.get(textDocument);

      if (document) {
        resolve(document);
      }
      else {
        let webstrateId = Utils.getWebstrateIdFromDocument(textDocument);

        let workspacePath = vscode.workspace.rootPath;
        if (!workspacePath) {
          vscode.window.showInformationMessage('Open workspace first.');
          return;
        }
        const filePath = path.join(workspacePath, `${webstrateId}`);

        this.requestWebstrate(webstrateId, filePath).then(fileDocument => {
          resolve(fileDocument);
        });
      }
    });
  }

  /**
   * Open a webstrate as file and using the client to connect to the Webstrates server.
   * 
   * @param  {String} webstrateId Webstrate document id.
   * @param  {string} filePath Path to file to store webstrate document content.
   */
  private openDocumentAsFile(webstrateId: String, filePath: string) {
    const document = this.client.openDocument(webstrateId, false);
    return new FileDocument(document, filePath);
  }

  /**
   * Connect client to Webstrates server.
   * 
   * @private
   * @param {string} address Webstrate server host name.
   * @param {number} port Webstrate port.
   * 
   * @memberOf WebstratesClient
   */
  private connect(hostname: string, port: number) {

    // Close previously opened clients.
    if (this.client) {
      this.client.close();
      this.client = null;
    }

    // Create Web socket connection to Webstrates server
    const websocket = this.createWebSocket(hostname, port);

    // Create Webstrates client
    this.client = new Client(websocket);
    this.client.onDidConnect(() => {
      WebstratesEditor.SetClientStatus(`Connected to ${hostname}`);
      this.emitter.emit("connected", {});
    });
    this.client.onDidDisconnect(() => {
      WebstratesEditor.SetClientStatus(`Disconnected from ${hostname}`);

      this.dispose(false);
      this.emitter.emit("disconnected", {});

      const config = Utils.loadWorkspaceConfig();

      if (config.reconnect) {
        WebstratesEditor.SetClientStatus(`Reconnecting`, config.reconnectTimeout / 1000);

        // Try to reconnect after 10s timeout.
        setTimeout(() => {
          this.connect(hostname, port);
        }, config.reconnectTimeout);
      }
    });
  }

  /**
   * Create a Web socket connection to the Webstrates server using the host address to connect.
   * The host address could also contain the port.
   *  
   * @param  {String} hostname The host address (e.g., webstrates.cs.au.dk or localhost:7007).
   * @param  {Number=-1} port The port number. No port number assumes default Web socket port.
   */
  private createWebSocket(hostname: string, port: number = -1) {
    // https://github.com/theturtle32/WebSocket-Node/blob/19108bbfd7d94a5cd02dbff3495eafee9e901ca4/docs/W3CWebSocket.md
    return new W3CWebSocket(
      // requestUrl
      port > -1 ? `${hostname}:${port}/ws/` : `${hostname}/ws/`,
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

  /**
   * 
   */
  public dispose(deleteLocalFile: boolean = true) {
    this.documentsToWebstrates.values().forEach(fileDocument => {
      fileDocument.close(deleteLocalFile);
    });
    this.documentsToWebstrates.clear();
  }
}

export { WebstratesClient };
