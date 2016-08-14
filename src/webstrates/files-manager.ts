import * as vscode from 'vscode';
import { WebstratesEditor } from './editor';
import { WebstratesEditorUtils } from './utils';
import { Webstrate } from './webstrate';
import { Dictionary } from '../collections';

let path = require('path');

class WebstrateFilesManager {

  public onWebstrateConnected: Function;
  public onWebstrateDisconnected: Function;
  public onWebstrateError: Function;

  private hostAddress: String;

  private documentsToWebstrates: Dictionary<vscode.TextDocument, Webstrate>;

  /**
   * 
   */
  constructor(hostAddress: String) {
    this.hostAddress = hostAddress;
    this.documentsToWebstrates = new Dictionary<vscode.TextDocument, Webstrate>();
  }

  /**
   * @param  {String} webstrateId
   * @param  {String} workspacePath
   */
  requestWebstrate(webstrateId: String, workspacePath: String) {
    const filePath = path.join(workspacePath, `${webstrateId}`);

    WebstratesEditor.Log(`Requesting webstrate '${webstrateId}' to ${filePath}`);

    // add WebstrateFile to currently open files
    // this is required to close connection workspace.onDidCloseTextDocument
    const webstrate = new Webstrate(webstrateId, this.hostAddress, filePath);
    webstrate.onConnected = () => {
      if (this.onWebstrateConnected) {
        this.onWebstrateConnected({ webstrate });
      }
    };

    webstrate.onDisconnected = () => {
      if (this.onWebstrateDisconnected) {
        this.onWebstrateDisconnected({ webstrate });
      }

      const config = WebstratesEditorUtils.loadWorkspaceConfig();

      if (config.reconnect) {
        // Try to reconnect after 10s timeout.
        setTimeout(() => {
          webstrate.connect();
        }, config.reconnectTimeout);
      }
    };

    webstrate.onError = (error) => {
      if (this.onWebstrateError) {
        this.onWebstrateError({ webstrate, error });
      }
    };

    webstrate.onData = () => {
      vscode.workspace.openTextDocument(webstrate.localFilePath).then(doc => {

        // associate text document with webstrate file
        this.documentsToWebstrates.add(doc, webstrate);

        vscode.window.showTextDocument(doc).then(editor => {
          // editor.setDecorations()
          // WebstrateFileManager.Log(`language id ${doc.languageId}`);
        });
      });
    }

    webstrate.connect();
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  saveWebstrate(textDocument: vscode.TextDocument) {

    const webstrate = this.getOpenWebstrate(textDocument);
    if (webstrate) {
      WebstratesEditor.Log(`Saving webstrate '${webstrate.id}'`);
      webstrate.save(textDocument.getText());
    }
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  closeWebstrate(textDocument: vscode.TextDocument) {

    const webstrate = this.getOpenWebstrate(textDocument);
    if (webstrate) {
      WebstratesEditor.Log(`Closing webstrate '${webstrate.id}'`);
      webstrate.close();
    }

    // remove webstrate from open webstrates
    this.documentsToWebstrates.remove(textDocument);
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  public getOpenWebstrate(textDocument: vscode.TextDocument) {

    // find webstrate file associated with the same text document
    return this.documentsToWebstrates.get(textDocument);
  }

  /**
   * 
   */
  dispose() {
    this.documentsToWebstrates.values().forEach(webstrate => {
      webstrate.close();
    });
    this.documentsToWebstrates.clear();
  }
}

export { WebstrateFilesManager };