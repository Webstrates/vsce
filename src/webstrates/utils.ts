const fs = require('fs');
const path = require('path');
const JSONC = require('json-comments');

import * as vscode from 'vscode';
import PathUtils from '../utils/path-utils';

const initialConfiguration = `{
    // DNS or IP address to connect to Webstrates server.
    "serverAddress": "ws://webstrate.cs.au.dk",

    "reconnect": true,

    "reconnectTimeout": 10000,

    "deleteLocalFilesOnClose": false

    // In future, further configuration options will be added to this
    // config.json. For example, authentication user/password, connection
    // timeout, or SSL enable/disabled.
}`;

const Utils = {

  webstratesConfigPath: '.webstrates',
  webstratesConfigFileName: 'config.json',

  /**
   * Init Webstrates workspace.
   */
  initWorkspace() {
    const configFile = this.createDefaultWorkspaceConfig();

    // open configuration immediately to give any kind of user feedback on
    // the init workspace command
    vscode.workspace.openTextDocument(configFile).then(doc => {
      vscode.window.showTextDocument(doc);
    });
  },

  isWorkspaceConfig(textDocument: vscode.TextDocument) {
    const workspacePath = vscode.workspace.rootPath;
    const webstratesConfigFile = path.join(workspacePath, Utils.webstratesConfigPath, Utils.webstratesConfigFileName);

    return (textDocument.fileName === webstratesConfigFile);
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
   * 
   * @returns {boolean}
   */
  isWorkspaceConfigured(): boolean {
    const workspacePath = vscode.workspace.rootPath;

    if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace open.');
      return false;
    }

    const webstratesConfigPathAbsolute = path.join(workspacePath, this.webstratesConfigPath);
    let exists = fs.existsSync(webstratesConfigPathAbsolute);
    if (!exists) {
      return false;
    }

    const webstratesConfigFileAbsolute = path.join(webstratesConfigPathAbsolute, this.webstratesConfigFileName);
    return fs.existsSync(webstratesConfigFileAbsolute);
  },

  /**
   * 
   */
  createDefaultWorkspaceConfig() {
    const workspacePath = vscode.workspace.rootPath;

    if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace open.');
      return;
    }

    const webstratesConfigPathAbsolute = path.join(workspacePath, this.webstratesConfigPath);
    let exists = fs.existsSync(webstratesConfigPathAbsolute);
    if (!exists) {
      fs.mkdirSync(webstratesConfigPathAbsolute);
    }

    const webstratesConfigFileAbsolute = path.join(webstratesConfigPathAbsolute, this.webstratesConfigFileName);
    fs.writeFileSync(webstratesConfigFileAbsolute, initialConfiguration);

    return webstratesConfigFileAbsolute;
  },

  getWebstrateIdFromDocument(document: vscode.TextDocument) {
    // Quick check for .webstrates configuration folder in workspace. This is not optimal
    // since it could also be a webstrateId or it could be a subfolder.
    // Ignore if it is the .webstrates configuration folder.
    if (document.fileName.lastIndexOf('.webstrates') > -1) {
      return null;
    }

    // Check if text document if part (not part) of workspace. For example, user workspace settings.json
    // will not result in loading it as a webstrate.
    const rootPath = vscode.workspace.rootPath;
    if (!PathUtils.isInHierarchy(rootPath, document.fileName)) {
      return null;
    }

    return path.posix.basename(document.fileName);
  }
}

export { Utils }