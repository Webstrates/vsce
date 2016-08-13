const fs = require('fs');
const path = require('path');
const JSONC = require('json-comments');

import * as vscode from 'vscode';

const initialConfiguration = `{
    // DNS or IP address to connect to Webstrates server.
    "webstrates.serverAddress": "webstrates.romanraedle.com"

    // In future, further configuration options will be added to this
    // config.json. For example, authentication user/password, connection
    // timeout, or SSL enable/disabled.
}`;

const WebstrateFileUtils = {

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

  loadWorkspaceConfig(rootPath) {
    const webstratesConfigFileAbsolute = path.join(rootPath, this.webstratesConfigPath, this.webstratesConfigFileName);
    let rawConfig = fs.readFileSync(webstratesConfigFileAbsolute, 'utf8');

    console.log('banananana');
    console.log(rawConfig);

    return JSONC.parse(rawConfig);

    // return require(webstratesConfigFileAbsolute);
  },

  /**
   * 
   */
  checkWorkspaceConfiguration(rootPath: string) {
    console.log('check workspace config');

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

export { WebstrateFileUtils }