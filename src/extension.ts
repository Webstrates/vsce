'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WebstratesEditor } from './webstrates/editor';

let editor: WebstratesEditor;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "webstrates-editor" is now active!');

    editor = new WebstratesEditor(context);
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('Extension "webstrates-editor" deactivated.');

    if (editor) {
        editor.dispose();
        editor = null;
    }
}