import * as vscode from 'vscode';

let path = require('path');

import { Webstrate } from './webstrate';
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
  private activeWebstrate: Webstrate;

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

        this.manager.onWebstrateConnected = ({webstrate}) => {
          if (this.activeWebstrate === webstrate) {
            this.updateStatus();
          }
        }

        this.manager.onWebstrateDisconnected = ({webstrate}) => {
          if (this.activeWebstrate === webstrate) {
            this.updateStatus();
          }
        }

        this.manager.onWebstrateError = ({webstrate, error}) => {

          if (!error) {
            vscode.window.showErrorMessage('Unknown Error');
            return;
          }

          switch (error.code) {
            case WebstratesErrorCodes.AccessForbidden.code:
              vscode.window.showErrorMessage(WebstratesErrorCodes.AccessForbidden.errorTemplate(webstrate.id));
              break;
            case WebstratesErrorCodes.WebstrateNotFound.code:
              vscode.window.showWarningMessage(WebstratesErrorCodes.WebstrateNotFound.errorTemplate(webstrate.id));
              break;
            case WebstratesErrorCodes.InternalServerError.code:
              vscode.window.showErrorMessage(WebstratesErrorCodes.InternalServerError.errorTemplate());
              break;
          }
        }
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
      const webstrate = this.manager.getOpenWebstrate(activeTextDocument);

      if (webstrate) {
        this.activeWebstrate = webstrate;
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
    WebstratesEditor.Log('Preview Uri ' + uri);

    let textDocument = vscode.window.activeTextEditor.document;

    let webstrate = this.manager.getOpenWebstrate(textDocument);
    let webstrateId = webstrate.id;

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
    const isConnected = this.activeWebstrate.isConnected;
    const status = isConnected ? 'Connected' : 'Disconnected';
    const tooltip = `${this.activeWebstrate.hostAddress}`;

    WebstratesEditor.SetStatus(status, tooltip);
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