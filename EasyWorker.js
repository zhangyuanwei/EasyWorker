/** 
 *           File:  EasyWorker.js
 *         Author:  zhangyuanwei
 *       Modifier:  zhangyuanwei
 *       Modified:  2013-04-14 21:03:28
 *    Description: 直接执行的Worker
 */
"use strict";

(function setup(global, undefined) {
    var toString = Object.prototype.toString,
        slice = Array.prototype.slice,
        map = Array.prototype.map,
        noop = function() {},
        isNodejs = false,
        isMaster = true,
        fork = null,
        scriptUrl,

        ACTION_USER = 0,
        ACTION_RUN = 1,
        ACTION_CALLBACK = 2,
        ACTION_RETURN = 3,
        TYPE_DEFAULT = 0,
        TYPE_FUNCTION = 1,
        TYPE_ERROR = 2;



    /**
     * initEvn 初始化环境 {{{
     *
     * @access public
     * @return void
     */

    function initEvn() {
        var child_process = require && require("child_process");

        isNodejs = !! child_process;
        isMaster = isNodejs ? !('NODE_WORKER_ID' in process.env) : !! global.window;
        fork = isNodejs ? child_process.fork : null;
    } // }}}

    /**
     * parseFunction 解析Function,得到参数列表和函数体 {{{
     *
     * @param fn
     * @return Array [arg1, arg2, ..., body]
     */

    function parseFunction(fn) {
        var code, body, args;
        if (toString.call(fn) !== "[object Function]")
            throw new Error("Not a function.");
        code = fn.toString();
        args = code.slice(code.indexOf('(') + 1, code.indexOf(')')).split(',');
        body = code.slice(code.indexOf('{') + 1, -1);
        if (/^\s*\[native code\]\s*$/.test(body))
            throw new Error("Native function is not supported.");
        args.push(body);
        return args;
    } // }}}

    /**
     * runInThisScope 在此作用域执行函数 {{{
     *
     * @param context $context
     * @param fnArr $fnArr
     * @param args $args
     * @access public
     * @return void
     */

    function runInThisScope(context, fn, args) {
        return Function.apply(context, fn).apply(context, args);
    }
    // }}}

    /**
     * EasyWorkerMessageEvent MessageEvent 封装 {{{
     *
     * @param data $data
     * @access public
     * @return void
     */

    function EasyWorkerMessageEvent(data) {
        this.data = data;
    }

    function wrapMessageEvent(e) {
        var ret;
        EasyWorkerMessageEvent.prototype = e;
        ret = new EasyWorkerMessageEvent(e.data.payload);
        EasyWorkerMessageEvent.prototype = null;
        return ret;
    }
    // }}}

    /**
     * copyProperties 属性复制 {{{
     *
     * @param to $to
     * @param from $from
     * @access public
     * @return void
     */

    function copyProperties(to, from) {
        for (var i in from) {
            to[i] = from[i];
        }
    } // }}}

    /**
     * extend 继承 {{{
     *
     * @param subClass $subClass
     * @param superClass $superClass
     * @access public
     * @return void
     */
    var extend = function(subClass, superClass) {
        if (this instanceof extend) {
            this.constructor = subClass;
        } else {
            subClass.__super__ = superClass;
            extend.prototype = superClass.prototype;
            subClass.prototype = new extend(subClass, superClass);
            extend.prototype = null;
        }
    }; // }}}

    /**
     * EasyWorker 通讯包装 {{{
     *
     * @access public
     * @return void
     */

    function EasyWorker() {
        this.__callbacks__ = [];
    }

    function getArgumentsPayload(context, args) {
        var self = context;
        return args.map(function(value) {
            var index, count;

            switch (toString.call(value).slice(8, -1)) {
                case 'Function':
                    index = count = self.__callbacks__.length;
                    while (index--) {
                        if (self.__callbacks__[index] === value) break;
                    }
                    if (index < 0) {
                        self.__callbacks__.push(value);
                        index = count;
                    }
                    return [TYPE_FUNCTION, index];
                case 'Error':
                    //console.log(value.getMessage());
                    //console.log(value.message);
                    return [TYPE_ERROR, {
                        message: value.message,
                        fileName: value.fileName,
                        lineNumber: value.lineNumber,
                        stack: value.stack
                    }];
                default:
                    return [TYPE_DEFAULT, value];
            }
        });
    }

    function defaultCallback(err, data) {
        if (err) throw err;
    }

    function parseArgumentsPayload(context, args) {
        var self = context;
        return args.map(function(value) {
            var type = value[0],
                value = value[1],
                ret;

            switch (type) {
                case TYPE_FUNCTION:
                    return function() {
                        return self._postMessage({
                            type: ACTION_CALLBACK,
                            payload: [value].concat(getArgumentsPayload(self, slice.call(arguments, 0)))
                        });
                    };
                case TYPE_ERROR:
                    ret = new Error(value.message);
                    ret.fileName = value.fileName;
                    ret.lineNumber = value.lineNumber;
                    ret.stack = value.stack;
                    return ret;
                case TYPE_DEFAULT:
                default:
                    return value;
            }
        });
    }

    copyProperties(EasyWorker.prototype, {
        //private
        _onmessage: function(msg) {
            var self = this,
                payload = msg.payload,
                fn, cb, callback, err, val, args;
            switch (msg.type) {
                case ACTION_RUN:
                    fn = payload.shift();
                    cb = payload.shift();
                    args = parseArgumentsPayload(self, payload);
                    val = err = null;
                    try {
                        val = runInThisScope(global, fn, args);
                    } catch (e) {
                        err = e;
                    }
                    return self._postMessage({
                        type: ACTION_RETURN,
                        payload: [cb].concat(getArgumentsPayload(self, [err, val]))
                    });

                case ACTION_CALLBACK:
                    fn = payload.shift();
                    args = parseArgumentsPayload(self, payload);
                    return self.__callbacks__[fn].apply(self, args);

                case ACTION_RETURN:
                    cb = payload.shift();
                    args = parseArgumentsPayload(self, payload);
                    callback = self.__callbacks__[cb];
                    self.__callbacks__[cb] = null;
                    return callback.apply(self, args);

                case ACTION_USER:
                    return self.onmessage(wrapMessageEvent(msg));

                default:
                    throw new Error("Unknow event type.");
            }
        },
        _postMessage: noop,
        //public
        onmessage: noop,
        postMessage: function(message) {
            this._postMessage({
                type: ACTION_USER,
                payload: message
            });
            return this;
        },
        run: function(fn, args) {
            var callback = this.__callbacks__,
                index;
            args = slice.call(arguments, 1);
            args = getArgumentsPayload(this, args);
            index = callback.length; //回调索引
            callback.push(defaultCallback); //默认回调
            this._postMessage({
                type: ACTION_RUN,
                payload: [parseFunction(fn), index].concat(args)
            });
            return this;
        },
        done: function(fn) {
            var callback = this.__callbacks__,
                index = callback.length;
            if (!index) return this;
            callback[index - 1] = fn;
            return this;
        }
    });

    // }}}

    /**
     * setupWorker Worker 主函数 {{{
     *
     * @access public
     * @return void
     */

    function setupWorker() {
        var _postMessage = global.postMessage,
            _onmessage = null,
            worker = new EasyWorker();

        worker.onmessage = function(msg) {
            return _onmessage ? _onmessage.call(global, msg) : undefined;
        };

        worker._postMessage = function(msg) {
            _postMessage.call(global, msg);
        };

        global.onmessage = function(e) {
            return worker._onmessage(e.data);
        };

        global.postMessage = function(msg) {
            return worker.postMessage(msg);
        };

        global.runOnMaster = function(fn, args) {
            return worker.run.apply(worker, arguments);
        };

        global.__defineSetter__("onmessage", function(callback) {
            _onmessage = callback;
        });
    } // }}}

    /**
     * setupMaster 绑定 EasyWorker 到浏览器环境  {{{
     *
     * @access public
     * @return void
     */

    function setupMaster() {
        /**
         * getScriptUrl 得到Worker的URL {{{
         *
         * @access public
         * @return void
         */

        function getScriptUrl() {
            var args, body, content, mime, blob, BlobBuilder, URL;
            if (scriptUrl) return scriptUrl;
            args = parseFunction(setup);
            body = args.pop();
            content = ['(function(', args.join(","), '){', body, '})(this);'].join("");
            mime = 'application/javascript';
            try {
                blob = new Blob([content], {
                    type: mime
                });
            } catch (e) {
                BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
                if (BlobBuilder) {
                    blob = new BlobBuilder();
                    blob.append(content);
                    blob = blob.getBlob(mime);
                }
            }

            URL = window.URL || window.webkitURL;
            if (blob && URL) {
                scriptUrl = URL.createObjectURL(blob);
            } else {
                scriptUrl = ['data:', mime, ',', encodeURIComponent(content)].join('');
            }
            return scriptUrl;
        } // }}}

        function MasterEasyWorker(url) {
            var self = this,
                worker;
            MasterEasyWorker.__super__.call(self);
            try {
                worker = new Worker(url || getScriptUrl());
                worker.onmessage = function(e) {
                    return self._onmessage(e.data);
                };
                self.__worker = worker;
            } catch (e) {
                throw new Error("Can't create web worker. " + e.message);
            }
        }

        extend(MasterEasyWorker, EasyWorker);
        copyProperties(MasterEasyWorker.prototype, {
            _postMessage: function(msg) {
                return this.__worker.postMessage(msg);
            },
            setupConsole: function() {
                return this.run(setupConsole);
            }
        });

        function setupConsole() {
            var global = this,
                console = {
                    log: null,
                    info: null,
                    warn: null,
                    debug: null,
                    dir: null,
                    error: null
                }, name;

            for (name in console) {
                console[name] = (function(name) {
                    return function() {
                        global.runOnMaster.apply(global, [
                            new Function(
                                'console.' + name + '.apply(console, Array.prototype.slice.call(arguments, 0));')
                        ].concat(Array.prototype.slice.call(arguments, 0)));
                    };
                })(name);
            }
            global.console = console;
        }

        return MasterEasyWorker;
    } // }}}

    /**
     * setupNodeWorker Nodejs Worker 主函数 {{{
     *
     * @access public
     * @return void
     */

    function setupNodeWorker() {
        var worker = new EasyWorker(),
            _send = process.send;
        process.on("message", function(msg) {
            return worker._onmessage(msg);
        });
        process.send = function(msg) {
            return worker.postMessage(msg);
        };
        /* TODO
        worker.onmessage = function(msg) { };
        */
        worker._postMessage = function(msg) {
            _send.call(process, msg);
        };
    }
    // }}}

    /**
     * setupNodeMaster Nodejs Master 主函数 {{{
     *
     * @access public
     * @return void
     */

    function setupNodeMaster() {
        var util = require("util"),
            copyEnv = util._extend({}, process.env),
            id = 0;

        function MasterEasyWorker() {
            var self = this,
                worker;
            MasterEasyWorker.__super__.call(this);

            copyEnv["NODE_WORKER_ID"] = ++id;
            try {
                worker = fork(__filename, process.argv.slice(2), {
                    "env": copyEnv
                });
                worker.on("message", function(e) {
                    return self._onmessage(e);
                });
                self.__worker = worker;
            } catch (e) {
                throw new Error("Can't create web worker. " + e.message);
            }
        }

        extend(MasterEasyWorker, EasyWorker);

        copyProperties(MasterEasyWorker.prototype, {
            _postMessage: function(msg) {
                return this.__worker.send(msg);
            }
        });
        return MasterEasyWorker;
    } // }}}

    initEvn();

    if (isNodejs) {
        exports = isMaster ? setupNodeMaster() : setupNodeWorker();
    } else {
        exports = isMaster ? setupMaster() : setupWorker();
    }

    if (exports) {
        if (typeof module === "object" && typeof module.exports === "object") {
            module.exports = exports;
        } else {
            global.EasyWorker = exports;
        }
    }

})(this);
// vim600: sw=4 ts=4 fdm=marker syn=javascript
