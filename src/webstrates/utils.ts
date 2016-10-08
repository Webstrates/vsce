const fs = require('fs');
const path = require('path');
const JSONC = require('json-comments');

import * as vscode from 'vscode';

const initialConfiguration = `{
    // DNS or IP address to connect to Webstrates server.
    "serverAddress": "ws://localhost:7007",

    "reconnect": true,

    "reconnectTimeout": 10000,

    "deleteLocalFilesOnClose": false

    // In future, further configuration options will be added to this
    // config.json. For example, authentication user/password, connection
    // timeout, or SSL enable/disabled.
}`;

const WebstratesEditorUtils = {

  webstratesConfigPath: '.webstrates',
  webstratesConfigFileName: 'config.json',

  /**
   * Init Webstrates workspace.
   */
  initWorkspace() {
    const workspacePath = vscode.workspace.rootPath;

    if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace open.');
      return;
    }

    const configFile = this.checkWorkspaceConfiguration(workspacePath);

    // open configuration immediately to give any kind of user feedback on
    // the init workspace command
    vscode.workspace.openTextDocument(configFile).then(doc => {
      vscode.window.showTextDocument(doc);
    });
  },

  loadWorkspaceConfig() {
    const rootPath = vscode.workspace.rootPath;
    const webstratesConfigFileAbsolute = path.join(rootPath, this.webstratesConfigPath, this.webstratesConfigFileName);

    let exists = fs.existsSync(webstratesConfigFileAbsolute);
    if (!exists) {
      return null;
    }

    let rawConfig = fs.readFileSync(webstratesConfigFileAbsolute, 'utf8');
    return JSONC.parse(rawConfig);
  },

  /**
   * 
   */
  checkWorkspaceConfiguration(rootPath: string) {
    // console.log('check workspace config ' + rootPath);

    const webstratesConfigPathAbsolute = path.join(rootPath, this.webstratesConfigPath);
    let exists = fs.existsSync(webstratesConfigPathAbsolute);
    if (!exists) {
      fs.mkdirSync(webstratesConfigPathAbsolute);
    }

    const webstratesConfigFileAbsolute = path.join(webstratesConfigPathAbsolute, this.webstratesConfigFileName);
    exists = fs.existsSync(webstratesConfigFileAbsolute);
    if (!exists) {
      fs.writeFileSync(webstratesConfigFileAbsolute, initialConfiguration);
    }

    return webstratesConfigFileAbsolute;
  }
}

export { WebstratesEditorUtils }