import * as vscode from 'vscode';

const path = require('path');
var elegantSpinner = require('elegant-spinner');
var frame = elegantSpinner();

import Logger from '../utils/logger';
import Timer from '../utils/timer';
import WebstratesClient from './webstrates-client';
import FileDocument from './file-document';
import WebstratePreviewDocumentContentProvider from './content-provider';
import { WebstratesErrorCodes } from './error-codes';
import { Utils } from './utils';

export default class WebstratesEditor {

  // Logger to log info, debug, error, and warn messages.
  private static Log: Logger = Logger.getLogger(WebstratesEditor);

  private static StatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
  private static ClientStatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 2);

  private context: vscode.ExtensionContext;
  private client: WebstratesClient;
  private previewUri: vscode.Uri;

  private toggleStatusBarItem: vscode.StatusBarItem;
  private toggleWidState: boolean = false;
  // create a decorator type that we use to decorate large numbers
  private widDecorationType = vscode.window.createTextEditorDecorationType({
    color: 'rgba(0,0,0,0)',
    letterSpacing: '-50px',
  });

  // Reconnect to server timer.
  private reconnectTimer: Timer;

  private static clientStatusTimer: Timer;
  private static statusSpinnerTimer: Timer;

  // Spinner interval -> used in status bar to show a progressing spinner before message.
  private static statusBarSpinnerInterval: any;

  /**
   * @param  {vscode.ExtensionContext} context
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // Configure workspace.
    if (!Utils.isWorkspaceConfigured()) {
      Utils.initWorkspace();
    }

    // Connect to Webstrates server.
    this.connectToServer();

    this.initCommands();
    this.initEvents();
    this.initPreview();
    this.initOutput();

    this.initDecorators(context);
    this.toggleStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.toggleStatusBarItem.command = "webstrates.toggleWid";
    this.toggleStatusBarItem.text = `Hide __wid ${this.toggleWidState ? "Enabled" : "Disabled"}`;
    this.toggleStatusBarItem.color = this.toggleWidState ? "white" : "orange";
    this.toggleStatusBarItem.show();

    // Show a 3 seconds status message that Webstrates editor has sucessfully loaded.
    vscode.window.setStatusBarMessage("Webstrates Editor successfully loaded.", 3000);
  }

  private initDecorators(context) {

    var timeout = null;
    let triggerUpdateDecorations = (activeEditor) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => this.updateDecorations(activeEditor), 500);
    }

    let activeEditor;
    vscode.window.onDidChangeActiveTextEditor(editor => {
      activeEditor = editor;
      if (editor) {
        triggerUpdateDecorations(activeEditor);
      }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations(activeEditor);
      }
    }, null, context.subscriptions);

    this.updateVisibleTextEditors();
  }

  /**
   * Connect to Webstrates server.
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
   */
  private connectToServer() {

    // Stop any previous reconnect timer.
    if (this.reconnectTimer) {
      this.reconnectTimer.stop();
      this.reconnectTimer = null;
    }

    const { serverAddress, reconnect, reconnectTimeout, deleteLocalFilesOnClose } = Utils.loadWorkspaceConfig();

    // Close existing connection to server.
    if (this.client) {
      this.client.dispose(deleteLocalFilesOnClose);
    }

    this.client = new WebstratesClient(serverAddress);

    this.client.onDidConnect(() => {
      WebstratesEditor.Log.debug(`Connected to ${serverAddress}`);
      WebstratesEditor.SetClientStatus(`Connected to ${serverAddress}`);

      // On extension activate, also try to receive webstrate document of currently opened file document.
      if (vscode.window.activeTextEditor) {
        const document = vscode.window.activeTextEditor.document;
        this.openDocumentWebstrate(document);
      }
    });

    this.client.onDidDisconnect(() => {
      WebstratesEditor.Log.debug(`Disconnected from ${serverAddress}`);
      WebstratesEditor.SetClientStatus(`Disconnected from ${serverAddress}`);

      this.client.dispose(deleteLocalFilesOnClose);

      if (reconnect) {
        WebstratesEditor.SetClientStatus(`Reconnecting in...`, reconnectTimeout);

        // Try to reconnect after 10s timeout.
        this.reconnectTimer = new Timer(reconnectTimeout);
        this.reconnectTimer.onElapsed(() => {
          this.connectToServer();
        });
        this.reconnectTimer.start();
      }
    });
  }

  /**
   * Initialize editor commands.
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
   */
  private initCommands() {
    const initWorkspaceDisposable = vscode.commands.registerCommand('webstrates.initWorkspace', () => Utils.initWorkspace());
    const toggleWidDisposable = vscode.commands.registerCommand('webstrates.toggleWid', () => this.toggleWid());
    const webstratePreviewDisposable = vscode.commands.registerCommand('webstrates.webstratePreview', () => this.webstratePreview());

    this.context.subscriptions.push(initWorkspaceDisposable, toggleWidDisposable, webstratePreviewDisposable);
  }

  /**
   * Initialize editor events.
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
   */
  private initEvents() {

    // // On extension activate, also try to receive webstrate document of currently opened file document.
    // if (vscode.window.activeTextEditor) {
    //   const document = vscode.window.activeTextEditor.document;
    //   this.openDocumentWebstrate(document);
    // }

    // Open webstrate document of any opened file document.
    // const openTextDocumentDisposable = vscode.workspace.onDidOpenTextDocument((textDocument: vscode.TextDocument) => {
    //   this.openDocumentWebstrate(textDocument);
    // });
    const openTextDocumentDisposable = vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor) => {
      this.openDocumentWebstrate(editor.document);
    });
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

    const changeTextDocumentDisposable = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
      if (e.document === vscode.window.activeTextEditor.document) {
        provider.update(this.previewUri);
      }
    });

    const changeActiveTextEditorDisposable = vscode.window.onDidChangeActiveTextEditor((textEditor: vscode.TextEditor) => {
      provider.update(this.previewUri);
    });

    this.context.subscriptions.push(registration, changeTextDocumentDisposable, changeActiveTextEditorDisposable);
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
    WebstratesEditor.ClientStatusBarItem.show();
  }

  /**
   * 
   * 
   * @private
   * 
   * @memberOf WebstratesEditor
   */
  private toggleWid() {
    this.toggleWidState = !this.toggleWidState;
    this.toggleStatusBarItem.text = `Hide __wid ${this.toggleWidState ? "Enabled" : "Disabled"}`;
    this.toggleStatusBarItem.color = this.toggleWidState ? "white" : "orange";

    this.updateVisibleTextEditors();
  }

  /**
   * 
   * 
   * @private
   * @param {vscode.TextEditor} textEditor
   * 
   * @memberOf WebstratesEditor
   */
  private updateVisibleTextEditors() {

    vscode.window.visibleTextEditors.forEach((textEditor: vscode.TextEditor) => {
      this.updateDecorations(textEditor);
    });
  }

  /**
   * 
   * 
   * @private
   * @param {vscode.TextEditor} textEditor
   * 
   * @memberOf WebstratesEditor
   */
  private updateDecorations(textEditor: vscode.TextEditor) {
    if (this.toggleWidState) {
      var regEx = / __wid="[\w- ]*"/g;
      var text = textEditor.document.getText();
      var largeNumbers: vscode.DecorationOptions[] = [];
      var match;
      while (match = regEx.exec(text)) {
        var startPos = textEditor.document.positionAt(match.index);
        var endPos = textEditor.document.positionAt(match.index + match[0].length);
        var decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: match[0] };
        largeNumbers.push(decoration);
      }

      textEditor.setDecorations(this.widDecorationType, largeNumbers);
    }
    else {
      textEditor.setDecorations(this.widDecorationType, []);
    }
  }

  private onFileDocumentConnect: any;
  private onFileDocumentDisconnect: any;
  private onFileDocumentNew: any;
  private onFileDocumentUpdate: any;
  private onFileDocumentUpdateOp: any;
  private onFileDocumentError: any;

  /**
   * 
   * 
   * @private
   * @param {vscode.TextDocument} document
   * @returns
   * 
   * @memberOf WebstratesEditor
   */
  private openDocumentWebstrate(textDocument: vscode.TextDocument) {

    // Ignore workspace config.
    if (Utils.isIgnoreDocument(textDocument)) {
      WebstratesEditor.Log.debug(`Text document ${textDocument.fileName} is ignored due to set ignore path.`);
      return;
    }

    if (this.onFileDocumentConnect) {
      try {
        this.onFileDocumentConnect.dispose();
      }
      catch (error) {
        WebstratesEditor.Log.error(`Could not dispose file document connect event listener.`, error);
      }
    }

    if (this.onFileDocumentDisconnect) {
      try {
        this.onFileDocumentDisconnect.dispose();
      }
      catch (error) {
        WebstratesEditor.Log.error(`Could not dispose file document disconnect event listener.`, error);
      }
    }

    if (this.onFileDocumentNew) {
      try {
        this.onFileDocumentNew.dispose();
      }
      catch (error) {
        WebstratesEditor.Log.error(`Could not dispose file document new event listener.`, error);
      }
    }

    if (this.onFileDocumentUpdate) {
      try {
        this.onFileDocumentUpdate.dispose();
      }
      catch (error) {
        WebstratesEditor.Log.error(`Could not dispose file document update event listener.`, error);
      }
    }

    if (this.onFileDocumentUpdateOp) {
      try {
        this.onFileDocumentUpdateOp.dispose();
      }
      catch (error) {
        WebstratesEditor.Log.error(`Could not dispose file document update op event listener.`, error);
      }
    }

    if (this.onFileDocumentError) {
      try {
        this.onFileDocumentError.dispose();
      }
      catch (error) {
        WebstratesEditor.Log.error(`Could not dispose file document error event listener.`, error);
      }
    }

    // TODO on data events to show active data transmission.

    // Get webstrate file document, which relates to the text document.
    const fileDocument = this.client.getFileDocument(textDocument);
    this.onFileDocumentConnect = fileDocument.onDidConnect(() => {
      WebstratesEditor.SetStatus('Sync', 1000); // Placeholder message
    });

    this.onFileDocumentDisconnect = fileDocument.onDidDisconnect(() => {
      WebstratesEditor.SetStatus('Sync', -1); // Placeholder message
    });

    this.onFileDocumentNew = fileDocument.onNew(() => {
      vscode.window.showWarningMessage(WebstratesErrorCodes.WebstrateNotFound.errorTemplate(fileDocument.id));
    });

    this.onFileDocumentUpdate = fileDocument.onUpdate(() => {
      WebstratesEditor.SetStatus('Sync', 3000);
    });

    this.onFileDocumentUpdateOp = fileDocument.onUpdateOp(() => {
      WebstratesEditor.SetStatus('Sync', 3000);
    });

    this.onFileDocumentError = fileDocument.onError(error => {
      WebstratesEditor.SetStatus('Error'); // Placeholder message

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

  /**
   * Closes the webstrate associated with the text document.
   * 
   * @private
   * @param {vscode.TextDocument} textDocument
   * 
   * @memberOf WebstratesEditor
   */
  private closeWebstrate(textDocument: vscode.TextDocument) {
    
    // Ignore workspace config.
    if (Utils.isIgnoreDocument(textDocument)) {
      WebstratesEditor.Log.debug(`Text document ${textDocument.fileName} is ignored due to set ignore path.`);
      return;
    }

    const config = Utils.loadWorkspaceConfig();
    // const deleteLocalFile = typeof config.deleteLocalFilesOnClose === "undefined" ? true : config.deleteLocalFilesOnClose;
    const deleteLocalFile = !!config.deleteLocalFilesOnClose;

    this.client.closeWebstrate(textDocument, deleteLocalFile);
  }

  /**
   * Shows Webstrates webstrate preview.
   */
  private webstratePreview() {
    // let uri = vscode.window.activeTextEditor.document.uri;
    let uri = this.previewUri;
    WebstratesEditor.Log.debug(`Preview uri ${uri}`);

    return vscode.commands.executeCommand('vscode.previewHtml', uri, vscode.ViewColumn.Two, `Webstrate Preview`)
      .then(success => {
        WebstratesEditor.Log.debug(`Preview opened succesfully.`);
      }, (reason) => {
        vscode.window.showErrorMessage(reason);
      });
  }

  /**
   * Saves the webstrate associated with the text document.
   */
  private saveWebstrate(textDocument) {

    // Ignore workspace config.
    if (Utils.isWorkspaceConfig(textDocument)) {
      this.connectToServer();
    }
    else {
      // Ignore workspace config.
      if (Utils.isIgnoreDocument(textDocument)) {
        WebstratesEditor.Log.debug(`Text document ${textDocument.fileName} is ignored due to set ignore path.`);
        return;
      }
    
      this.client.saveWebstrate(textDocument);
    }
  }

  /**
   * 
   */
  private webstrateIdInput(): Thenable<string> {
    let workspacePath = vscode.workspace.rootPath;
    return vscode.window.showInputBox({ prompt: 'webstrate id' });
  }

  /**
   * tbd.
   * 
   * @static
   * @param {string} status
   * 
   * @memberOf WebstratesEditor
   */
  public static SetClientStatus(status: string, countdownTime: number = 0) {
    const item = WebstratesEditor.ClientStatusBarItem;

    // Stop any running timer.
    if (WebstratesEditor.clientStatusTimer) {
      WebstratesEditor.clientStatusTimer.dispose();
      WebstratesEditor.clientStatusTimer = undefined;
    }

    const timer = WebstratesEditor.clientStatusTimer = new Timer(countdownTime);

    if (!countdownTime) {
      timer.onElapsed(() => {
        item.text = status;
      });
    }

    if (countdownTime > 0) {
      timer.onTick(({duration}) => {
        item.text = `${status} ${((duration / 1000) + 1)}s`;
      });
    }

    timer.start();
  }

  public static SetStatus(status: string, spinTimeout: number = 0, tooltip: string = null, color: string = null) {
    const item = WebstratesEditor.StatusBarItem;

    // Stop any running timer.
    if (WebstratesEditor.statusSpinnerTimer) {
      WebstratesEditor.statusSpinnerTimer.dispose();
      WebstratesEditor.statusSpinnerTimer = undefined;
    }

    const spinnerTimer = WebstratesEditor.statusSpinnerTimer = new Timer(spinTimeout, 100);

    spinnerTimer.onTick(() => {
      item.text = `${frame()} ${status}`;
    });

    spinnerTimer.onElapsed(() => {
      item.text = status;
    });

    spinnerTimer.start();

    // if (tooltip) {
    //   WebstratesEditor.StatusBarItem.tooltip = tooltip;
    // }

    // if (color) {
    //   WebstratesEditor.StatusBarItem.color = color;
    // }
  }

  /**
   * 
   */
  public dispose() {
    if (this.client) {

      const config = Utils.loadWorkspaceConfig();
      // const deleteLocalFile = typeof config.deleteLocalFilesOnClose === "undefined" ? true : config.deleteLocalFilesOnClose;
      const deleteLocalFile = !!config.deleteLocalFilesOnClose;

      this.client.dispose(deleteLocalFile);
      this.client = null;
    }
  }
}
