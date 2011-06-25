//
//  This file was modified by Ewoud van den Boom, these changes are
//  available under the same conditions as the original (see MIT License 
//  below).
//
//  Original project at: https://github.com/tsyd/proxy-tamper  
//
//	(The MIT License)
//	
//	Copyright (c) 2011 Thomas Sydorowski
//	
//	Permission is hereby granted, free of charge, to any person obtaining
//	a copy of this software and associated documentation files (the
//	'Software'), to deal in the Software without restriction, including
//	without limitation the rights to use, copy, modify, merge, publish,
//	distribute, sublicense, and/or sell copies of the Software, and to
//	permit persons to whom the Software is furnished to do so, subject to
//	the following conditions:
//	
//	The above copyright notice and this permission notice shall be
//	included in all copies or substantial portions of the Software.
//	
//	THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
//	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//	CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//	TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//	SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



var http = require('http');

var ProxyTamper = function (options) {
  var _patterns = [];

  var _server = http.createServer(function (req, resp) {
    var proxy = null;
    var proxyReq = null;
    var tamperBody = null;
    var buffers = [];

    _patterns.forEach(function (p) {
      if (req.url.search(p.pattern) != -1) {
        switch (p.tamper.constructor.name) {
        case 'Function':
          switch (parseInt(p.tamper.length)) {
          case 1:
            var reqProxyObj = {
              method: req.method, url: req.url, headers: req.headers,
              // handled: Indicates that the request has been handled
              // by the tamper function.
              handled: false,
              // response: the reponse object for the current request
              // should only be used if the tamper function intends to 
              // handle the request (see handled:)
              response: resp,
              onResponse: function (thisOnResultHandler) {
                resp._onResultHandler = thisOnResultHandler;
              }
            };

            p.tamper.call(null, reqProxyObj);
            req.url = reqProxyObj.url;
            req.headers = reqProxyObj.headers;
            req.method = reqProxyObj.method;
            break;
          case 0:
          default:
            tamperBody = p.tamper.call(null, null);
            break;
          }
          break;
        case 'String':
          tamperBody = p.tamper; break;
        default:
          throw new Error('Tamper object must be a function or string but was a '
            + p.tamper.constructor.name + '.'); break;
        }
      }
    });
    
    if(resp.handled){
    	return;
    }

    if (!resp._onResultHandler && tamperBody) {
      resp.writeHead(200, {});
      resp.write(tamperBody, 'utf8');
      resp.end();
      return;
    }

    proxy = http.createClient(80, req.headers['host']);
    proxyReq = proxy.request(req.method, req.url, req.headers);

    proxy.addListener('error', function (e) {});

    proxyReq.addListener('response', function (proxyResp) {
      proxyResp.addListener('data', function (chunk) { buffers.push(chunk); });
      proxyResp.addListener('error', function (e) {});
      proxyResp.addListener('end', function () {
        var strBody = '';
        buffers.forEach(function (buf) { strBody += buf.toString(); });
        var originalStrBody = strBody;

        var proxyRespProxyObj = {
          statusCode: proxyResp.statusCode, headers: proxyResp.headers, body: strBody,
          complete: function () {
            resp.writeHead(this.statusCode, this.headers);

            if ((strBody != this.body) && (this.body != undefined)) {
              resp.write(this.body);
            }
            else {
              buffers.forEach(function (buf) {
                resp.write(buf, 'utf8');
              });
            }

            resp.end();
          }
        };

        if (resp._onResultHandler) {
          resp._onResultHandler.call(null, proxyRespProxyObj);
        }
        else {
          proxyRespProxyObj.complete.call(proxyRespProxyObj);
        }
      });
    });

    req.addListener('data', function (chunk) {
      proxyReq.write(chunk, 'utf8');
    });

    req.addListener('end', function () {
      proxyReq.end();
    });
  }).listen(options.port);

  return {
    tamper: function (pattern, obj) {
      _patterns.unshift({ pattern: pattern, tamper: obj });
    }
  };
};

exports.start = function (options, block) {
  var proxyTamper = new ProxyTamper(options);
  block.call(proxyTamper, proxyTamper);
  return proxyTamper;
};