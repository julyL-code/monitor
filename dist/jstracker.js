(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.jstracker = factory());
}(this, (function () { 'use strict';

/**
 * debounce
 *
 * @param {Function} func 实际要执行的函数
 * @param {Number} delay 延迟时间，单位是 ms
 * @param {Function} callback 在 func 执行后的回调
 *
 * @return {Function}
 */
function debounce(func, delay, callback) {
  var timer;

  return function() {
    var context = this;
    var args = arguments;

    clearTimeout(timer);

    timer = setTimeout(function() {
      func.apply(context, args);

      !callback || callback();
    }, delay);
  }
}

/**
 * merge
 *
 * @param  {Object} src
 * @param  {Object} dest
 * @return {Object}
 */
function merge(src, dest) {
  for (var item in src) {
    dest[item] = src[item];
  }

  return dest
}

/**
 * 是否是函数
 *
 * @param  {Any} func 判断对象
 * @return {Boolean}
 */
function isFunction(func) {
  return Object.prototype.toString.call(func) === '[object Function]'
}

/**
 * 将类数组转化成数组
 *
 * @param  {Object} arrayLike 类数组对象
 * @return {Array} 转化后的数组
 */
function arrayFrom(arrayLike) {
  return [].slice.call(arrayLike)
}

var tryJS = {};

tryJS.wrap = wrap;
tryJS.wrapArgs = tryifyArgs;

var config$1 = {
  handleTryCatchError: function() {}
};

function setting(opts) {
  merge(opts, config$1);
}

function wrap(func) {
  return isFunction(func) ? tryify(func) : func
}

/**
 * 将函数使用 try..catch 包装
 *
 * @param  {Function} func 需要进行包装的函数
 * @return {Function} 包装后的函数
 */
function tryify(func) {
  // 确保只包装一次
  if (!func._wrapped) {
    func._wrapped = function() {
      try {
        return func.apply(this, arguments)
      } catch (error) {
        config$1.handleTryCatchError(error);
        window.ignoreError = true;

        throw error
      }
    };
  }

  return func._wrapped
}

/**
 * 只对函数参数进行包装
 *
 * @param  {Function} func 需要进行包装的函数
 * @return {Function}
 */
function tryifyArgs(func) {
  return function() {
    var args = arrayFrom(arguments).map(function(arg) {
      return wrap(arg)
    });

    return func.apply(this, args)
  }
}

var monitor = {};
monitor.tryJS = tryJS;

setting({
  handleTryCatchError: handleTryCatchError
});

monitor.init = function (opts) {
  __config(opts);
  __init();
};

// 忽略错误监听
window.ignoreError = false;
// 错误日志列表
var errorList = [];
// 错误处理回调
var report = function () {};

var config = {
  concat: true,
  delay: 2000, // 错误处理间隔时间
  maxError: 16, // 异常报错数量限制
  sampling: 1 // 采样率
};
let ERROR_INTR = [
  '',
  'js执行错误',
  'js加载失败',
  'css加载失败',
  '图片加载失败',
  '音乐加载失败',
  '视频加载失败',
  'console.error',
  'try catch'
];
// 定义的错误类型码
var ERROR_RUNTIME = 1;
var ERROR_SCRIPT = 2;
var ERROR_STYLE = 3;
var ERROR_IMAGE = 4;
var ERROR_AUDIO = 5;
var ERROR_VIDEO = 6;
var ERROR_CONSOLE = 7;
var ERROR_TRY_CATHC = 8;

var LOAD_ERROR_TYPE = {
  SCRIPT: ERROR_SCRIPT,
  LINK: ERROR_STYLE,
  IMG: ERROR_IMAGE,
  AUDIO: ERROR_AUDIO,
  VIDEO: ERROR_VIDEO
};

function __config(opts) {
  merge(opts, config);

  report = debounce(config.report, config.delay, function () {
    errorList = [];
  });
}

function __init() {
  // 监听 JavaScript 报错异常(JavaScript runtime error)
  window.onerror = function () {
    if (window.ignoreError) {
      window.ignoreError = false;
      return
    }

    handleError(formatRuntimerError.apply(null, arguments));
  };

  // 监听资源加载错误(JavaScript Scource failed to load)
  window.addEventListener('error', function (event) {
    // 过滤 target 为 window 的异常，避免与上面的 onerror 重复
    var errorTarget = event.target;
    if (errorTarget !== window && errorTarget.nodeName && LOAD_ERROR_TYPE[errorTarget.nodeName.toUpperCase()]) {
      handleError(formatLoadError(errorTarget));
    }
  }, true);

  // 针对 vue 报错重写 console.error
  // TODO
  console.error = (function (origin) {
    return function (info) {
      var errorLog = {
        type: ERROR_CONSOLE,
        desc: info
      };

      handleError(errorLog);
      origin.call(console, info);
    }
  })(console.error);
}

// 处理 try..catch 错误
function handleTryCatchError(error) {
  handleError(formatTryCatchError(error));
}

/**
 * 生成 runtime 错误日志
 *
 * @param  {String} message 错误信息
 * @param  {String} source  发生错误的脚本 URL
 * @param  {Number} lineno  发生错误的行号
 * @param  {Number} colno   发生错误的列号
 * @param  {Object} error   error 对象
 * @return {Object}
 */
function formatRuntimerError(message, source, lineno, colno, error) {
  return {
    type: ERROR_RUNTIME,
    intr: ERROR_INTR[ERROR_RUNTIME],
    desc: {
      message: message,
      source: source,
      lineno: lineno,
      colno: colno
    },
    stack: error && error.stack ? error.stack : 'no stack' // IE <9, has no error stack
  }
}

/**
 * 生成 laod 错误日志
 *
 * @param  {Object} errorTarget
 * @return {Object}
 */
function formatLoadError(errorTarget) {
  var type = LOAD_ERROR_TYPE[errorTarget.nodeName.toUpperCase()];
  return {
    type: type,
    intr: ERROR_INTR[type],
    desc: {
      baseUrl: errorTarget.baseURI,
      href: errorTarget.src || errorTarget.href
    },
    stack: 'no stack'
  }
}

/**
 * 生成 try..catch 错误日志
 *
 * @param  {Object} error error 对象
 * @return {Object} 格式化后的对象
 */
function formatTryCatchError(error) {
  return {
    type: ERROR_TRY_CATHC,
    desc: error.message,
    stack: error.stack
  }
}

/**
 * 错误数据预处理
 *
 * @param  {Object} errorLog    错误日志
 */
function handleError(errorLog) {
  // 是否延时处理
  if (!config.concat) {
    !needReport(config.sampling) || config.report([errorLog]);
  } else {
    pushError(errorLog);
    report(errorList);
  }
}

/**
 * 往异常信息数组里面添加一条记录
 *
 * @param  {Object} errorLog 错误日志
 */
function pushError(errorLog) {
  if (needReport(config.sampling) && errorList.length < config.maxError) {
    errorList.push(errorLog);
  }
}

/**
 * 设置一个采样率，决定是否上报
 *
 * @param  {Number} sampling 0 - 1
 * @return {Boolean}
 */
function needReport(sampling) {
  return Math.random() < (sampling || 1)
}

return monitor;

})));
