const fs = require('fs');
const path = require('path');
const JSONC = require('json-comments');

import * as vscode from 'vscode';
import PathUtils from '../utils/path-utils';

const initialConfiguration = `{
    // DNS or IP address to connect to Webstrates server.
    "serverAddress": "ws://localhost:7007",

    "reconnect": true,
    "reconnectTimeout": 10000,

    "deleteLocalFilesOnClose": false,

    "ignorePaths": [
        ".vscode",
        ".webstrates",
        ".gitignore"
    ],

    "ignoreFiles": [
        "*.git"
    ]

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
    const config = JSONC.parse(rawConfig);

    if (!config.ignorePaths) {
      config.ignorePaths = [];
    }

    if (config.ignorePaths.indexOf(".webstrates") < 0) {
      config.ignorePaths.push(".webstrates");
    }

    return config;
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

  isIgnoreDocument(document: vscode.TextDocument) {
    const config = Utils.loadWorkspaceConfig();

    let relativeDocumentPath = vscode.workspace.asRelativePath(document.uri);

    relativeDocumentPath = path.normalize(relativeDocumentPath);

    if (config.ignorePaths && Array.isArray(config.ignorePaths)) {
      const { ignorePaths } = config;
      const len = ignorePaths.length;
      for (let i = 0; i < len; i++) {
        const ignorePath = path.normalize(ignorePaths[i]);

        // Check if file paths match.
        if (relativeDocumentPath === ignorePath) {
          return true;
        }

        // Check if document is part of ignore path hierarchy.
        if (PathUtils.isInHierarchy(ignorePath, relativeDocumentPath)) {
          return true;
        }
      }
    }

    // Check if text document if part (not part) of workspace. For example, user workspace settings.json
    // will not result in loading it as a webstrate.
    const rootPath = vscode.workspace.rootPath;
    if (!PathUtils.isInHierarchy(rootPath, document.fileName)) {
      return true;
    }

    if (config.ignoreFiles && Array.isArray(config.ignoreFiles)) {

      let ignore = config.ignoreFiles.some((ignoreFile) => {
        return document.fileName.endsWith(ignoreFile);
      });

      if (ignore) {
        return true;
      }
    }

    return false;
  },

  getWebstrateMetadataFromDocument(document: vscode.TextDocument) {

    // Fixes #5
    // path.posix.basename only works on Mac OS and not on Windows as reported in Node.js documentation
    // On POSIX and Windows https://nodejs.org/api/path.html#path_path_posix
    const data = path.basename(document.fileName);
    
    const splitData = data.split('#');
    const webstrateId = splitData[0];

    let contentId = null;
    if (splitData.length > 1) {
      const contentData = splitData[1];
      
      if (contentData.lastIndexOf('.') > -1) {
        contentId = contentData.substr(0, contentData.lastIndexOf('.'));
      }
      else {
        contentId = contentData;
      }
    }

    return {
      webstrateId: splitData[0],
      contentId: contentId
    };
  }
}

export { Utils }