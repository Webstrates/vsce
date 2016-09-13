# Webstrates Editor

## Features

The Webstrates Editor allows synchronized editing of webstrates in Visual Studio Code (vscode).

-----------------------------------------------------------------------------------------------------------

## Working with Webstrates Editor

**Note:** You can author your Webstrates using Visual Studio Code.  Here are some useful editor keyboard shortcuts:

* Initialize Webstrate Editor workspace
  1. Open or create workspace folder
  2. Open command palette (`cmd+shift+p` on OSX or `ctrl+shift+o` on Windows and Linux)
  3. Search for `Init Webstrates Workspace` and hit enter
  4. Change `"serverAddress"` property in `config.json` to match your Webstrates' server address
* Open Webstrate (`cmd+alt+o` on OSX or `ctrl+alt+o` on Windows and Linux)
* Save Webstrate (`cmd+s` on OSX or `ctrl+s` on Windows and Linux)
* Webstate Preview (`cmd+alt+p` on OSX or `ctrl+alt+p` on Windows and Linux) 

## Webstrate ids ending with .js and .css

Each webstrate id that ends with .js or .css will be treated different than the other webstrate ids. Instead of loading all
the webstrate's content, for .js and .css webstrates only content defined in pre#webstrate element is loaded and changes
to the content are written back to that exact element. The Webstrates Editor creates all the necessary scaffolding if
.js or .css webstrate id does not exist.

Example of scaffolding containing JavaScript (external-script.js):
```html
<html>
  <body>
    <pre id="webstrate">
      // JavaScript content
      console.log("Hello external webstrate!");
    </pre>
  </body>
</html>
```

Example of scaffolding containing CSS (external-style.css):
```html
<html>
  <body>
    <pre id="webstrate">
      // CSS content
      body {
        background: deeppink;
      }
    </pre>
  </body>
</html>
```

This allows to define JavaScript and CSS in external webstrates, which then can
be loaded with help of the Webstrates external library.

```html
<html>
  <head>
    <!-- Bootstrap Loader - Library to load external JavaScript/CSS defined in a webstrate -->
    <script type="text/javascript" src="https://rawgit.com/Webstrates/common-libs/dev/build/external-webstrates.js"></script>

    <!-- Content defined in pre#webstrate is loaded via external webstrate library and
    executed afterwards in the exact order in which the wscript/wlink tags are defined -->
    <wscript type="webstrate/javascript" src="/external-script.js"></wscript>
    <wlink type="webstrate/css" src="/external-style.css"></wlink>
  </head>
  <body>
    ...
  </body>
</html>
```

### For more information

* [Webstrates Common Libs](https://github.com/Webstrates/common-libs)
* [Webstrates](http://www.webstrates.net)

**Enjoy!**