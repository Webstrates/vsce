import * as vscode from 'vscode';
import { WebstratesEditor } from './editor';
import { Webstrate } from './webstrate';

let path = require('path');

class WebstrateFilesManager {

  private hostAddress: String;
  private openWebstrates: Webstrate[];

  public onWebstrateConnected: Function;
  public onWebstrateDisconnected: Function;
  public onWebstrateError: Function;

  /**
   * 
   */
  constructor(hostAddress: String) {
    this.hostAddress = hostAddress;
    this.openWebstrates = [];
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
    };

    webstrate.onError = (error) => {
      if (this.onWebstrateError) {
        this.onWebstrateError({ webstrate, error });
      }
    };
    webstrate.connect();

    this.openWebstrates.push(webstrate);
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  saveWebstrate(textDocument: vscode.TextDocument) {

    const webstrate = this.getOpenWebstrate(textDocument);
    if (webstrate) {
      WebstratesEditor.Log(`Saving webstrate '${webstrate.id}'`);
      webstrate.save();
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
    this.openWebstrates = this.openWebstrates.filter(webstrate => {
      return webstrate.textDocument !== textDocument;
    });
  }

  /**
   * @param  {vscode.TextDocument} textDocument
   */
  public getOpenWebstrate(textDocument: vscode.TextDocument) {

    // find webstrate file associated with the same text document
    return this.openWebstrates.find(webstrate => {
      return webstrate.textDocument === textDocument;
    });
  }
  
  /**
   * 
   */
  dispose() {
    this.openWebstrates.forEach(webstrate => {
      webstrate.close();
    });
    this.openWebstrates.length = 0;
  }
}

export { WebstrateFilesManager };