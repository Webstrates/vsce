import * as vscode from 'vscode';

let path = require('path');

import { WebstrateFilesManager } from './files-manager';
import { WebstrateFileUtils } from './utils';
import { WebstratePreviewDocumentContentProvider } from './content-provider';

class WebstratesEditor {

  private context: vscode.ExtensionContext;
  private manager: WebstrateFilesManager;
  private previewUri: vscode.Uri;

  /**
   * @param  {vscode.ExtensionContext} context
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // initialize Webstrates webstrate file manager
    this.initFileManager();
    this.initCommands();
    this.initEvents();
    this.initPreview();
  }

  /**
   * 
   */
  private initFileManager() {
    const workspacePath = vscode.workspace.rootPath;
    const config = WebstrateFileUtils.loadWorkspaceConfig(workspacePath);

    if (config) {
      const serverAddress = config.serverAddress;
      if (serverAddress) {
        this.manager = new WebstrateFilesManager(serverAddress);
      }
    }
  }

  /**
   * 
   */
  private initCommands() {
    const initWorkspaceDisposable = vscode.commands.registerCommand('webstrates.initWorkspace', () => this.initWorkspace());
    const openDisposable = vscode.commands.registerCommand('webstrates.openWebstrate', () => this.openWebstrate());
    const webstratePreviewDisposable = vscode.commands.registerCommand('webstrates.webstratePreview', () => this.webstratePreview());

    this.context.subscriptions.push(initWorkspaceDisposable, openDisposable, webstratePreviewDisposable);
  }

  /**
   * 
   */
  private initEvents() {
    const saveDisposable = vscode.workspace.onDidSaveTextDocument((textDocument: vscode.TextDocument) => this.saveWebstrate(textDocument));
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((textDocument: vscode.TextDocument) => this.closeWebstrate(textDocument));

    this.context.subscriptions.push(saveDisposable, closeDisposable);
  }

  /**
   * 
   */
  private initPreview() {
    this.previewUri = vscode.Uri.parse('webstrate-preview://authority/webstrate-preview');
    let provider = new WebstratePreviewDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('webstrate-preview', provider);

    const onDidChangeTextDocumentDisposable = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
      if (e.document === vscode.window.activeTextEditor.document) {
        provider.update(this.previewUri);
      }
    });

    const onChangeActiveTextEditorDisposable = vscode.window.onDidChangeActiveTextEditor((textEditor: vscode.TextEditor) => {
      provider.update(this.previewUri);
    });

    this.context.subscriptions.push(registration, onDidChangeTextDocumentDisposable, onChangeActiveTextEditorDisposable);
  }

  /**
   * Initialize Webstrates workspace. 
   */
  private initWorkspace() {
    WebstrateFileUtils.initWorkspace();
  }

  /**
   * Open Webstrates webstrate.
   */
  private openWebstrate() {

    let workspacePath = vscode.workspace.rootPath;
    if (!workspacePath) {
      vscode.window.showInformationMessage('Open workspace first.');
      return;
    }

    this.webstrateIdInput();
  }

  /**
   * Closes the webstrate associated with the text document.
   * 
   * @param  {} textDocument
   */
  private closeWebstrate(textDocument) {
    // vscode.window.showInformationMessage('close text doc');
    this.manager.closeWebstrate(textDocument);
  }

  /**
   * Shows Webstrates webstrate preview.
   */
  private webstratePreview() {
    // let uri = vscode.window.activeTextEditor.document.uri;
    let uri = this.previewUri;
    WebstrateFilesManager.Log('Preview Uri ' + uri);

    let textDocument = vscode.window.activeTextEditor.document;

    let webstrateFile = this.manager.getWebstrateFile(textDocument);
    let webstrateId = webstrateFile.webstrateId;

    return vscode.commands.executeCommand('vscode.previewHtml', uri, vscode.ViewColumn.Two, `Webstrate Preview`).then((success) => {
    }, (reason) => {
      vscode.window.showErrorMessage(reason);
    });
  }

  /**
   * Saves the webstrate associated with the text document.
   */
  private saveWebstrate(textDocument) {

    const workspacePath = vscode.workspace.rootPath;
    const webstratesConfigFile = path.join(workspacePath, '.webstrates', 'config.json');

    if (textDocument.fileName === webstratesConfigFile) {
      this.initFileManager();
    }
    else {
      // vscode.window.showInformationMessage('save text doc');
      this.manager.saveWebstrate(textDocument);
    }
  }

  /**
   * 
   */
  private webstrateIdInput() {
    let workspacePath = vscode.workspace.rootPath;

    return vscode.window.showInputBox({ prompt: 'webstrate id' })
      .then(webstrateId => {

        // webstrateId will be 'undefined' on cancel input
        if (!webstrateId) {
          return;
        }

        this.manager.requestWebstrate(webstrateId, workspacePath);
      });
  }

  /**
   * 
   */
  public dispose() {
    if (this.manager) {
      this.manager.dispose();
      this.manager = null;
    }
  }
}

export { WebstratesEditor }