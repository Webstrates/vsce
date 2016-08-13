'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WebstrateFileManager } from './webstrate-file-manager';
import { WebstrateFile } from './webstrate-file';
import { WebstrateFileUtils } from './webstrate-file.utils';

let fs = require('fs');
let path = require('path');

let cheerio = require('cheerio');

let workspacePath;
let serverAddress;
let fileManager: WebstrateFileManager;
let previewUri;

function webstrateIdInput() {
    return vscode.window.showInputBox({ prompt: 'webstrate id' })
        .then(webstrateId => {

            // webstrateId will be 'undefined' on cancel input
            if (!webstrateId) {
                return;
            }

            fileManager.requestWebstrate(webstrateId, workspacePath);
        });
}

function webstrateServerHostNameInput() {
    return new Promise(() => {
        serverAddress = 'webstrates.romanraedle.com';

        if (fileManager) {
            fileManager.dispose();
        }
        fileManager = new WebstrateFileManager(serverAddress);
    });

    // return vscode.window.showInputBox({ prompt: 'Webstrates Server Host Address' })
    //     .then(host => {
    //         hostAddress = host;

    //         if (fileManager) {
    //             fileManager.dispose();
    //         }
    //         fileManager = new WebstrateFileManager(host);
    //     });
}

/**
 * Init Webstrates workspace.
 */
const initWorkspace = function () {
    WebstrateFileUtils.initWorkspace();
}

/**
 * Open Webstrates webstrate.
 */
const openWebstrate = function () {

    if (!workspacePath) {
        vscode.window.showInformationMessage('Open workspace first.');
        return;
    }

    if (!serverAddress) {
        webstrateServerHostNameInput().then(webstrateIdInput);
    }
    else {
        webstrateIdInput();
    }
}

/**
 * Shows Webstrates webstrate preview.
 */
const showWebstratePreview = function () {
    // let uri = vscode.window.activeTextEditor.document.uri;
    let uri = previewUri;
    WebstrateFileManager.Log('Preview Uri ' + uri);

    let textDocument = vscode.window.activeTextEditor.document;

    let webstrateFile = fileManager.getWebstrateFile(textDocument);
    let webstrateId = webstrateFile.webstrateId;

    return vscode.commands.executeCommand('vscode.previewHtml', uri, vscode.ViewColumn.Two, `${webstrateId} Preview`).then((success) => {
    }, (reason) => {
        vscode.window.showErrorMessage(reason);
    });
}

/**
 * Saves the webstrate associated with the text document.
 */
const saveWebstrate = function (textDocument) {

    const workspacePath = vscode.workspace.rootPath;
    const webstratesConfigFile = path.join(workspacePath, '.webstrates', 'config.json');

    if (textDocument.fileName === webstratesConfigFile) {
        initFileManager();
    }
    else {
        // vscode.window.showInformationMessage('save text doc');
        fileManager.saveWebstrate(textDocument);
    }
}

/**
 * Closes the webstrate associated with the text document.
 */
const closeWebstrate = function (textDocument) {
    // vscode.window.showInformationMessage('close text doc');
    fileManager.closeWebstrate(textDocument);

    console.log(textDocument);
}

const initFileManager = function () {
    const workspacePath = vscode.workspace.rootPath;
    const config = WebstrateFileUtils.loadWorkspaceConfig(workspacePath);

    console.log(config);

    serverAddress = config.serverAddress;
    console.log('config: ' + serverAddress);
    if (serverAddress) {
        fileManager = new WebstrateFileManager(serverAddress);
    }
}

class WebstratePreviewDocumentContentProvider implements vscode.TextDocumentContentProvider {

    /**
     * Reset preview browser style to match Webkit default style.
     */
    private resetStyle: string = `
        <style type="text/css">
        body {
            background: rgb(255, 255, 255) none repeat scroll 0% 0% / auto padding-box border-box;
            color: rgb(0, 0, 0);

            font-family: -webkit-standard;
            font-weight: normal;
            font-style: normal;
            font-size: 16px;

            margin: 8px;
            padding: 0px;
        }
        </style>
    `;

    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

    public provideTextDocumentContent(uri: vscode.Uri): string {
        return this.createCssSnippet();
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
    }

    private createCssSnippet() {
        let editor = vscode.window.activeTextEditor;
        if (!(editor.document.languageId === 'html')) {
            return this.errorSnippet("Active editor doesn't show a HTML document - no properties to preview.")
        }
        return this.extractSnippet();
    }

    private extractSnippet(): string {
        let editor = vscode.window.activeTextEditor;
        let text = editor.document.getText();
        return this.snippet(editor.document);
    }

    private errorSnippet(error: string): string {
        return `
                <body>
                    ${error}
                </body>`;
    }

    private snippet(document: vscode.TextDocument): string {
        const text = document.getText();

        // return text;

        let $ = cheerio.load(text);

        // WebstrateFileManager.Log($.html());

        let $head = $('head');
        if (!$head.length) {
            $head = $('<head></head>');
            $('html').prepend($head);
        }

        $head.prepend(this.resetStyle);

        WebstrateFileManager.Log($head);

        return $.html();
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // console.log(context.storagePath);

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "webstrates-file" is now active!');

    workspacePath = vscode.workspace.rootPath;

    // initialize Webstrates webstrate file manager
    initFileManager();

    previewUri = vscode.Uri.parse('webstrate-preview://authority/webstrate-preview');
    let provider = new WebstratePreviewDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('webstrate-preview', provider);
    context.subscriptions.push(registration);

    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        if (e.document === vscode.window.activeTextEditor.document) {
            provider.update(previewUri);
        }
    });

    const initWorkspaceDisposable = vscode.commands.registerCommand('webstrates.initWorkspace', initWorkspace);
    context.subscriptions.push(initWorkspaceDisposable);

    const openDisposable = vscode.commands.registerCommand('webstrates.openWebstrate', openWebstrate);
    context.subscriptions.push(openDisposable);

    const showWebstratePreviewDisposable = vscode.commands.registerCommand('webstrates.showWebstratePreview', showWebstratePreview);
    context.subscriptions.push(showWebstratePreviewDisposable);

    const saveDisposable = vscode.workspace.onDidSaveTextDocument(saveWebstrate);
    context.subscriptions.push(saveDisposable);

    const closeDisposable = vscode.workspace.onDidCloseTextDocument(closeWebstrate);
    context.subscriptions.push(saveDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('deactivate');
    if (fileManager) {
        fileManager.dispose();
    }
}