'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WebstrateFileManager } from './webstrate-file-manager';
import { WebstrateFile } from './webstrate-file';

let path = require('path');

let workspacePath;
let hostAddress;
let fileManager: WebstrateFileManager;

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
    return vscode.window.showInputBox({ prompt: 'Webstrates Server Host Address' })
        .then(host => {
            hostAddress = host;
            
            if (fileManager) {
                fileManager.dispose();
            }
            fileManager = new WebstrateFileManager(host);
        });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "webstrates" is now active!');

    workspacePath = vscode.workspace.rootPath;

    const config = vscode.workspace.getConfiguration('webstrates');
    hostAddress = config.get('hostAddress');
    if (hostAddress) {
        fileManager = new WebstrateFileManager(hostAddress);
    }

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const openDisposable = vscode.commands.registerCommand('extension.openWebstrate', () => {

        if (!workspacePath) {
            vscode.window.showInformationMessage('Open workspace first.');
            return;
        }

        if (!hostAddress) {
            webstrateServerHostNameInput().then(webstrateIdInput);
        }
        else {
            webstrateIdInput();
        }
    });
    context.subscriptions.push(openDisposable);

    const setHostAddressDisposable = vscode.commands.registerCommand('extension.setWebstratesHostAddress', webstrateServerHostNameInput);
    context.subscriptions.push(setHostAddressDisposable);

    const saveDisposable = vscode.workspace.onDidSaveTextDocument(textDocument => {
        fileManager.saveWebstrate(textDocument);
    });
    context.subscriptions.push(saveDisposable);

    const closeDisposable = vscode.workspace.onDidCloseTextDocument(textDocument => {
        fileManager.closeWebstrate(textDocument);
    });
    context.subscriptions.push(saveDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (fileManager) {
        fileManager.dispose();
    }
}