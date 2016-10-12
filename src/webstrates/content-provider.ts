import * as vscode from 'vscode';

const cheerio = require('cheerio');

export default class WebstratePreviewDocumentContentProvider implements vscode.TextDocumentContentProvider {

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

            box-sizing: content-box;
            box-shadow: none;
            border: 0px none rgb(0, 0, 0);
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
        return this.prepareDocument(editor.document);
    }

    private errorSnippet(error: string): string {
        return `
                <body>
                    ${error}
                </body>`;
    }

    private prepareDocument(document: vscode.TextDocument): string {
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

        return $.html();
    }
}
