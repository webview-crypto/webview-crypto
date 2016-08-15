# webview-crypto

[![Build Status](https://travis-ci.org/saulshanabrook/webview-crypto.svg?branch=master)](https://travis-ci.org/saulshanabrook/webview-crypto)
[![npm](https://img.shields.io/npm/v/webview-crypto.svg?maxAge=2592000?style=flat-square)](https://www.npmjs.com/package/webview-crypto)
[![Dependency Status](https://dependencyci.com/github/saulshanabrook/webview-crypto/badge)](https://dependencyci.com/github/saulshanabrook/webview-crypto)

![Build Status](https://saucelabs.com/browser-matrix/sshanabrook.svg)

Helper tools to polyfill the [Web Cryptography API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
by using a webview.

This is used in
[`react-native-webview-crypto`](https://github.com/saulshanabrook/react-native-webview-crypto)
and
[`nativescript-webview-crypto`](https://github.com/saulshanabrook/nativescript-webview-crypto).

## Usage

In your main thread:

```javascript
import {MainWorker} from 'webview-crypto'

// sendToWebView is a function which is called with a string to send
// to the webview
var mw = new MainWorker(sendToWebView) // optional second argument for debug on or off

// mw.onWebViewMessage should be called whenever you get a message
// from the webview


mw.crypto.subtle.generateKey(...)
```


In the webview:

```javascript
import {WebViewWorkerSource} from 'webview-crypto'

// WebViewWorkerSource contains the JS source defining a `WebViewWorker.default`
// should be instatiated like this:
var wvw = new WebViewWorker.default(sendToMain)
// wvw.onMainMessage should be called whenever there is a message from the main.
```



## Caveats

### `getRandomValues`

Since this uses an asynchronous bridge to execute the crypto logic it
can't quite execute `crypto.getRandomValues` correctly, because that method
returns a value synchronously. It is simply *impossible* (as far as I know,
please let me know if there any ways to get around this) to wait for the
bridge to respond asynchronously before returning a value.

Instead, we return you a promise that resolves to a `TypedArray`.
We also accept these promises on all `crypto.subtle` methods that takes in
`TypedArray`s, to make it transperent and will automatically wait for
them to resolve before asking the webview execute the method.

### `CryptoKey`
Since [JavaScriptCore](https://facebook.github.io/react-native/docs/javascript-environment.html#javascript-runtime)
does not support `window.Crypto`, it also doesn't have a `CryptoKey` interface.
So instead of returning an actual `CryptoKey` from
[`subtle.generateKey()`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey)
we instead return an object that confirms to the `CryptoKey` interface and has
a `_jwk` property that has the value of the key exported as `jwk`. This allows
you to treat the `CryptoKey` as you would normally, and whenever you need to use
it in some `subtle` method, we will automatically convert it back to a real
`CryptoKey` from the `_jwk` string and the metadata.
