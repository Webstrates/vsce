const path = require('path');
const ee = require('event-emitter');

import * as vscode from 'vscode';
import { WebstratesEditor } from './editor';
import { Utils } from './utils';
import { WebstratesClient } from './webstrates-client';
import { FileDocument } from './file-document';
import { Dictionary } from '../collections';

class WebstrateFilesManager {

  private eventEmitter: any;

  private hostAddress: String;
  private webstratesClient: WebstratesClient;

  private documentsToWebstrates: Dictionary<vscode.TextDocument, FileDocument>;

  /**
   * 
   */
  constructor(hostAddress: String) {
    this.eventEmitter = ee({});
    this.hostAddress = hostAddress;
    this.documentsToWebstrates = new Dictionary<vscode.TextDocument, FileDocument>();

    this.webstratesClient = new WebstratesClient(hostAddress);
  }

  onDidDocumentConnect(listener: Function) {
    this.onEvent("connected", listener);
  }

  onDidDocumentDisconnect(listener: Function) {
    this.onEvent("disconnected", listener);
  }

  onDocumentError(listener: Function) {
    this.onEvent("error", listener);
  }

  private onEvent(eventName: string, listener: Function) {
    this.eventEmitter.on(eventName, listener);

    return {
      dispose() {
        this.eventEmitter.off(eventName, listener);
      }
    };
  }

  /**
   * @param  {String} webstrateId
   * @param  {String} workspacePath
   */
  requestWebstrate(webstrateId: String, filePath: string) {
    WebstratesEditor.Log(`Requesting webstrate '${webstrateId}' to ${filePath}`);
    WebstratesEditor.SetStatus(`Requesting ${webstrateId}`);

    // add WebstrateFile to currently open files
    // this is required to close connection workspace.onDidCloseTextDocument
    const fileDocument = this.webstratesClient.openDocumentAsFile(webstrateId, filePath);
    fileDocument.onDidConnect(() => {
      this.eventEmitter.emit("connected", { fileDocument });
    });

    fileDocument.onDidDisconnect(() => {
      this.eventEmitter.emit("disconnected", { fileDocument });

      const config = Utils.loadWorkspaceConfig();

      if (config.reconnect) {
        // Try to reconnect after 10s timeout.
        setTimeout(() => {
          fileDocument.connect();
        }, config.reconnectTimeout);
      }
    });

    fileDocument.onError(error => {
      this.eventEmitter.emit("error", { fileDocument, error });
    });

    fileDocument.onData(() => {
      WebstratesEditor.SetStatus(`${webstrateId} Online`, false);
      vscode.workspace.openTextDocument(filePath).then(doc => {

        // associate text document with webstrate file
        this.documentsToWebstrates.add(doc, fileDocument);

        vscode.window.showTextDocument(doc).then(editor => {
          // editor.setDecorations()
          // WebstrateFileManager.Log(`language id ${doc.languageId}`);
        });
      });
    });

    fileDocument.connect();
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  saveWebstrate(textDocument: vscode.TextDocument) {

    const webstrate = this.getOpenFileDocument(textDocument);
    if (webstrate) {
      webstrate.save(textDocument.getText());
    }
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  closeWebstrate(textDocument: vscode.TextDocument, deleteLocalFile: boolean = true) {

    const webstrate = this.getOpenFileDocument(textDocument);
    if (webstrate) {
      webstrate.close(deleteLocalFile);
    }

    // remove webstrate from open webstrates
    this.documentsToWebstrates.remove(textDocument);
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  public getOpenFileDocument(textDocument: vscode.TextDocument) {

    // find webstrate file associated with the same text document
    return this.documentsToWebstrates.get(textDocument);
  }

  /**
   * 
   */
  dispose(deleteLocalFile: boolean = true) {
    this.documentsToWebstrates.values().forEach(webstrate => {
      webstrate.close(deleteLocalFile);
    });
    this.documentsToWebstrates.clear();
  }
}

export { WebstrateFilesManager };