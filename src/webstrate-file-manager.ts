import * as vscode from 'vscode';
import { WebstrateFile } from './webstrate-file';

let path = require('path');

class WebstrateFileManager {

  private static WebstrateChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Webstrates');
  private hostAddress: String;
  private openFiles: WebstrateFile[];

  /**
   * 
   */
  constructor(hostAddress: String) {
    this.hostAddress = hostAddress;
    this.openFiles = [];

    // show 'Webstrates' output channel in UI
    WebstrateFileManager.WebstrateChannel.show();
  }

  /**
   * 
   */
  requestWebstrate(webstrateId: String, workspacePath: String) {
    const filePath = path.join(workspacePath, `${webstrateId}.html`);

    WebstrateFileManager.Log(`Requesting webstrate '${webstrateId}' to ${filePath}`);

    // add WebstrateFile to currently open files
    // this is required to close connection workspace.onDidCloseTextDocument
    this.openFiles.push(new WebstrateFile(webstrateId, this.hostAddress, filePath));
  }

  /**
   * 
   */
  saveWebstrate(textDocument: vscode.TextDocument) {

    const webstrateFile = this.getWebstrateFile(textDocument);
    if (webstrateFile) {
      WebstrateFileManager.Log(`Saving webstrate '${webstrateFile.webstrateId}'`);
      webstrateFile.save();
    }
  }

  /**
   * 
   */
  closeWebstrate(textDocument: vscode.TextDocument) {

    const webstrateFile = this.getWebstrateFile(textDocument);
    if (webstrateFile) {
      WebstrateFileManager.Log(`Closing webstrate '${webstrateFile.webstrateId}'`);
      webstrateFile.close();
    }

    this.removeWebstrateFile(textDocument);
  }

  /**
   * 
   */
  private getWebstrateFile(textDocument: vscode.TextDocument) {

    // find webstrate file associated with the same text document
    return this.openFiles.find((file, index) => {
      return file.textDocument === textDocument;
    });
  }

  /**
   * 
   */
  private removeWebstrateFile(textDocument: vscode.TextDocument) {

    // remove from open files
    this.openFiles = this.openFiles.filter((file, index) => {
      return file.textDocument !== textDocument;
    });
  }

  /**
   * 
   */
  public static Log(message: string) {
    WebstrateFileManager.WebstrateChannel.appendLine(message);
  }

  /**
   * 
   */
  dispose() {
    this.openFiles.forEach(file => {
      file.close();
    });
    this.openFiles.length = 0;
  }
}

export { WebstrateFileManager };