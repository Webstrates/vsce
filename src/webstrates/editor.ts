import * as vscode from 'vscode';

const path = require('path');
var elegantSpinner = require('elegant-spinner');
var frame = elegantSpinner();

import { FileDocument } from './file-document';
import { WebstratesErrorCodes } from './error-codes';
import { WebstrateFilesManager } from './files-manager';
import { Utils } from './utils';
import { WebstratePreviewDocumentContentProvider } from './content-provider';

class WebstratesEditor {

  private static OutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Webstrates Editor');
  private static StatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);

  private context: vscode.ExtensionContext;
  private manager: WebstrateFilesManager;
  private previewUri: vscode.Uri;
  private activeFileDocument: FileDocument;

  // Spinner interval -> used in status bar to show a progressing spinner before message.
  private static statusBarSpinnerInterval: any;

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

    // Show a 3 seconds status message that Webstrates editor has sucessfully loaded.
    vscode.window.setStatusBarMessage("Webstrates Editor successfully loaded.", 3000);
  }

  /**
   * Initialize file manager.
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
   */
  private initFileManager() {
    const config = Utils.loadWorkspaceConfig();

    if (config) {
      const serverAddress = config.serverAddress;
      if (serverAddress) {
        this.manager = new WebstrateFilesManager(serverAddress);

        this.manager.onDidDocumentConnect(({fileDocument}) => {
          if (this.activeFileDocument === fileDocument) {
            this.updateStatus();
          }
        });

        this.manager.onDidDocumentDisconnect(({fileDocument}) => {
          if (this.activeFileDocument === fileDocument) {
            this.updateStatus();
          }
        });

        this.manager.onDocumentError(({fileDocument, error}) => {

          if (!error) {
            vscode.window.showErrorMessage('Unknown Error');
            return;
          }

          let thenable: Thenable<string> = null;
          switch (error.code) {
            case WebstratesErrorCodes.AccessForbidden.code:
              thenable = vscode.window.showErrorMessage(WebstratesErrorCodes.AccessForbidden.errorTemplate(fileDocument.id));
              break;
            case WebstratesErrorCodes.WebstrateNotFound.code:
              thenable = vscode.window.showWarningMessage(WebstratesErrorCodes.WebstrateNotFound.errorTemplate(fileDocument.id));
              break;
            case WebstratesErrorCodes.InternalServerError.code:
              thenable = vscode.window.showErrorMessage(WebstratesErrorCodes.InternalServerError.errorTemplate());
              break;
          }
        });
      }
    }
  }

  /**
   * Initialize editor commands.
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
   */
  private initCommands() {
    const initWorkspaceDisposable = vscode.commands.registerCommand('webstrates.initWorkspace', () => this.initWorkspace());
    const openDisposable = vscode.commands.registerCommand('webstrates.openWebstrate', () => this.openWebstrate());
    const webstratePreviewDisposable = vscode.commands.registerCommand('webstrates.webstratePreview', () => this.webstratePreview());

    this.context.subscriptions.push(initWorkspaceDisposable, openDisposable, webstratePreviewDisposable);
  }

  /**
   * Initialize editor events.
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
   */
  private initEvents() {

    // On extension activate, also try to receive webstrate document of currently opened file document.
    if (vscode.window.activeTextEditor) {
      const document = vscode.window.activeTextEditor.document;
      this.openDocumentWebstrate(document);
    }

    // Open webstrate document of any opened file document.
    const openTextDocumentDisposable = vscode.workspace.onDidOpenTextDocument(this.openDocumentWebstrate);
    const saveDisposable = vscode.workspace.onDidSaveTextDocument((textDocument: vscode.TextDocument) => this.saveWebstrate(textDocument));
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((textDocument: vscode.TextDocument) => this.closeWebstrate(textDocument));

    this.context.subscriptions.push(openTextDocumentDisposable, saveDisposable, closeDisposable);
  }

  /**
   * Initialize preview window.
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
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
   * Initialize output channel and status bar. The output channel is mostly important for developing and debugging
   * the extension, but could be useful at some point to report bugs. It will be hidden by default.
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
   */
  private initOutput() {
    // show 'Webstrates' output channel in UI
    // WebstratesEditor.OutputChannel.show();

    // Show 'Webstrates' status bar item in UI.
    WebstratesEditor.StatusBarItem.show();
  }

  /**
   * Initialize Webstrates workspace. 
   */
  private initWorkspace() {
    Utils.initWorkspace();
  }

  /**
   * 
   * 
   * @private
   * @param {vscode.TextDocument} document
   * @returns
   * 
   * @memberOf WebstratesEditor
   */
  private openDocumentWebstrate(document: vscode.TextDocument) {
    let webstrateId = Utils.getWebstrateIdFromDocument(document);

    if (!webstrateId) {
      return;
    }

    let fileDocument = this.manager.getOpenFileDocument(document);
    if (!fileDocument) {
      console.warn(`webstrate not yet opened ${webstrateId}`);

      this.openWebstrate(webstrateId, document);
    }
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

    const config = Utils.loadWorkspaceConfig();
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
   * Log messages to output channel.
   * 
   * @static
   * @param {string} message The log message.
   * 
   * @memberOf WebstratesEditor
   */
  public static Log(message: string) {
    WebstratesEditor.OutputChannel.appendLine(message);
  }

  /**
   * @param  {string} status
   */
  public static SetStatus(status: string, spin: boolean = true, tooltip: string = null, color: string = null) {

    if (WebstratesEditor.statusBarSpinnerInterval) {
      clearInterval(WebstratesEditor.statusBarSpinnerInterval);
    }

    // if (spin) {
      WebstratesEditor.statusBarSpinnerInterval = setInterval(function () {
        let spinnerFrame = frame();
        WebstratesEditor.StatusBarItem.text = `${spinnerFrame} ${status}`;
      }, 100);
    // }
    // else {
    //   WebstratesEditor.StatusBarItem.text = status;
    // }

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

      const config = Utils.loadWorkspaceConfig();
      // const deleteLocalFile = typeof config.deleteLocalFilesOnClose === "undefined" ? true : config.deleteLocalFilesOnClose;
      const deleteLocalFile = !!config.deleteLocalFilesOnClose;

      this.manager.dispose(deleteLocalFile);
      this.manager = null;
    }
  }
}

export { WebstratesEditor }