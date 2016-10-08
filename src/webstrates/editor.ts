import * as vscode from 'vscode';

const path = require('path');

import { FileDocument } from './file-document';
import { WebstratesErrorCodes } from './error-codes';
import { WebstrateFilesManager } from './files-manager';
import { WebstratesEditorUtils } from './utils';
import { WebstratePreviewDocumentContentProvider } from './content-provider';

class WebstratesEditor {

  private static OutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Webstrates Editor');
  private static StatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);

  private context: vscode.ExtensionContext;
  private manager: WebstrateFilesManager;
  private previewUri: vscode.Uri;
  private activeFileDocument: FileDocument;

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
    this.initOutput();

    vscode.workspace.onDidOpenTextDocument(document => {
      let webstrateId = path.posix.basename(document.fileName);

      // Quick check for .webstrates configuration folder in workspace. This is not optimal
      // since it could also be a webstrateId or it could be a subfolder.
      // Ignore if it is the .webstrates configuration folder.
      if (document.fileName.lastIndexOf('.webstrates') > -1) {
        return;
      }

      let fileDocument = this.manager.getOpenFileDocument(document);
      if (!fileDocument) {
        console.warn(`webstate not found ${webstrateId}`);

        this.openWebstrate(webstrateId, document);
      }
    });
  }

  /**
   * 
   */
  private initFileManager() {
    const config = WebstratesEditorUtils.loadWorkspaceConfig();

    if (config) {
      const serverAddress = config.serverAddress;
      if (serverAddress) {
        this.manager = new WebstrateFilesManager(serverAddress);

        this.manager.onWebstrateDidConnect(({fileDocument}) => {
          if (this.activeFileDocument === fileDocument) {
            this.updateStatus();
          }
        });

        this.manager.onWebstrateDidDisconnect(({fileDocument}) => {
          if (this.activeFileDocument === fileDocument) {
            this.updateStatus();
          }
        });

        this.manager.onWebstrateError(({fileDocument, error}) => {

          if (!error) {
            vscode.window.showErrorMessage('Unknown Error');
            return;
          }

          switch (error.code) {
            case WebstratesErrorCodes.AccessForbidden.code:
              vscode.window.showErrorMessage(WebstratesErrorCodes.AccessForbidden.errorTemplate(fileDocument.id));
              break;
            case WebstratesErrorCodes.WebstrateNotFound.code:
              vscode.window.showWarningMessage(WebstratesErrorCodes.WebstrateNotFound.errorTemplate(fileDocument.id));
              break;
            case WebstratesErrorCodes.InternalServerError.code:
              vscode.window.showErrorMessage(WebstratesErrorCodes.InternalServerError.errorTemplate());
              break;
          }
        });
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

      const activeTextDocument = textEditor.document;
      const fileDocument = this.manager.getOpenFileDocument(activeTextDocument);

      if (fileDocument) {
        this.activeFileDocument = fileDocument;
        this.updateStatus();
      }
    });

    this.context.subscriptions.push(registration, onDidChangeTextDocumentDisposable, onChangeActiveTextEditorDisposable);
  }

  /**
   * 
   */
  private initOutput() {
    // show 'Webstrates' output channel in UI
    WebstratesEditor.OutputChannel.show();

    // Show 'Webstrates' status bar item in UI.
    WebstratesEditor.StatusBarItem.show();
  }

  /**
   * Initialize Webstrates workspace. 
   */
  private initWorkspace() {
    WebstratesEditorUtils.initWorkspace();
  }

  /**
   * Open Webstrates webstrate.
   */
  private openWebstrate(webstrateId: string = null, document: vscode.TextDocument = null) {

    let workspacePath = vscode.workspace.rootPath;
    if (!workspacePath) {
      vscode.window.showInformationMessage('Open workspace first.');
      return;
    }

    if (!webstrateId) {
      var inputPromise = this.webstrateIdInput();
      inputPromise.then(webstrateId => {

        // webstrateId will be 'undefined' on cancel input
        if (!webstrateId) {
          return;
        }

        const filePath = path.join(workspacePath, `${webstrateId}`);
        this.manager.requestWebstrate(webstrateId, filePath);
      });
    }
    else {
      const filePath = document.fileName;
      this.manager.requestWebstrate(webstrateId, filePath);
    }
  }

  /**
   * Closes the webstrate associated with the text document.
   * 
   * @param  {} textDocument
   */
  private closeWebstrate(textDocument) {
    // vscode.window.showInformationMessage('close text doc');

    const config = WebstratesEditorUtils.loadWorkspaceConfig();
    // const deleteLocalFile = typeof config.deleteLocalFilesOnClose === "undefined" ? true : config.deleteLocalFilesOnClose;
    const deleteLocalFile = !!config.deleteLocalFilesOnClose;

    this.manager.closeWebstrate(textDocument, deleteLocalFile);
  }

  /**
   * Shows Webstrates webstrate preview.
   */
  private webstratePreview() {
    // let uri = vscode.window.activeTextEditor.document.uri;
    let uri = this.previewUri;
    WebstratesEditor.Log('Preview Uri ' + uri);

    let textDocument = vscode.window.activeTextEditor.document;

    let fileDocument = this.manager.getOpenFileDocument(textDocument);
    let webstrateId = fileDocument.id;

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
    return vscode.window.showInputBox({ prompt: 'webstrate id' });
  }

  /**
   * @param  {string} message
   */
  public static Log(message: string) {
    WebstratesEditor.OutputChannel.appendLine(message);
  }

  /**
   * @param  {string} status
   */
  public static SetStatus(status: string, tooltip: string = null, color: string = null) {
    WebstratesEditor.StatusBarItem.text = status;

    if (tooltip) {
      WebstratesEditor.StatusBarItem.tooltip = tooltip;
    }

    if (color) {
      WebstratesEditor.StatusBarItem.color = color;
    }
  }

  /**
   * 
   */
  private updateStatus() {
    if (!this.activeFileDocument) {
      return;
    }

    const isConnected = this.activeFileDocument.isConnected;
    const status = isConnected ? 'Connected' : 'Disconnected';
    // const tooltip = `${this.activeFileDocument.hostAddress}`;

    WebstratesEditor.SetStatus(status/*, tooltip*/);
  }

  /**
   * 
   */
  public dispose() {
    if (this.manager) {

      const config = WebstratesEditorUtils.loadWorkspaceConfig();
      // const deleteLocalFile = typeof config.deleteLocalFilesOnClose === "undefined" ? true : config.deleteLocalFilesOnClose;
      const deleteLocalFile = !!config.deleteLocalFilesOnClose;

      this.manager.dispose(deleteLocalFile);
      this.manager = null;
    }
  }
}

export { WebstratesEditor }