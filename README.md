# Webstrates Editor

**NOTE: The explicit command to open a webstrate (<kbd>cmd</kbd>+<kbd>alt</kbd>+<kbd>o</kbd> on OSX or <kbd>ctrl</kbd>+<kbd>alt</kbd>+<kbd>o</kbd> on Windows and Linux) has been removed as the extension uses filenames to derive the webstrate id. Add files in the filesystem to link them to a particular webstrate. The file's name defines the webstrate id.**

## Features

The Webstrates Editor allows synchronized editing of webstrates in Visual Studio Code (vscode).

## Release Notes

This release fixes an issue with the extension creating an additional .git file for each webstrate that is opened.

---

## Working with Webstrates Editor

**Note:** You can author your Webstrates using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Initialize Webstrate Editor workspace
  1. Open or create workspace folder
  2. Open command palette (`cmd+shift+p` on OSX or `ctrl+shift+p` on Windows and Linux)
  3. Search for `Init Webstrates Workspace` and hit enter
  4. Change `"serverAddress"` property in `config.json` to match your Webstrates' server address
* To open a webstrate add a new file in Visual Studio Code or open an existing file (__Please read the attention box below!__). The filename will be used as webstrate id. It is possible to make use of the hierarchical file system to structure webstrates in folders as the extension ignores folders and only uses the actual filename as webstrate id.
* Save Webstrate (`cmd+s` on OSX or `ctrl+s` on Windows and Linux)
* Webstate Preview (`cmd+alt+p` on OSX or `ctrl+alt+p` on Windows and Linux)

>__Attention:__ A file's content will be overwritten with the content of an associated webstrate.

## Convenient mode for selectively editing webstrate content
The extension also allows to selectively edit contents of a particular DOM element within a webstrate, e.g., to edit an inline script and only synchronize its content without the surrounding HTML. To do that, append a `#` character plus the `id` of the inline script element to the webstrate id. For example, use the filename `my-webstrate#inline-script` to selectively edit the content of `<script id="inline-script">...</script>` within the `my-webstrate` webstrate. This works for stylesheets, too (`<style id="inline-style">...</style>`). We will soon support editing of arbitrary subtrees of a webstrate document (e.g., editing the subtree of a `<div id="edit-subtree">...</div>`). For convenience, append a `.js` or `.css` at the end of the filename to leverage the editor's native JavaScript or CSS support.

>__Attention:__ File extensions after the `#` character will not be part of the id. (This might change in future versions of the extension!)

>__Attention:__ The Webstrates Editor creates all the necessary scaffolding for an external webstrate if an element with a given element id does not exist in the document. It will append a `pre#id` element to the document body.

Example of scaffolding for a webstrate document `my-webstrate` (filename: `my-webstrate#loop10.js`):

```html
<html>
  <body>
    <pre id="loop10">
      for (var i = 0; i < 10; i++) {
          console.log('Loop i=%i', i);
      }
    </pre>
  </body>
</html>
```

Opening the same webstrate document with a different selector will append another scaffolding to the webstrate. For example, `my-webstrate#basic.css`:

```html
<html>
  <body>
    <pre id="loop10">
      for (var i = 0; i < 10; i++) {
          console.log('Loop i=%i', i);
      }
    </pre>
    <pre id="basic">
      body {
        background: deepskyblue;
      }
    </pre>
  </body>
</html>
```

## External Webstrates

The selective editing allows defining JavaScript and CSS in `external webstrates`, which then can be loaded with the help of the `external-webstrates.js` library as shown in the example below.

```html
<html>
  <head>
    <!-- Bootstrap Loader - Library to load external JavaScript/CSS defined in a webstrate -->
    <script type="text/javascript" src="https://rawgit.com/Webstrates/common-libs/master/build/external-webstrates.js"></script>

    <!-- Content defined in 'selector' is loaded via external webstrate library and executed afterwards in the exact order in which the script/link tags are defined -->
    <script type="webstrate/javascript" src="/my-webstrate" selector="#loop10"></script>
    <link type="webstrate/css" href="/my-webstrate" selector="#basic" />
  </head>
  <body>
    ...
  </body>
</html>
```

As shown in the example above, this webstrate will load the webstrate `my-webstrate`, receive the contents of the element with selector `#loop10` and selector `#basic`, and execute their contents according to the set `type`. For example, the `script[type="webstrate/javascript"]` will be executed as JavaScript and the `link[type="webstrate/css"]` will be executed as CSS style.

### For more information

* [Webstrates Common Libs](https://github.com/Webstrates/common-libs)
* [Webstrates](http://www.webstrates.net)

**Enjoy!**