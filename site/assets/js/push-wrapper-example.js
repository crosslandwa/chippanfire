(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var Push = require('push-wrapper'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial'),
    Player = require('./src/player.js'),
    context = window.AudioContext ? new window.AudioContext() : new window.webkitAudioContext(),
    Repetae = require('./src/repetae.js'),
    Repeater = require('./src/repeater.js'),
    BPM = require('./src/bpm.js'),
    bpm = new BPM(120),
    Interval = require('./src/interval.js'),
    intervals = {
    '1/4': Interval['4n'](bpm, '1/4'),
    '1/4t': Interval['4nt'](bpm, '1/4t'),
    '1/8': Interval['8n'](bpm, '1/8'),
    '1/8t': Interval['8nt'](bpm, '1/8t'),
    '1/16': Interval['16n'](bpm, '1/16'),
    '1/16t': Interval['16nt'](bpm, '1/16t'),
    '1/32': Interval['32n'](bpm, '1/32'),
    '1/32t': Interval['32nt'](bpm, '1/32t')
},
    samples = ['assets/audio/Bonus_Kick27.mp3', 'assets/audio/snare_turnboot.mp3', 'assets/audio/HandClap.mp3', 'assets/audio/Beat07_Hat.mp3', 'assets/audio/HH_KIT09_100_TMB.mp3', 'assets/audio/clingfilm.mp3', 'assets/audio/tang-1.mp3', 'assets/audio/Cassette808_Tom01.mp3'],
    filter_frequencies = [0, 100, 200, 400, 800, 2000, 6000, 10000, 20000];

window.addEventListener('load', function () {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: true }).then(Push.create_bound_to_web_midi_api).then(off_we_go);
    } else {
        Promise.resolve(new Push({ send: function send(bytes) {} })).then(off_we_go); //todo add onscreen warning
    }
});

function off_we_go(bound_push) {
    var buttons = document.getElementsByClassName('push-wrapper-button'),
        players = create_players(),
        push = bound_push;

    push.lcd.clear();

    foreach(players, function (player, i) {
        var column_number = i + 1,
            full_path_sample_name = samples[i].split('.')[0],
            sample_name = full_path_sample_name.split('/').pop(),
            repetae = new Repetae(Repeater.create_scheduled_by_audio_context(context), intervals['1/4']);

        push.grid.x[column_number].select.on('pressed', repetae.press);
        push.grid.x[column_number].select.on('released', repetae.release);

        push.grid.x[column_number].select.led_on();
        repetae.on('on', partial(push.grid.x[column_number].select.led_rgb, 0, 0, 255));
        repetae.on('off', push.grid.x[column_number].select.led_on);
        repetae.on('interval', push.lcd.x[column_number].y[1].update);

        repetae.report_interval();

        foreach(intervals, function (interval, button_name) {
            push.button[button_name].on('pressed', partial(repetae.interval, interval));
        });

        turn_off_column(push, column_number);
        push.lcd.x[column_number].y[2].update(sample_name.length > 8 ? sample_name.substr(sample_name.length - 8) : sample_name);
        player.on('started', partial(turn_button_display_on, buttons[i]));
        player.on('stopped', partial(turn_button_display_off, buttons[i]));
        player.on('started', partial(turn_on_column, push, column_number));
        player.on('stopped', partial(turn_off_column, push, column_number));
        buttons[i].addEventListener('mousedown', partial(player.play, 110, filter_frequencies[8]));
        bind_column_to_player(push, player, column_number, repetae);
    });

    foreach(intervals, function (interval, button_name) {
        push.button[button_name].led_dim();
    });

    bind_pitchbend(push, players);

    bindQwertyuiToPlayback(players);
    bind_tempo_knob_to_bpm(push, bpm);
    bpm.report();
}

function create_players() {
    var players = [];
    for (var i = 0; i < samples.length; i++) {
        players[i] = new Player(samples[i], context);
    }
    return players;
}

function bind_column_to_player(push, player, x, repetae) {
    var mutable_velocity = 127,
        mutable_frequency = filter_frequencies[8],
        pressed_pads_in_col = 0;

    var playback = function playback() {
        player.play(mutable_velocity, mutable_frequency);
    };

    foreach([1, 2, 3, 4, 5, 6, 7, 8], function (y) {
        var grid_button = push.grid.x[x].y[y];

        grid_button.on('pressed', function (velocity) {
            mutable_velocity = velocity;
            mutable_frequency = filter_frequencies[y];
            if (++pressed_pads_in_col == 1) repetae.start(playback);
        });
        grid_button.on('aftertouch', function (pressure) {
            if (pressure > 0) mutable_velocity = pressure;
        });
        grid_button.on('released', function () {
            if (--pressed_pads_in_col == 0) repetae.stop();
        });
    });
}

function bindQwertyuiToPlayback(players) {
    var lookup = { 113: 0, 119: 1, 101: 2, 114: 3, 116: 4, 121: 5, 117: 6, 105: 7 };
    window.addEventListener("keypress", function (event) {
        if (event.charCode in lookup) {
            players[lookup[event.charCode]].play(110, filter_frequencies[8]);
        }
    });
}

function turn_on_column(push, x, velocity) {
    foreach([1, 2, 3, 4, 5, 6, 7, 8], function (y) {
        if ((velocity + 15) / 16 >= y) {
            push.grid.x[x].y[y].led_on(velocity);
        } else {
            push.grid.x[x].y[y].led_off();
        }
    });
}

function turn_off_column(push, x) {
    foreach([2, 3, 4, 5, 6, 7, 8], function (y) {
        push.grid.x[x].y[y].led_off();
    });
    push.grid.x[x].y[1].led_on();
}

function bind_pitchbend(push, players) {
    push.touchstrip.on('pitchbend', function (pb) {
        var rate = pb > 8192 ? pb / 4096 : pb / 8192;
        foreach(players, function (player) {
            return player.update_playback_rate(rate);
        });
    });
}

function bind_tempo_knob_to_bpm(push, bpm) {
    push.knob['tempo'].on('turned', bpm.change_by);
    bpm.on('changed', function (bpm) {
        return push.lcd.x[1].y[3].update('bpm= ' + bpm.current);
    });
}

function turn_button_display_on(ui_btn) {
    ui_btn.classList.add('active');
}

function turn_button_display_off(ui_btn) {
    ui_btn.classList.remove('active');
}

},{"./src/bpm.js":22,"./src/interval.js":23,"./src/player.js":24,"./src/repeater.js":25,"./src/repetae.js":26,"lodash.foreach":9,"lodash.partial":13,"push-wrapper":15}],2:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * A specialized version of `_.forEach` for arrays without support for callback
 * shorthands or `this` binding.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

module.exports = arrayEach;

},{}],3:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var keys = require('lodash.keys');

/**
 * Used as the [maximum length](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.forEach` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object|string} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

/**
 * The base implementation of `baseForIn` and `baseForOwn` which iterates
 * over `object` properties returned by `keysFunc` invoking `iteratee` for
 * each property. Iteratee functions may exit iteration early by explicitly
 * returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    var length = collection ? getLength(collection) : 0;
    if (!isLength(length)) {
      return eachFunc(collection, iteratee);
    }
    var index = fromRight ? length : -1,
        iterable = toObject(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

/**
 * Creates a base function for `_.forIn` or `_.forInRight`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var iterable = toObject(object),
        props = keysFunc(object),
        length = props.length,
        index = fromRight ? length : -1;

    while ((fromRight ? index-- : ++index < length)) {
      var key = props[index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Converts `value` to an object if it's not one.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {Object} Returns the object.
 */
function toObject(value) {
  return isObject(value) ? value : Object(value);
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = baseEach;

},{"lodash.keys":12}],4:[function(require,module,exports){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * A specialized version of `baseCallback` which only supports `this` binding
 * and specifying the number of arguments to provide to `func`.
 *
 * @private
 * @param {Function} func The function to bind.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {number} [argCount] The number of arguments to provide to `func`.
 * @returns {Function} Returns the callback.
 */
function bindCallback(func, thisArg, argCount) {
  if (typeof func != 'function') {
    return identity;
  }
  if (thisArg === undefined) {
    return func;
  }
  switch (argCount) {
    case 1: return function(value) {
      return func.call(thisArg, value);
    };
    case 3: return function(value, index, collection) {
      return func.call(thisArg, value, index, collection);
    };
    case 4: return function(accumulator, value, index, collection) {
      return func.call(thisArg, accumulator, value, index, collection);
    };
    case 5: return function(value, other, key, object, source) {
      return func.call(thisArg, value, other, key, object, source);
    };
  }
  return function() {
    return func.apply(thisArg, arguments);
  };
}

/**
 * This method returns the first argument provided to it.
 *
 * @static
 * @memberOf _
 * @category Utility
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = bindCallback;

},{}],5:[function(require,module,exports){
/**
 * lodash 3.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var root = require('lodash._root');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1,
    BIND_KEY_FLAG = 2,
    CURRY_BOUND_FLAG = 4,
    CURRY_FLAG = 8,
    CURRY_RIGHT_FLAG = 16,
    PARTIAL_FLAG = 32,
    PARTIAL_RIGHT_FLAG = 64,
    ARY_FLAG = 128,
    FLIP_FLAG = 512;

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** Used as the internal argument placeholder. */
var PLACEHOLDER = '__lodash_placeholder__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {...*} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  var length = args.length;
  switch (length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Replaces all `placeholder` elements in `array` with an internal placeholder
 * and returns an array of their indexes.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {*} placeholder The placeholder to replace.
 * @returns {Array} Returns the new array of placeholder indexes.
 */
function replaceHolders(array, placeholder) {
  var index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    if (array[index] === placeholder) {
      array[index] = PLACEHOLDER;
      result[++resIndex] = index;
    }
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
var baseCreate = (function() {
  function object() {}
  return function(prototype) {
    if (isObject(prototype)) {
      object.prototype = prototype;
      var result = new object;
      object.prototype = undefined;
    }
    return result || {};
  };
}());

/**
 * Creates an array that is the composition of partially applied arguments,
 * placeholders, and provided arguments into a single array of arguments.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to prepend to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgs(args, partials, holders) {
  var holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      leftIndex = -1,
      leftLength = partials.length,
      result = Array(leftLength + argsLength);

  while (++leftIndex < leftLength) {
    result[leftIndex] = partials[leftIndex];
  }
  while (++argsIndex < holdersLength) {
    result[holders[argsIndex]] = args[argsIndex];
  }
  while (argsLength--) {
    result[leftIndex++] = args[argsIndex++];
  }
  return result;
}

/**
 * This function is like `composeArgs` except that the arguments composition
 * is tailored for `_.partialRight`.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to append to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgsRight(args, partials, holders) {
  var holdersIndex = -1,
      holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      rightIndex = -1,
      rightLength = partials.length,
      result = Array(argsLength + rightLength);

  while (++argsIndex < argsLength) {
    result[argsIndex] = args[argsIndex];
  }
  var offset = argsIndex;
  while (++rightIndex < rightLength) {
    result[offset + rightIndex] = partials[rightIndex];
  }
  while (++holdersIndex < holdersLength) {
    result[offset + holders[holdersIndex]] = args[argsIndex++];
  }
  return result;
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Creates a function that wraps `func` to invoke it with the optional `this`
 * binding of `thisArg`.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createBaseWrapper(func, bitmask, thisArg) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    var fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;
    return fn.apply(isBind ? thisArg : this, arguments);
  }
  return wrapper;
}

/**
 * Creates a function that produces an instance of `Ctor` regardless of
 * whether it was invoked as part of a `new` expression or by `call` or `apply`.
 *
 * @private
 * @param {Function} Ctor The constructor to wrap.
 * @returns {Function} Returns the new wrapped function.
 */
function createCtorWrapper(Ctor) {
  return function() {
    // Use a `switch` statement to work with class constructors.
    // See http://ecma-international.org/ecma-262/6.0/#sec-ecmascript-function-objects-call-thisargument-argumentslist
    // for more details.
    var args = arguments;
    switch (args.length) {
      case 0: return new Ctor;
      case 1: return new Ctor(args[0]);
      case 2: return new Ctor(args[0], args[1]);
      case 3: return new Ctor(args[0], args[1], args[2]);
      case 4: return new Ctor(args[0], args[1], args[2], args[3]);
      case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
      case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    }
    var thisBinding = baseCreate(Ctor.prototype),
        result = Ctor.apply(thisBinding, args);

    // Mimic the constructor's `return` behavior.
    // See https://es5.github.io/#x13.2.2 for more details.
    return isObject(result) ? result : thisBinding;
  };
}

/**
 * Creates a function that wraps `func` to enable currying.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {number} arity The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createCurryWrapper(func, bitmask, arity) {
  var Ctor = createCtorWrapper(func);

  function wrapper() {
    var length = arguments.length,
        index = length,
        args = Array(length),
        fn = (this && this !== root && this instanceof wrapper) ? Ctor : func,
        placeholder = wrapper.placeholder;

    while (index--) {
      args[index] = arguments[index];
    }
    var holders = (length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder)
      ? []
      : replaceHolders(args, placeholder);

    length -= holders.length;
    return length < arity
      ? createRecurryWrapper(func, bitmask, createHybridWrapper, placeholder, undefined, args, holders, undefined, undefined, arity - length)
      : apply(fn, this, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to invoke it with optional `this`
 * binding of `thisArg`, partial application, and currying.
 *
 * @private
 * @param {Function|string} func The function or method name to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [partialsRight] The arguments to append to those provided to the new function.
 * @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createHybridWrapper(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
  var isAry = bitmask & ARY_FLAG,
      isBind = bitmask & BIND_FLAG,
      isBindKey = bitmask & BIND_KEY_FLAG,
      isCurry = bitmask & CURRY_FLAG,
      isCurryRight = bitmask & CURRY_RIGHT_FLAG,
      isFlip = bitmask & FLIP_FLAG,
      Ctor = isBindKey ? undefined : createCtorWrapper(func);

  function wrapper() {
    var length = arguments.length,
        index = length,
        args = Array(length);

    while (index--) {
      args[index] = arguments[index];
    }
    if (partials) {
      args = composeArgs(args, partials, holders);
    }
    if (partialsRight) {
      args = composeArgsRight(args, partialsRight, holdersRight);
    }
    if (isCurry || isCurryRight) {
      var placeholder = wrapper.placeholder,
          argsHolders = replaceHolders(args, placeholder);

      length -= argsHolders.length;
      if (length < arity) {
        return createRecurryWrapper(func, bitmask, createHybridWrapper, placeholder, thisArg, args, argsHolders, argPos, ary, arity - length);
      }
    }
    var thisBinding = isBind ? thisArg : this,
        fn = isBindKey ? thisBinding[func] : func;

    if (argPos) {
      args = reorder(args, argPos);
    } else if (isFlip && args.length > 1) {
      args.reverse();
    }
    if (isAry && ary < args.length) {
      args.length = ary;
    }
    if (this && this !== root && this instanceof wrapper) {
      fn = Ctor || createCtorWrapper(fn);
    }
    return fn.apply(thisBinding, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to invoke it with the optional `this`
 * binding of `thisArg` and the `partials` prepended to those provided to
 * the wrapper.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} partials The arguments to prepend to those provided to the new function.
 * @returns {Function} Returns the new wrapped function.
 */
function createPartialWrapper(func, bitmask, thisArg, partials) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    var argsIndex = -1,
        argsLength = arguments.length,
        leftIndex = -1,
        leftLength = partials.length,
        args = Array(leftLength + argsLength),
        fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;

    while (++leftIndex < leftLength) {
      args[leftIndex] = partials[leftIndex];
    }
    while (argsLength--) {
      args[leftIndex++] = arguments[++argsIndex];
    }
    return apply(fn, isBind ? thisArg : this, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to continue currying.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {Function} wrapFunc The function to create the `func` wrapper.
 * @param {*} placeholder The placeholder to replace.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createRecurryWrapper(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary, arity) {
  var isCurry = bitmask & CURRY_FLAG,
      newArgPos = argPos ? copyArray(argPos) : undefined,
      newsHolders = isCurry ? holders : undefined,
      newHoldersRight = isCurry ? undefined : holders,
      newPartials = isCurry ? partials : undefined,
      newPartialsRight = isCurry ? undefined : partials;

  bitmask |= (isCurry ? PARTIAL_FLAG : PARTIAL_RIGHT_FLAG);
  bitmask &= ~(isCurry ? PARTIAL_RIGHT_FLAG : PARTIAL_FLAG);

  if (!(bitmask & CURRY_BOUND_FLAG)) {
    bitmask &= ~(BIND_FLAG | BIND_KEY_FLAG);
  }
  var result = wrapFunc(func, bitmask, thisArg, newPartials, newsHolders, newPartialsRight, newHoldersRight, newArgPos, ary, arity);

  result.placeholder = placeholder;
  return result;
}

/**
 * Creates a function that either curries or invokes `func` with optional
 * `this` binding and partially applied arguments.
 *
 * @private
 * @param {Function|string} func The function or method name to wrap.
 * @param {number} bitmask The bitmask of wrapper flags.
 *  The bitmask may be composed of the following flags:
 *     1 - `_.bind`
 *     2 - `_.bindKey`
 *     4 - `_.curry` or `_.curryRight` of a bound function
 *     8 - `_.curry`
 *    16 - `_.curryRight`
 *    32 - `_.partial`
 *    64 - `_.partialRight`
 *   128 - `_.rearg`
 *   256 - `_.ary`
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to be partially applied.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createWrapper(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
  var isBindKey = bitmask & BIND_KEY_FLAG;
  if (!isBindKey && typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var length = partials ? partials.length : 0;
  if (!length) {
    bitmask &= ~(PARTIAL_FLAG | PARTIAL_RIGHT_FLAG);
    partials = holders = undefined;
  }
  ary = ary === undefined ? ary : nativeMax(toInteger(ary), 0);
  arity = arity === undefined ? arity : toInteger(arity);
  length -= holders ? holders.length : 0;

  if (bitmask & PARTIAL_RIGHT_FLAG) {
    var partialsRight = partials,
        holdersRight = holders;

    partials = holders = undefined;
  }
  var newData = [func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity];

  func = newData[0];
  bitmask = newData[1];
  thisArg = newData[2];
  partials = newData[3];
  holders = newData[4];
  arity = newData[9] = newData[9] == null
    ? (isBindKey ? 0 : func.length)
    : nativeMax(newData[9] - length, 0);

  if (!arity && bitmask & (CURRY_FLAG | CURRY_RIGHT_FLAG)) {
    bitmask &= ~(CURRY_FLAG | CURRY_RIGHT_FLAG);
  }
  if (!bitmask || bitmask == BIND_FLAG) {
    var result = createBaseWrapper(func, bitmask, thisArg);
  } else if (bitmask == CURRY_FLAG || bitmask == CURRY_RIGHT_FLAG) {
    result = createCurryWrapper(func, bitmask, arity);
  } else if ((bitmask == PARTIAL_FLAG || bitmask == (BIND_FLAG | PARTIAL_FLAG)) && !holders.length) {
    result = createPartialWrapper(func, bitmask, thisArg, partials);
  } else {
    result = createHybridWrapper.apply(undefined, newData);
  }
  return result;
}

/**
 * Reorder `array` according to the specified indexes where the element at
 * the first index is assigned as the first element, the element at
 * the second index is assigned as the second element, and so on.
 *
 * @private
 * @param {Array} array The array to reorder.
 * @param {Array} indexes The arranged array indexes.
 * @returns {Array} Returns `array`.
 */
function reorder(array, indexes) {
  var arrLength = array.length,
      length = nativeMin(indexes.length, arrLength),
      oldArray = copyArray(array);

  while (length--) {
    var index = indexes[length];
    array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
  }
  return array;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = createWrapper;

},{"lodash._root":8}],6:[function(require,module,exports){
/**
 * lodash 3.9.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = getNative;

},{}],7:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the internal argument placeholder. */
var PLACEHOLDER = '__lodash_placeholder__';

/**
 * Replaces all `placeholder` elements in `array` with an internal placeholder
 * and returns an array of their indexes.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {*} placeholder The placeholder to replace.
 * @returns {Array} Returns the new array of placeholder indexes.
 */
function replaceHolders(array, placeholder) {
  var index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    if (array[index] === placeholder) {
      array[index] = PLACEHOLDER;
      result[++resIndex] = index;
    }
  }
  return result;
}

module.exports = replaceHolders;

},{}],8:[function(require,module,exports){
(function (global){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

module.exports = root;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],9:[function(require,module,exports){
/**
 * lodash 3.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var arrayEach = require('lodash._arrayeach'),
    baseEach = require('lodash._baseeach'),
    bindCallback = require('lodash._bindcallback'),
    isArray = require('lodash.isarray');

/**
 * Creates a function for `_.forEach` or `_.forEachRight`.
 *
 * @private
 * @param {Function} arrayFunc The function to iterate over an array.
 * @param {Function} eachFunc The function to iterate over a collection.
 * @returns {Function} Returns the new each function.
 */
function createForEach(arrayFunc, eachFunc) {
  return function(collection, iteratee, thisArg) {
    return (typeof iteratee == 'function' && thisArg === undefined && isArray(collection))
      ? arrayFunc(collection, iteratee)
      : eachFunc(collection, bindCallback(iteratee, thisArg, 3));
  };
}

/**
 * Iterates over elements of `collection` invoking `iteratee` for each element.
 * The `iteratee` is bound to `thisArg` and invoked with three arguments:
 * (value, index|key, collection). Iteratee functions may exit iteration early
 * by explicitly returning `false`.
 *
 * **Note:** As with other "Collections" methods, objects with a "length" property
 * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
 * may be used for object iteration.
 *
 * @static
 * @memberOf _
 * @alias each
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @param {*} [thisArg] The `this` binding of `iteratee`.
 * @returns {Array|Object|string} Returns `collection`.
 * @example
 *
 * _([1, 2]).forEach(function(n) {
 *   console.log(n);
 * }).value();
 * // => logs each value from left to right and returns the array
 *
 * _.forEach({ 'a': 1, 'b': 2 }, function(n, key) {
 *   console.log(n, key);
 * });
 * // => logs each value-key pair and returns the object (iteration order is not guaranteed)
 */
var forEach = createForEach(arrayEach, baseEach);

module.exports = forEach;

},{"lodash._arrayeach":2,"lodash._baseeach":3,"lodash._bindcallback":4,"lodash.isarray":11}],10:[function(require,module,exports){
/**
 * lodash 3.0.8 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value)) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array and weak map constructors,
  // and PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isArguments;

},{}],11:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var arrayTag = '[object Array]',
    funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isArray;

},{}],12:[function(require,module,exports){
/**
 * lodash 3.1.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var getNative = require('lodash._getnative'),
    isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeKeys = getNative(Object, 'keys');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * A fallback implementation of `Object.keys` which creates an array of the
 * own enumerable property names of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;

  var allowIndexes = !!length && isLength(length) &&
    (isArray(object) || isArguments(object));

  var index = -1,
      result = [];

  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  var Ctor = object == null ? undefined : object.constructor;
  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
      (typeof object != 'function' && isArrayLike(object))) {
    return shimKeys(object);
  }
  return isObject(object) ? nativeKeys(object) : [];
};

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keys;

},{"lodash._getnative":6,"lodash.isarguments":10,"lodash.isarray":11}],13:[function(require,module,exports){
/**
 * lodash 3.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var createWrapper = require('lodash._createwrapper'),
    replaceHolders = require('lodash._replaceholders'),
    restParam = require('lodash.restparam');

/** Used to compose bitmasks for wrapper metadata. */
var PARTIAL_FLAG = 32;

/**
 * Creates a `_.partial` or `_.partialRight` function.
 *
 * @private
 * @param {boolean} flag The partial bit flag.
 * @returns {Function} Returns the new partial function.
 */
function createPartial(flag) {
  var partialFunc = restParam(function(func, partials) {
    var holders = replaceHolders(partials, partialFunc.placeholder);
    return createWrapper(func, flag, undefined, partials, holders);
  });
  return partialFunc;
}

/**
 * Creates a function that invokes `func` with `partial` arguments prepended
 * to those provided to the new function. This method is like `_.bind` except
 * it does **not** alter the `this` binding.
 *
 * The `_.partial.placeholder` value, which defaults to `_` in monolithic
 * builds, may be used as a placeholder for partially applied arguments.
 *
 * **Note:** This method does not set the "length" property of partially
 * applied functions.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to partially apply arguments to.
 * @param {...*} [partials] The arguments to be partially applied.
 * @returns {Function} Returns the new partially applied function.
 * @example
 *
 * var greet = function(greeting, name) {
 *   return greeting + ' ' + name;
 * };
 *
 * var sayHelloTo = _.partial(greet, 'hello');
 * sayHelloTo('fred');
 * // => 'hello fred'
 *
 * // using placeholders
 * var greetFred = _.partial(greet, _, 'fred');
 * greetFred('hi');
 * // => 'hi fred'
 */
var partial = createPartial(PARTIAL_FLAG);

// Assign default placeholders.
partial.placeholder = {};

module.exports = partial;

},{"lodash._createwrapper":5,"lodash._replaceholders":7,"lodash.restparam":14}],14:[function(require,module,exports){
/**
 * lodash 3.6.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.restParam(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function restParam(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        rest = Array(length);

    while (++index < length) {
      rest[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, rest);
      case 1: return func.call(this, args[0], rest);
      case 2: return func.call(this, args[0], args[1], rest);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = rest;
    return func.apply(this, otherArgs);
  };
}

module.exports = restParam;

},{}],15:[function(require,module,exports){
'use strict';

// Public API/node-module for the Push

var EventEmitter = require('events'),
    util = require('util'),
    Buttons = require('./src/buttons.js'),
    Knobs = require('./src/knobs'),
    Grid = require('./src/grid.js'),
    Touchstrip = require('./src/touchstrip.js'),
    ControlButtons = require('./src/control-buttons.js'),
    LCDs = require('./src/lcds.js'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial'),
    one_to_eight = [1, 2, 3, 4, 5, 6, 7, 8];

function Push(midi_out_port) {
    var _this = this;

    EventEmitter.call(this);

    var midi_out = {
        send_cc: function send_cc(cc, value) {
            midi_out_port.send([176, cc, value]);
        },
        send_note: function send_note(note, velocity) {
            midi_out_port.send([144, note, velocity]);
        },
        send_sysex: function send_sysex(data) {
            midi_out_port.send([240, 71, 127, 21].concat(data).concat([247]));
        }
    };

    var buttons = new Buttons(midi_out.send_cc);
    this.knobs = new Knobs();
    this.grid = new Grid(midi_out.send_note, midi_out.send_cc, midi_out.send_sysex);
    this.touchstrip = new Touchstrip();
    this.control = new ControlButtons(midi_out.send_cc);
    this.ccMap = [];
    this.noteMap = [];

    foreach([this.knobs, this.touchstrip, this.grid], function (module) {
        return foreach(module.handled_notes, function (value, key) {
            return _this.noteMap[value] = module;
        });
    });

    foreach([this.knobs, this.control, buttons, this.grid], function (module) {
        return foreach(module.handled_ccs, function (value, key) {
            return _this.ccMap[value] = module;
        });
    });

    // Defines public API returned
    var api = {
        knob: {
            tempo: this.knobs.tempo,
            swing: this.knobs.swing,
            master: this.knobs.master
        },
        grid: { x: {} },
        touchstrip: this.touchstrip,
        lcd: new LCDs(midi_out.send_sysex),
        button: {
            '1/32t': this.control['1/32t'],
            '1/32': this.control['1/32'],
            '1/16t': this.control['1/16t'],
            '1/16': this.control['1/16'],
            '1/8t': this.control['1/8t'],
            '1/8': this.control['1/8'],
            '1/4t': this.control['1/4t'],
            '1/4': this.control['1/4']
        },
        channel: {},
        receive_midi: partial(receive_midi, this)
    };
    foreach(one_to_eight, function (number) {
        return api.channel[number] = { knob: _this.knobs[number], select: _this.control[number] };
    });
    foreach(one_to_eight, function (X) {
        api.grid.x[X] = { y: {}, select: _this.grid.select[X] };
        foreach(one_to_eight, function (Y) {
            api.grid.x[X].y[Y] = _this.grid.x[X].y[Y];
        });
    });
    foreach(buttons.names, function (button_name) {
        return api.button[button_name] = buttons[button_name];
    });
    return api;
}
util.inherits(Push, EventEmitter);

function handle_midi_cc(push, index, value) {
    if (index in push.ccMap) {
        push.ccMap[index].receive_midi_cc(index, value);
    } else {
        console.log('No known mapping for CC: ' + index);
    }
}

function handle_midi_note(push, note, velocity) {
    if (note in push.noteMap) {
        push.noteMap[note].receive_midi_note(note, velocity);
    } else {
        console.log('No known mapping for note: ' + note);
    }
}

function handle_midi_pitch_bend(push, lsb_byte, msb_byte) {
    push.touchstrip.receive_midi_pitch_bend((msb_byte << 7) + lsb_byte);
}

function handle_midi_poly_pressure(push, note, pressure) {
    push.grid.receive_midi_poly_pressure(note, pressure);
}

var midi_messages = {
    'note-off': 128, // note number, velocity
    'note-on': 144, // note number, velocity
    'poly-pressure': 160, // note number, velocity
    'cc': 176, // cc number, value
    'program-change': 192, // pgm number
    'channel-pressure': 208, // velocity
    'pitch-bend': 224, // lsb (7-bits), msb (7-bits)
    'sysex': 240 };

// Handles MIDI (CC) data from Push - causes events to be emitted
function receive_midi(push, bytes) {
    var message_type = bytes[0] & 0xf0;
    var midi_channel = bytes[0] & 0x0f;

    switch (message_type) {
        case midi_messages['cc']:
            handle_midi_cc(push, bytes[1], bytes[2]);
            break;
        case midi_messages['note-on']:
        case midi_messages['note-off']:
            handle_midi_note(push, bytes[1], bytes[2]);
            break;
        case midi_messages['pitch-bend']:
            handle_midi_pitch_bend(push, bytes[1], bytes[2]);
            break;
        case midi_messages['poly-pressure']:
            handle_midi_poly_pressure(push, bytes[1], bytes[2]);
            break;
    }
}

// Adaptor function used to bind to web MIDI API
Push.create_bound_to_web_midi_api = function (midiAccess) {
    var inputs = midiAccess.inputs.values(),
        outputs = midiAccess.outputs.values(),
        push;

    for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
        console.log('Found output: ' + output.value.name);
        if ('Ableton Push User Port' == output.value.name) {
            console.log('Binding MIDI output to ' + output.value.name);
            push = new Push(output.value);
            break;
        }
    }

    if (push === undefined) push = new Push({ send: function send(bytes) {} });

    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
        console.log('Found input: ' + input.value.name);
        if ('Ableton Push User Port' == input.value.name) {
            console.log('Binding MIDI input to ' + input.value.name);
            input.value.onmidimessage = function (event) {
                push.receive_midi(event.data);
            };
            break;
        }
    }

    return push;
};

module.exports = Push;

},{"./src/buttons.js":16,"./src/control-buttons.js":17,"./src/grid.js":18,"./src/knobs":19,"./src/lcds.js":20,"./src/touchstrip.js":21,"events":27,"lodash.foreach":9,"lodash.partial":13,"util":31}],16:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

var ccToButtonMap = {
    3: 'tap_tempo',
    9: 'metronome',
    119: 'undo',
    118: 'delete',
    117: 'double',
    116: 'quantize',
    90: 'fixed_length',
    89: 'automation',
    88: 'duplicate',
    87: 'new',
    86: 'rec',
    85: 'play',
    28: 'master',
    29: 'stop',
    44: 'left',
    45: 'right',
    46: 'up',
    47: 'down',
    114: 'volume',
    115: 'pan_&_send',
    112: 'track',
    113: 'clip',
    110: 'device',
    111: 'browse',
    62: 'step_in',
    63: 'step_out',
    60: 'mute',
    61: 'solo',
    58: 'scales',
    59: 'user',
    56: 'repeat',
    57: 'accent',
    54: 'octave_down',
    55: 'octave_up',
    52: 'add_effect',
    53: 'add_track',
    50: 'note',
    51: 'session',
    48: 'select',
    49: 'shift'
};
var handled_ccs = Object.keys(ccToButtonMap);

function Button(send_cc, cc) {
    EventEmitter.call(this);
    return {
        led_on: function led_on() {
            send_cc(cc, 4);
        },
        led_dim: function led_dim() {
            send_cc(cc, 1);
        },
        led_off: function led_off() {
            send_cc(cc, 0);
        },
        red: function red() {},
        orange: function orange() {},
        yellow: function yellow() {},
        green: function green() {},
        on: this.on,
        emit: this.emit
    };
}
util.inherits(Button, EventEmitter);

function Buttons(send_cc) {
    var _this = this;

    var buttons = this;
    foreach(ccToButtonMap, function (value, key) {
        return _this[value] = new Button(send_cc, parseInt(key));
    });
    this.names = Object.keys(ccToButtonMap).map(function (key) {
        return ccToButtonMap[key];
    });
    this.receive_midi_cc = function (index, value) {
        buttons[ccToButtonMap[index]].emit(pressed_or_released(value));
    };
    this.handled_ccs = handled_ccs;
}

function pressed_or_released(velocity) {
    return parseInt(velocity) > 0 ? 'pressed' : 'released';
}

module.exports = Buttons;

},{"events":27,"lodash.foreach":9,"util":31}],17:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

var ccToPadMap = {
    20: 1, // top row above grid
    21: 2,
    22: 3,
    23: 4,
    24: 5,
    25: 6,
    26: 7,
    27: 8,
    43: '1/32t',
    42: '1/32',
    41: '1/16t',
    40: '1/16',
    39: '1/8t',
    38: '1/8',
    37: '1/4t',
    36: '1/4'
};
var handled_ccs = Object.keys(ccToPadMap);

function Pad(send_cc, cc) {
    EventEmitter.call(this);
    this.output = function (value) {
        send_cc(cc, value);
    };
    var colours = [7, 10]; // dim, bright
    this.colours = [7, 10]; // dim, bright
    return {
        led_on: function led_on() {
            send_cc(cc, colours[1]);
        },
        led_dim: function led_dim() {
            send_cc(cc, colours[0]);
        },
        led_off: function led_off() {
            send_cc(cc, 0);
        },
        red: function red() {
            colours = [1, 4];
        },
        orange: function orange() {
            colours = [7, 10];
        },
        yellow: function yellow() {
            colours = [13, 16];
        },
        green: function green() {
            colours = [19, 22];
        },
        on: this.on,
        emit: this.emit
    };
}
util.inherits(Pad, EventEmitter);

function ControlButtons(send_cc) {
    var _this = this;

    var control_buttons = this;
    foreach(ccToPadMap, function (value, key) {
        return _this[value] = new Pad(send_cc, parseInt(key));
    });
    this.handled_ccs = handled_ccs;
    this.receive_midi_cc = function (cc, value) {
        var pad_name = ccToPadMap[cc];
        control_buttons[pad_name].emit(value > 0 ? 'pressed' : 'released');
    };
}

module.exports = ControlButtons;

},{"events":27,"lodash.foreach":9,"util":31}],18:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial');

var control_buttons = {
    102: 1,
    103: 2,
    104: 3,
    105: 4,
    106: 5,
    107: 6,
    108: 7,
    109: 8
};
var handled_ccs = Object.keys(control_buttons);

var handled_notes = [];
for (var i = 36; i <= 99; i++) {
    handled_notes.push(i);
}function GridButton(send_midi_message, send_sysex, note) {
    EventEmitter.call(this);
    this.note_out = function (velocity) {
        send_midi_message(note, velocity);
    };
    this.sysex_out = function (data) {
        send_sysex(data);
    };
    this.index = note < 102 ? note - 36 : note - 38;

    return {
        led_on: partial(led_on, this),
        led_off: partial(led_off, this),
        led_rgb: partial(led_rgb, this),
        on: this.on,
        emit: this.emit
    };
}
util.inherits(GridButton, EventEmitter);

function led_on(gridButton, value) {
    gridButton.note_out(value ? value : 100);
}
function led_off(gridButton) {
    gridButton.note_out(0);
}
function led_rgb(gridButton, r, g, b) {
    var msb = [r, g, b].map(function (x) {
        return (x & 240) >> 4;
    }),
        lsb = [r, g, b].map(function (x) {
        return x & 15;
    });
    gridButton.sysex_out([4, 0, 8, gridButton.index, 0, msb[0], lsb[0], msb[1], lsb[1], msb[2], lsb[2]]);
}

function Grid(send_note, send_cc, send_sysex) {
    var _this = this;

    this.x = {};
    this.select = {};
    for (var x = 1; x <= 8; x++) {
        this.x[x] = { y: {} };
        for (var y = 1; y <= 8; y++) {
            this.x[x].y[y] = new GridButton(send_note, send_sysex, x - 1 + (y - 1) * 8 + 36);
        }
    }

    foreach(control_buttons, function (value, key) {
        return _this.select[value] = new GridButton(send_cc, send_sysex, parseInt(key));
    });
    this.handled_ccs = handled_ccs;
    this.handled_notes = handled_notes;
    this.receive_midi_note = partial(receive_midi_note, this);
    this.receive_midi_cc = partial(receive_midi_cc, this);
    this.receive_midi_poly_pressure = partial(receive_midi_poly_pressure, this);
}

function receive_midi_note(grid, note, velocity) {
    var button = button_from_note(grid, note),
        vel = parseInt(velocity);
    vel > 0 ? button.emit('pressed', vel) : button.emit('released');
}

function receive_midi_cc(grid, index, value) {
    grid.select[control_buttons[index]].emit(value > 0 ? 'pressed' : 'released');
}

function receive_midi_poly_pressure(grid, note, pressure) {
    button_from_note(grid, note).emit('aftertouch', parseInt(pressure));
}

function button_from_note(grid, note) {
    var indexed_from_zero = note - 36,
        x = indexed_from_zero % 8 + 1,
        y = parseInt(indexed_from_zero / 8) + 1;
    return grid.x[x].y[y];
}

module.exports = Grid;

},{"events":27,"lodash.foreach":9,"lodash.partial":13,"util":31}],19:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial');

var knobMap = {
    'tempo': { 'cc': 14, 'note': 10 },
    'swing': { 'cc': 15, 'note': 9 },
    1: { 'cc': 71, 'note': 0 },
    2: { 'cc': 72, 'note': 1 },
    3: { 'cc': 73, 'note': 2 },
    4: { 'cc': 74, 'note': 3 },
    5: { 'cc': 75, 'note': 4 },
    6: { 'cc': 76, 'note': 5 },
    7: { 'cc': 77, 'note': 6 },
    8: { 'cc': 78, 'note': 7 },
    'master': { 'cc': 79, 'note': 8 }
};

var ccToKnobMap = {};
var noteToKnobMap = {};
foreach(knobMap, function (value, key) {
    ccToKnobMap[value.cc] = key;
    noteToKnobMap[value.note] = key;
});
var handled_ccs = Object.keys(ccToKnobMap),
    handled_notes = Object.keys(noteToKnobMap);

function Knob() {
    EventEmitter.call(this);
}
util.inherits(Knob, EventEmitter);

function Knobs() {
    var _this = this;

    foreach(knobMap, function (value, key) {
        return _this[key] = new Knob();
    });
    this.handled_ccs = handled_ccs;
    this.receive_midi_cc = partial(receive_midi_cc, this);
    this.receive_midi_note = partial(receive_midi_note, this);
    this.handled_notes = handled_notes;
}

function receive_midi_cc(knobs, index, value) {
    var knob_name = ccToKnobMap[index];
    var delta = value < 64 ? value : value - 128;
    knobs[knob_name].emit('turned', delta);
}

function receive_midi_note(knobs, note, velocity) {
    var knob_name = noteToKnobMap[note];
    var event_name = velocity > 0 ? 'pressed' : 'released';
    knobs[knob_name].emit(event_name);
}

module.exports = Knobs;

},{"events":27,"lodash.foreach":9,"lodash.partial":13,"util":31}],20:[function(require,module,exports){
'use strict';

var foreach = require('lodash.foreach'),
    one_to_eight = [1, 2, 3, 4, 5, 6, 7, 8],
    one_to_four = [1, 2, 3, 4],
    zero_to_seven = [0, 1, 2, 3, 4, 5, 6, 7],
    blank = 32;

function LCDSegment(lcds, update_row) {
    var lcd_segment = this;
    this.lcd_data = [blank, blank, blank, blank, blank, blank, blank, blank];

    this.update = function (text) {
        lcd_segment.lcd_data = lcd_data(String(text));
        update_row();
    };

    this.clear = function () {
        lcd_segment.lcd_data = lcd_data(String(''));
        update_row();
    };
}

function lcd_data(text) {
    return zero_to_seven.map(function (index) {
        return text.length > index ? text.charCodeAt(index) : blank;
    });
}

function LCDs(send_sysex) {
    var lcds = this;
    var update_row = function update_row(row_number) {
        var display_data = [];
        foreach(one_to_eight, function (channel) {
            display_data = display_data.concat(lcds.x[channel].y[row_number].lcd_data);
            if (channel % 2 == 1) display_data.push(blank);
        });
        send_sysex([28 - row_number].concat([0, 69, 0]).concat(display_data));
    };

    this.clear = function () {
        foreach(one_to_eight, function (x) {
            lcds.x[x] = { y: {} };
            foreach(one_to_four, function (y) {
                lcds.x[x].y[y] = new LCDSegment(lcds, function () {
                    return update_row(y);
                });
            });
        });

        foreach(one_to_four, function (row) {
            return update_row(row);
        });
    };

    this.x = {};

    this.clear();

    this.x[8].y[4].update(' powered');
    this.x[8].y[3].update('      by');
    this.x[8].y[2].update('   push-');
    this.x[8].y[1].update(' wrapper');

    foreach(one_to_four, function (row) {
        return update_row(row);
    });
}

module.exports = LCDs;

},{"lodash.foreach":9}],21:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    partial = require('lodash.partial'),
    handled_notes = [12];

function TouchStrip() {
    EventEmitter.call(this);
    this.receive_midi_pitch_bend = partial(receive_midi_pitch_bend, this);
    this.receive_midi_note = partial(receive_midi_note, this);
    this.handled_notes = handled_notes;
}
util.inherits(TouchStrip, EventEmitter);

function receive_midi_pitch_bend(touchstrip, fourteen_bit_value) {
    if (fourteen_bit_value == 8192) return;
    touchstrip.emit('pitchbend', fourteen_bit_value);
}

function receive_midi_note(touchstrip, note, velocity) {
    if (velocity > 0) {
        touchstrip.emit('pressed');
    } else {
        touchstrip.emit('released');
        touchstrip.emit('pitchbend', 8192);
    }
}

module.exports = TouchStrip;

},{"events":27,"lodash.partial":13,"util":31}],22:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

function BPM(initial) {
    EventEmitter.call(this);
    var bpm = this;

    this.current = clip(initial) ? clip(initial) : 120;

    this.report = function () {
        bpm.emit('changed', bpm);
    };
    this.change_by = function (amount) {
        bpm.current = clip(bpm.current + amount);
        bpm.report();
    };
}
util.inherits(BPM, EventEmitter);

function clip(bpm) {
    return bpm < 20 ? 20 : bpm > 300 ? 300 : bpm;
}

module.exports = BPM;

},{"events":27,"lodash.foreach":9,"util":31}],23:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

function Interval(bpm, multiplier, value) {
    EventEmitter.call(this);
    var interval = this;

    this.value = value;
    this.report = function () {
        interval.emit('changed', 60 / bpm.current * multiplier * 1000);
    };

    bpm.on('changed', interval.report);
}
util.inherits(Interval, EventEmitter);

module.exports = {
    '4n': function n(bpm, name) {
        return new Interval(bpm, 1, name ? name : '4n');
    },
    '4nt': function nt(bpm, name) {
        return new Interval(bpm, 2 / 3, name ? name : '4nt');
    },
    '8n': function n(bpm, name) {
        return new Interval(bpm, 0.5, name ? name : '8n');
    },
    '8nt': function nt(bpm, name) {
        return new Interval(bpm, 1 / 3, name ? name : '8nt');
    },
    '16n': function n(bpm, name) {
        return new Interval(bpm, 0.25, name ? name : '16n');
    },
    '16nt': function nt(bpm, name) {
        return new Interval(bpm, 1 / 6, name ? name : '16nt');
    },
    '32n': function n(bpm, name) {
        return new Interval(bpm, 0.125, name ? name : '32n');
    },
    '32nt': function nt(bpm, name) {
        return new Interval(bpm, 1 / 12, name ? name : '32nt');
    }
};

},{"events":27,"lodash.foreach":9,"util":31}],24:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    foreach = require('lodash.foreach');

function Player(asset_url, audio_context) {
    var _this = this;

    EventEmitter.call(this);
    var player = this;

    this.play = function (velocity, cutoff_frequency) {
        play(player, audio_context, velocity, cutoff_frequency);
    };

    this.update_playback_rate = function (rate) {
        update_playback_rate(player, audio_context, rate);
    };

    this._loaded = false;
    this._voices = [];
    this._playback_rate = 1;
    loadSample(asset_url, audio_context, function (buffer) {
        _this._buffer = buffer;
        _this._loaded = true;
    });
}
util.inherits(Player, EventEmitter);

function loadSample(asset_url, audio_context, done) {
    var request = new XMLHttpRequest();
    request.open('GET', asset_url, true);
    request.responseType = 'arraybuffer';
    request.onload = function () {
        audio_context.decodeAudioData(request.response, done);
    };
    request.send();
}

function play(player, audio_context, velocity, cutoff_frequency) {
    if (!player._loaded) return;

    var now = time_now(audio_context);

    if (is_playing(player)) {
        foreach(player._voices, function (voice) {
            voice.gain.cancelScheduledValues(now);
            anchor(voice.gain, now);
            voice.gain.linearRampToValueAtTime(0, now + 0.01);
        });
        player.emit('stopped');
    }

    var gain_node = audio_context.createGain();
    var filter_node = audio_context.createBiquadFilter();
    filter_node.frequency.value = cutoff_frequency > 30 ? cutoff_frequency : 30;
    var source = audio_context.createBufferSource();

    source.connect(filter_node);
    filter_node.connect(gain_node);

    gain_node.connect(audio_context.destination);

    gain_node.gain.setValueAtTime(0, now);
    gain_node.gain.linearRampToValueAtTime(velocity / 127, now + 0.01);

    source.playbackRate.setValueAtTime(player._playback_rate, now);
    source.buffer = player._buffer;

    source.addEventListener('ended', function () {
        player._voices.shift();
        if (!is_playing(player)) player.emit('stopped');
    });

    player._voices.push({ source: source, gain: gain_node.gain });
    source.start();
    player.emit('started', velocity);
}

function anchor(audio_param, now) {
    audio_param.setValueAtTime(audio_param.value, now);
}

function is_playing(player) {
    return player._voices.length > 0;
}

function update_playback_rate(player, audio_context, rate) {
    player._playback_rate = rate;
    var now = time_now(audio_context);
    foreach(player._voices, function (voice) {
        voice.source.playbackRate.setValueAtTime(player._playback_rate, now);
    });
}

function time_now(audio_context) {
    return audio_context.currentTime;
}

module.exports = Player;

},{"events":27,"lodash.foreach":9,"util":31}],25:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util');
/*
Repeatedly calls the passed callback at the specified interval until told to stop
*/
function Repeater(scheduled_execution, initial_interval) {
    EventEmitter.call(this);
    var repeater = this;
    this._is_scheduling = false;
    this._interval = initial_interval > 20 ? initial_interval : 500; // ms

    this.interval = function (amount_ms) {
        repeater._interval = amount_ms > 20 ? amount_ms : 20; // 20ms min interval
        repeater.report_interval();
    };

    this.start = function (callback) {
        if (repeater._is_scheduling) return;
        repeater._is_scheduling = true;
        repeater._call_and_reschedule(callback);
    };

    this._call_and_reschedule = function (callback) {
        if (repeater._is_scheduling) {
            callback();
            scheduled_execution(function () {
                return repeater._call_and_reschedule(callback);
            }, repeater._interval);
        };
    };

    this.stop = function () {
        repeater._is_scheduling = false;
    };

    this.report_interval = function () {
        repeater.emit('interval', repeater._interval);
    };
}
util.inherits(Repeater, EventEmitter);

// Adaptor function used to bind to web Audio API and utilise its audio-rate scheduling
Repeater.create_scheduled_by_audio_context = function (context, initial_interval) {
    return new Repeater(function (callback, interval_ms) {
        var source = context.createBufferSource(),
            now = context.currentTime,
            thousandth = context.sampleRate / 1000,
            scheduled_at = now + interval_ms / 1000;
        // a buffer length of 1 sample doesn't work on IOS, so use 1/1000th of a second
        var buffer = context.createBuffer(1, thousandth, context.sampleRate);
        source.addEventListener('ended', callback);
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(scheduled_at);
    }, initial_interval);
};

module.exports = Repeater;

},{"events":27,"util":31}],26:[function(require,module,exports){
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    Repeater = require('./repeater.js');

function Repetae(repeater, initial_interval) {
    EventEmitter.call(this);
    var repetae = this;
    this._active = false;
    this._time_changed = false;
    this._being_pressed = false;
    this._current_interval = initial_interval;

    repetae._current_interval.on('changed', repeater.interval);
    repetae._current_interval.report();

    this.press = function () {
        repetae._being_pressed = true;
    };

    this.release = function () {
        var started_active = repetae._active,
            time_changed = repetae._time_changed;

        repetae._time_changed = false;
        repetae._being_pressed = false;

        switch (true) {
            case !started_active:
                repetae._active = true;
                repetae.emit('on');
                break;
            case started_active && !time_changed:
                repetae._active = false;
                repetae.emit('off');
                break;
        }
    };

    this.interval = function (new_interval) {
        if (repetae._being_pressed) {
            repetae._time_changed = true;
            repetae._current_interval.removeListener('changed', repeater.interval);
            repetae._current_interval = new_interval;
            repetae._current_interval.on('changed', repeater.interval);
            repetae.report_interval();
            repetae._current_interval.report();
        }
    };

    this.start = function (callback) {
        if (!repetae._active) {
            callback();
            return;
        }
        repeater.start(callback);
    };

    this.stop = repeater.stop;
    this.report_interval = function () {
        repetae.emit('interval', repetae._current_interval.value);
    };
}
util.inherits(Repetae, EventEmitter);

module.exports = Repetae;

},{"./repeater.js":25,"events":27,"util":31}],27:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],28:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],29:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
  try {
    cachedSetTimeout = setTimeout;
  } catch (e) {
    cachedSetTimeout = function () {
      throw new Error('setTimeout is not defined');
    }
  }
  try {
    cachedClearTimeout = clearTimeout;
  } catch (e) {
    cachedClearTimeout = function () {
      throw new Error('clearTimeout is not defined');
    }
  }
} ())
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = cachedSetTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    cachedClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        cachedSetTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],30:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],31:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./support/isBuffer":30,"_process":29,"inherits":28}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL25wbS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImFwcC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2FycmF5ZWFjaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2Jhc2VlYWNoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fYmluZGNhbGxiYWNrL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fY3JlYXRld3JhcHBlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX2dldG5hdGl2ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guX3JlcGxhY2Vob2xkZXJzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5fcm9vdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guZm9yZWFjaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guaXNhcmd1bWVudHMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmlzYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmtleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLnBhcnRpYWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLnJlc3RwYXJhbS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wdXNoLXdyYXBwZXIvcHVzaC5qcyIsIm5vZGVfbW9kdWxlcy9wdXNoLXdyYXBwZXIvc3JjL2J1dHRvbnMuanMiLCJub2RlX21vZHVsZXMvcHVzaC13cmFwcGVyL3NyYy9jb250cm9sLWJ1dHRvbnMuanMiLCJub2RlX21vZHVsZXMvcHVzaC13cmFwcGVyL3NyYy9ncmlkLmpzIiwibm9kZV9tb2R1bGVzL3B1c2gtd3JhcHBlci9zcmMva25vYnMuanMiLCJub2RlX21vZHVsZXMvcHVzaC13cmFwcGVyL3NyYy9sY2RzLmpzIiwibm9kZV9tb2R1bGVzL3B1c2gtd3JhcHBlci9zcmMvdG91Y2hzdHJpcC5qcyIsInNyYy9icG0uanMiLCJzcmMvaW50ZXJ2YWwuanMiLCJzcmMvcGxheWVyLmpzIiwic3JjL3JlcGVhdGVyLmpzIiwic3JjL3JlcGV0YWUuanMiLCIuLi8uLi9ucG0vbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiLi4vLi4vbnBtL2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvaW5oZXJpdHMvaW5oZXJpdHNfYnJvd3Nlci5qcyIsIi4uLy4uL25wbS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi4uLy4uL25wbS9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvc3VwcG9ydC9pc0J1ZmZlckJyb3dzZXIuanMiLCIuLi8uLi9ucG0vbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0FBLElBQU0sT0FBTyxRQUFRLGNBQVIsQ0FBYjtBQUFBLElBQ0ksVUFBVSxRQUFRLGdCQUFSLENBRGQ7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkO0FBQUEsSUFHSSxTQUFTLFFBQVEsaUJBQVIsQ0FIYjtBQUFBLElBSUksVUFBVSxPQUFPLFlBQVAsR0FBc0IsSUFBSSxPQUFPLFlBQVgsRUFBdEIsR0FBa0QsSUFBSSxPQUFPLGtCQUFYLEVBSmhFO0FBQUEsSUFLSSxVQUFVLFFBQVEsa0JBQVIsQ0FMZDtBQUFBLElBTUksV0FBVyxRQUFRLG1CQUFSLENBTmY7QUFBQSxJQU9JLE1BQU0sUUFBUSxjQUFSLENBUFY7QUFBQSxJQVFJLE1BQU0sSUFBSSxHQUFKLENBQVEsR0FBUixDQVJWO0FBQUEsSUFTSSxXQUFXLFFBQVEsbUJBQVIsQ0FUZjtB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNucUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25QQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuRUE7O0FBRUEsSUFBTSxlQUFlLFFBQVEsUUFBUixDQUFyQjtBQUFBLElBQ0ksT0FBTyxRQUFRLE1BQVIsQ0FEWDtBQUFBLElBRUksVUFBVSxRQUFRLGtCQUFSLENBRmQ7QUFBQSxJQUdJLFFBQVEsUUFBUSxhQUFSLENBSFo7QUFBQSxJQUlJLE9BQU8sUUFBUSxlQUFSLENBSlg7QUFBQSxJQUtJLGFBQWEsUUFBUSxxQkFBUixDQUxqQjtBQUFBLElBTUksaUJBQWlCLFFBQVEsMEJBQVIsQ0FOckI7QUFBQSxJQU9JLE9BQU8sUUFBUSxlQUFSLENBUFg7QUFBQSxJQVFJLFVBQVUsUUFBUSxnQkFBUixDQVJkO0FBQUEsSUFTSSxVQUFVLFFBQVEsZ0JBQVIsQ0FUZDtBQUFBLElBVUksZUFBZSxDQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sQ0FBUCxFQUFVLENBQVYsRUFBYSxDQUFiLEVBQWdCLENBQWhCLEVBQW1CLENBQW5CLEVBQXNCLENBQXRCLENBVm5COztBQVlBLFNBQVMsSUFBVCxDQUFjLGFBQWQsRUFBNkI7QUFBQTs7QUFDekIsaUJBQWEsSUFBYixDQUFrQixJQUFsQjs7QUFFQSxRQUFJLFdBQVc7QUFDWCxpQkFBUyxpQkFBUyxFQUFULEVBQWEsS0FBYixFQUFvQjtBQUFFLDBCQUFjLElBQWQsQ0FBbUIsQ0FBQyxHQUFELEVBQU0sRUFBTixFQUFVLEtBQVYsQ0FBbkI7QUFBc0MsU0FEMUQ7QUFFWCxtQkFBVyxtQkFBUyxJQUFULEVBQWUsUUFBZixFQUF5QjtBQUFFLDBCQUFjLElBQWQsQ0FBbUIsQ0FBQyxHQUFELEVBQU0sSUFBTixFQUFZLFFBQVosQ0FBbkI7QUFBMkMsU0FGdEU7QUFHWCxvQkFBWSxvQkFBUyxJQUFULEVBQWU7QUFBRSwwQkFBYyxJQUFkLENBQW1CLENBQUMsR0FBRCxFQUFNLEVBQU4sRUFBVSxHQUFWLEVBQWUsRUFBZixFQUFtQixNQUFuQixDQUEwQixJQUExQixFQUFnQyxNQUFoQyxDQUF1QyxDQUFDLEdBQUQsQ0FBdkMsQ0FBbkI7QUFBbUU7QUFIckYsS0FBZjs7QUFNQSxRQUFNLFVBQVUsSUFBSSxPQUFKLENBQVksU0FBUyxPQUFyQixDQUFoQjtBQUNBLFNBQUssS0FBTCxHQUFhLElBQUksS0FBSixFQUFiO0FBQ0EsU0FBSyxJQUFMLEdBQVksSUFBSSxJQUFKLENBQVMsU0FBUyxTQUFsQixFQUE2QixTQUFTLE9BQXRDLEVBQStDLFNBQVMsVUFBeEQsQ0FBWjtBQUNBLFNBQUssVUFBTCxHQUFrQixJQUFJLFVBQUosRUFBbEI7QUFDQSxTQUFLLE9BQUwsR0FBZSxJQUFJLGNBQUosQ0FBbUIsU0FBUyxPQUE1QixDQUFmO0FBQ0EsU0FBSyxLQUFMLEdBQWEsRUFBYjtBQUNBLFNBQUssT0FBTCxHQUFlLEVBQWY7O0FBRUEsWUFDSSxDQUFDLEtBQUssS0FBTixFQUFhLEtBQUssVUFBbEIsRUFBOEIsS0FBSyxJQUFuQyxDQURKLEVBRUksVUFBQyxNQUFEO0FBQUEsZUFBWSxRQUFRLE9BQU8sYUFBZixFQUE4QixVQUFDLEtBQUQsRUFBUSxHQUFSO0FBQUEsbUJBQWdCLE1BQUssT0FBTCxDQUFhLEtBQWIsSUFBc0IsTUFBdEM7QUFBQSxTQUE5QixDQUFaO0FBQUEsS0FGSjs7QUFLQSxZQUNJLENBQUMsS0FBSyxLQUFOLEVBQWEsS0FBSyxPQUFsQixFQUEyQixPQUEzQixFQUFvQyxLQUFLLElBQXpDLENBREosRUFFSSxVQUFDLE1BQUQ7QUFBQSxlQUFZLFFBQVEsT0FBTyxXQUFmLEVBQTRCLFVBQUMsS0FBRCxFQUFRLEdBQVI7QUFBQSxtQkFBZ0IsTUFBSyxLQUFMLENBQVcsS0FBWCxJQUFvQixNQUFwQztBQUFBLFNBQTVCLENBQVo7QUFBQSxLQUZKOztBQUtBO0FBQ0EsUUFBTSxNQUFNO0FBQ1IsY0FBTTtBQUNGLG1CQUFPLEtBQUssS0FBTCxDQUFXLEtBRGhCO0FBRUYsbUJBQU8sS0FBSyxLQUFMLENBQVcsS0FGaEI7QUFHRixvQkFBUSxLQUFLLEtBQUwsQ0FBVztBQUhqQixTQURFO0FBTVIsY0FBTSxFQUFFLEdBQUcsRUFBTCxFQU5FO0FBT1Isb0JBQVksS0FBSyxVQVBUO0FBUVIsYUFBSyxJQUFJLElBQUosQ0FBUyxTQUFTLFVBQWxCLENBUkc7QUFTUixnQkFBUTtBQUNKLHFCQUFTLEtBQUssT0FBTCxDQUFhLE9BQWIsQ0FETDtBQUVKLG9CQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FGSjtBQUdKLHFCQUFTLEtBQUssT0FBTCxDQUFhLE9BQWIsQ0FITDtBQUlKLG9CQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FKSjtBQUtKLG9CQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FMSjtBQU1KLG1CQUFPLEtBQUssT0FBTCxDQUFhLEtBQWIsQ0FOSDtBQU9KLG9CQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FQSjtBQVFKLG1CQUFPLEtBQUssT0FBTCxDQUFhLEtBQWI7QUFSSCxTQVRBO0FBbUJSLGlCQUFTLEVBbkJEO0FBb0JSLHNCQUFjLFFBQVEsWUFBUixFQUFzQixJQUF0QjtBQXBCTixLQUFaO0FBc0JBLFlBQ0ksWUFESixFQUVJLFVBQUMsTUFBRDtBQUFBLGVBQVksSUFBSSxPQUFKLENBQVksTUFBWixJQUFzQixFQUFFLE1BQU0sTUFBSyxLQUFMLENBQVcsTUFBWCxDQUFSLEVBQTRCLFFBQVEsTUFBSyxPQUFMLENBQWEsTUFBYixDQUFwQyxFQUFsQztBQUFBLEtBRko7QUFJQSxZQUNJLFlBREosRUFFSSxVQUFDLENBQUQsRUFBTztBQUNILFlBQUksSUFBSixDQUFTLENBQVQsQ0FBVyxDQUFYLElBQWdCLEVBQUUsR0FBRyxFQUFMLEVBQVMsUUFBUSxNQUFLLElBQUwsQ0FBVSxNQUFWLENBQWlCLENBQWpCLENBQWpCLEVBQWhCO0FBQ0EsZ0JBQVEsWUFBUixFQUFzQixVQUFDLENBQUQsRUFBTztBQUN6QixnQkFBSSxJQUFKLENBQVMsQ0FBVCxDQUFXLENBQVgsRUFBYyxDQUFkLENBQWdCLENBQWhCLElBQXFCLE1BQUssSUFBTCxDQUFVLENBQVYsQ0FBWSxDQUFaLEVBQWUsQ0FBZixDQUFpQixDQUFqQixDQUFyQjtBQUNILFNBRkQ7QUFHSCxLQVBMO0FBU0EsWUFDSSxRQUFRLEtBRFosRUFFSSxVQUFDLFdBQUQ7QUFBQSxlQUFpQixJQUFJLE1BQUosQ0FBVyxXQUFYLElBQTBCLFFBQVEsV0FBUixDQUEzQztBQUFBLEtBRko7QUFJQSxXQUFPLEdBQVA7QUFDSDtBQUNELEtBQUssUUFBTCxDQUFjLElBQWQsRUFBb0IsWUFBcEI7O0FBRUEsU0FBUyxjQUFULENBQXdCLElBQXhCLEVBQThCLEtBQTlCLEVBQXFDLEtBQXJDLEVBQTRDO0FBQ3hDLFFBQUksU0FBUyxLQUFLLEtBQWxCLEVBQXlCO0FBQ3JCLGFBQUssS0FBTCxDQUFXLEtBQVgsRUFBa0IsZUFBbEIsQ0FBa0MsS0FBbEMsRUFBeUMsS0FBekM7QUFDSCxLQUZELE1BRU87QUFDSCxnQkFBUSxHQUFSLENBQVksOEJBQThCLEtBQTFDO0FBQ0g7QUFDSjs7QUFFRCxTQUFTLGdCQUFULENBQTBCLElBQTFCLEVBQWdDLElBQWhDLEVBQXNDLFFBQXRDLEVBQWdEO0FBQzVDLFFBQUksUUFBUSxLQUFLLE9BQWpCLEVBQTBCO0FBQ3RCLGFBQUssT0FBTCxDQUFhLElBQWIsRUFBbUIsaUJBQW5CLENBQXFDLElBQXJDLEVBQTJDLFFBQTNDO0FBQ0gsS0FGRCxNQUVPO0FBQ0gsZ0JBQVEsR0FBUixDQUFZLGdDQUFnQyxJQUE1QztBQUNIO0FBQ0o7O0FBRUQsU0FBUyxzQkFBVCxDQUFnQyxJQUFoQyxFQUFzQyxRQUF0QyxFQUFnRCxRQUFoRCxFQUEwRDtBQUN0RCxTQUFLLFVBQUwsQ0FBZ0IsdUJBQWhCLENBQXdDLENBQUMsWUFBWSxDQUFiLElBQWtCLFFBQTFEO0FBQ0g7O0FBRUQsU0FBUyx5QkFBVCxDQUFtQyxJQUFuQyxFQUF5QyxJQUF6QyxFQUErQyxRQUEvQyxFQUF5RDtBQUNyRCxTQUFLLElBQUwsQ0FBVSwwQkFBVixDQUFxQyxJQUFyQyxFQUEyQyxRQUEzQztBQUNIOztBQUVELElBQUksZ0JBQWdCO0FBQ2hCLGdCQUFZLEdBREksRUFDQztBQUNqQixlQUFXLEdBRkssRUFFQTtBQUNoQixxQkFBaUIsR0FIRCxFQUdNO0FBQ3RCLFVBQU0sR0FKVSxFQUlMO0FBQ1gsc0JBQWtCLEdBTEYsRUFLTztBQUN2Qix3QkFBb0IsR0FOSixFQU1TO0FBQ3pCLGtCQUFjLEdBUEUsRUFPRztBQUNuQixhQUFTLEdBUk8sRUFBcEI7O0FBV0E7QUFDQSxTQUFTLFlBQVQsQ0FBc0IsSUFBdEIsRUFBNEIsS0FBNUIsRUFBbUM7QUFDL0IsUUFBSSxlQUFlLE1BQU0sQ0FBTixJQUFXLElBQTlCO0FBQ0EsUUFBSSxlQUFlLE1BQU0sQ0FBTixJQUFXLElBQTlCOztBQUVBLFlBQVEsWUFBUjtBQUNJLGFBQU0sY0FBYyxJQUFkLENBQU47QUFDSSwyQkFBZSxJQUFmLEVBQXFCLE1BQU0sQ0FBTixDQUFyQixFQUErQixNQUFNLENBQU4sQ0FBL0I7QUFDQTtBQUNKLGFBQU0sY0FBYyxTQUFkLENBQU47QUFDQSxhQUFNLGNBQWMsVUFBZCxDQUFOO0FBQ0ksNkJBQWlCLElBQWpCLEVBQXVCLE1BQU0sQ0FBTixDQUF2QixFQUFpQyxNQUFNLENBQU4sQ0FBakM7QUFDQTtBQUNKLGFBQU0sY0FBYyxZQUFkLENBQU47QUFDSSxtQ0FBdUIsSUFBdkIsRUFBNkIsTUFBTSxDQUFOLENBQTdCLEVBQXVDLE1BQU0sQ0FBTixDQUF2QztBQUNBO0FBQ0osYUFBSyxjQUFjLGVBQWQsQ0FBTDtBQUNJLHNDQUEwQixJQUExQixFQUFnQyxNQUFNLENBQU4sQ0FBaEMsRUFBMEMsTUFBTSxDQUFOLENBQTFDO0FBQ0E7QUFiUjtBQWVIOztBQUVEO0FBQ0EsS0FBSyw0QkFBTCxHQUFvQyxVQUFTLFVBQVQsRUFBcUI7QUFDckQsUUFBSSxTQUFTLFdBQVcsTUFBWCxDQUFrQixNQUFsQixFQUFiO0FBQUEsUUFDSSxVQUFVLFdBQVcsT0FBWCxDQUFtQixNQUFuQixFQURkO0FBQUEsUUFFSSxJQUZKOztBQUlBLFNBQUssSUFBSSxTQUFTLFFBQVEsSUFBUixFQUFsQixFQUFrQyxVQUFVLENBQUMsT0FBTyxJQUFwRCxFQUEwRCxTQUFTLFFBQVEsSUFBUixFQUFuRSxFQUFtRjtBQUMvRSxnQkFBUSxHQUFSLENBQVksbUJBQW1CLE9BQU8sS0FBUCxDQUFhLElBQTVDO0FBQ0EsWUFBSSw0QkFBNEIsT0FBTyxLQUFQLENBQWEsSUFBN0MsRUFBbUQ7QUFDL0Msb0JBQVEsR0FBUixDQUFZLDRCQUE0QixPQUFPLEtBQVAsQ0FBYSxJQUFyRDtBQUNBLG1CQUFPLElBQUksSUFBSixDQUFTLE9BQU8sS0FBaEIsQ0FBUDtBQUNBO0FBQ0g7QUFDSjs7QUFFRCxRQUFJLFNBQVMsU0FBYixFQUF3QixPQUFPLElBQUksSUFBSixDQUFTLEVBQUUsTUFBTSxjQUFDLEtBQUQsRUFBVyxDQUFrQyxDQUFyRCxFQUFULENBQVA7O0FBRXhCLFNBQUssSUFBSSxRQUFRLE9BQU8sSUFBUCxFQUFqQixFQUFnQyxTQUFTLENBQUMsTUFBTSxJQUFoRCxFQUFzRCxRQUFRLE9BQU8sSUFBUCxFQUE5RCxFQUE2RTtBQUN6RSxnQkFBUSxHQUFSLENBQVksa0JBQWtCLE1BQU0sS0FBTixDQUFZLElBQTFDO0FBQ0EsWUFBSSw0QkFBNEIsTUFBTSxLQUFOLENBQVksSUFBNUMsRUFBa0Q7QUFDOUMsb0JBQVEsR0FBUixDQUFZLDJCQUEyQixNQUFNLEtBQU4sQ0FBWSxJQUFuRDtBQUNBLGtCQUFNLEtBQU4sQ0FBWSxhQUFaLEdBQTRCLFVBQUMsS0FBRCxFQUFXO0FBQUUscUJBQUssWUFBTCxDQUFrQixNQUFNLElBQXhCO0FBQStCLGFBQXhFO0FBQ0E7QUFDSDtBQUNKOztBQUVELFdBQU8sSUFBUDtBQUNILENBMUJEOztBQTRCQSxPQUFPLE9BQVAsR0FBaUIsSUFBakI7Ozs7O0FDM0tBLElBQU0sZUFBZSxRQUFRLFFBQVIsQ0FBckI7QUFBQSxJQUNJLE9BQU8sUUFBUSxNQUFSLENBRFg7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkOztBQUlBLElBQUksZ0JBQWdCO0FBQ2hCLE9BQUcsV0FEYTtBQUVoQixPQUFHLFdBRmE7QUFHaEIsU0FBSyxNQUhXO0FBSWhCLFNBQUssUUFKVztBQUtoQixTQUFLLFFBTFc7QUFNaEIsU0FBSyxVQU5XO0FBT2hCLFFBQUksY0FQWTtBQVFoQixRQUFJLFlBUlk7QUFTaEIsUUFBSSxXQVRZO0FBVWhCLFFBQUksS0FWWTtBQVdoQixRQUFJLEtBWFk7QUFZaEIsUUFBSSxNQVpZO0FBYWhCLFFBQUksUUFiWTtBQWNoQixRQUFJLE1BZFk7QUFlaEIsUUFBSSxNQWZZO0FBZ0JoQixRQUFJLE9BaEJZO0FBaUJoQixRQUFJLElBakJZO0FBa0JoQixRQUFJLE1BbEJZO0FBbUJoQixTQUFLLFFBbkJXO0FBb0JoQixTQUFLLFlBcEJXO0FBcUJoQixTQUFLLE9BckJXO0FBc0JoQixTQUFLLE1BdEJXO0FBdUJoQixTQUFLLFFBdkJXO0FBd0JoQixTQUFLLFFBeEJXO0FBeUJoQixRQUFJLFNBekJZO0FBMEJoQixRQUFJLFVBMUJZO0FBMkJoQixRQUFJLE1BM0JZO0FBNEJoQixRQUFJLE1BNUJZO0FBNkJoQixRQUFJLFFBN0JZO0FBOEJoQixRQUFJLE1BOUJZO0FBK0JoQixRQUFJLFFBL0JZO0FBZ0NoQixRQUFJLFFBaENZO0FBaUNoQixRQUFJLGFBakNZO0FBa0NoQixRQUFJLFdBbENZO0FBbUNoQixRQUFJLFlBbkNZO0FBb0NoQixRQUFJLFdBcENZO0FBcUNoQixRQUFJLE1BckNZO0FBc0NoQixRQUFJLFNBdENZO0FBdUNoQixRQUFJLFFBdkNZO0FBd0NoQixRQUFJO0FBeENZLENBQXBCO0FBMENBLElBQU0sY0FBYyxPQUFPLElBQVAsQ0FBWSxhQUFaLENBQXBCOztBQUVBLFNBQVMsTUFBVCxDQUFnQixPQUFoQixFQUF5QixFQUF6QixFQUE2QjtBQUN6QixpQkFBYSxJQUFiLENBQWtCLElBQWxCO0FBQ0EsV0FBTztBQUNILGdCQUFRLGtCQUFXO0FBQUUsb0JBQVEsRUFBUixFQUFZLENBQVo7QUFBZ0IsU0FEbEM7QUFFSCxpQkFBUyxtQkFBVztBQUFFLG9CQUFRLEVBQVIsRUFBWSxDQUFaO0FBQWdCLFNBRm5DO0FBR0gsaUJBQVMsbUJBQVc7QUFBRSxvQkFBUSxFQUFSLEVBQVksQ0FBWjtBQUFnQixTQUhuQztBQUlILGFBQUssZUFBTSxDQUFFLENBSlY7QUFLSCxnQkFBUSxrQkFBTSxDQUFFLENBTGI7QUFNSCxnQkFBUSxrQkFBTSxDQUFFLENBTmI7QUFPSCxlQUFPLGlCQUFNLENBQUUsQ0FQWjtBQVFILFlBQUksS0FBSyxFQVJOO0FBU0gsY0FBTSxLQUFLO0FBVFIsS0FBUDtBQVdIO0FBQ0QsS0FBSyxRQUFMLENBQWMsTUFBZCxFQUFzQixZQUF0Qjs7QUFFQSxTQUFTLE9BQVQsQ0FBaUIsT0FBakIsRUFBMEI7QUFBQTs7QUFDdEIsUUFBTSxVQUFVLElBQWhCO0FBQ0EsWUFBUSxhQUFSLEVBQXVCLFVBQUMsS0FBRCxFQUFRLEdBQVI7QUFBQSxlQUFnQixNQUFLLEtBQUwsSUFBYyxJQUFJLE1BQUosQ0FBVyxPQUFYLEVBQW9CLFNBQVMsR0FBVCxDQUFwQixDQUE5QjtBQUFBLEtBQXZCO0FBQ0EsU0FBSyxLQUFMLEdBQWEsT0FBTyxJQUFQLENBQVksYUFBWixFQUEyQixHQUEzQixDQUErQixVQUFDLEdBQUQsRUFBUztBQUFFLGVBQU8sY0FBYyxHQUFkLENBQVA7QUFBMkIsS0FBckUsQ0FBYjtBQUNBLFNBQUssZUFBTCxHQUF1QixVQUFTLEtBQVQsRUFBZ0IsS0FBaEIsRUFBdUI7QUFDMUMsZ0JBQVEsY0FBYyxLQUFkLENBQVIsRUFBOEIsSUFBOUIsQ0FBbUMsb0JBQW9CLEtBQXBCLENBQW5DO0FBQ0gsS0FGRDtBQUdBLFNBQUssV0FBTCxHQUFtQixXQUFuQjtBQUNIOztBQUVELFNBQVMsbUJBQVQsQ0FBNkIsUUFBN0IsRUFBdUM7QUFDbkMsV0FBTyxTQUFTLFFBQVQsSUFBcUIsQ0FBckIsR0FBeUIsU0FBekIsR0FBcUMsVUFBNUM7QUFDSDs7QUFFRCxPQUFPLE9BQVAsR0FBaUIsT0FBakI7Ozs7O0FDOUVBLElBQU0sZUFBZSxRQUFRLFFBQVIsQ0FBckI7QUFBQSxJQUNJLE9BQU8sUUFBUSxNQUFSLENBRFg7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkOztBQUlBLElBQUksYUFBYTtBQUNiLFFBQUksQ0FEUyxFQUNOO0FBQ1AsUUFBSSxDQUZTO0FBR2IsUUFBSSxDQUhTO0FBSWIsUUFBSSxDQUpTO0FBS2IsUUFBSSxDQUxTO0FBTWIsUUFBSSxDQU5TO0FBT2IsUUFBSSxDQVBTO0FBUWIsUUFBSSxDQVJTO0FBU2IsUUFBSSxPQVRTO0FBVWIsUUFBSSxNQVZTO0FBV2IsUUFBSSxPQVhTO0FBWWIsUUFBSSxNQVpTO0FBYWIsUUFBSSxNQWJTO0FBY2IsUUFBSSxLQWRTO0FBZWIsUUFBSSxNQWZTO0FBZ0JiLFFBQUk7QUFoQlMsQ0FBakI7QUFrQkEsSUFBTSxjQUFjLE9BQU8sSUFBUCxDQUFZLFVBQVosQ0FBcEI7O0FBRUEsU0FBUyxHQUFULENBQWEsT0FBYixFQUFzQixFQUF0QixFQUEwQjtBQUN0QixpQkFBYSxJQUFiLENBQWtCLElBQWxCO0FBQ0EsU0FBSyxNQUFMLEdBQWMsVUFBUyxLQUFULEVBQWdCO0FBQUUsZ0JBQVEsRUFBUixFQUFZLEtBQVo7QUFBb0IsS0FBcEQ7QUFDQSxRQUFJLFVBQVUsQ0FBQyxDQUFELEVBQUksRUFBSixDQUFkLENBSHNCLENBR0M7QUFDdkIsU0FBSyxPQUFMLEdBQWUsQ0FBQyxDQUFELEVBQUksRUFBSixDQUFmLENBSnNCLENBSUU7QUFDeEIsV0FBTztBQUNILGdCQUFRLGtCQUFXO0FBQUUsb0JBQVEsRUFBUixFQUFZLFFBQVEsQ0FBUixDQUFaO0FBQXlCLFNBRDNDO0FBRUgsaUJBQVMsbUJBQVc7QUFBRSxvQkFBUSxFQUFSLEVBQVksUUFBUSxDQUFSLENBQVo7QUFBeUIsU0FGNUM7QUFHSCxpQkFBUyxtQkFBVztBQUFFLG9CQUFRLEVBQVIsRUFBWSxDQUFaO0FBQWdCLFNBSG5DO0FBSUgsYUFBSyxlQUFXO0FBQUUsc0JBQVUsQ0FBQyxDQUFELEVBQUksQ0FBSixDQUFWO0FBQWtCLFNBSmpDO0FBS0gsZ0JBQVEsa0JBQVc7QUFBRSxzQkFBVSxDQUFDLENBQUQsRUFBSSxFQUFKLENBQVY7QUFBbUIsU0FMckM7QUFNSCxnQkFBUSxrQkFBVztBQUFFLHNCQUFVLENBQUMsRUFBRCxFQUFLLEVBQUwsQ0FBVjtBQUFvQixTQU50QztBQU9ILGVBQU8saUJBQVc7QUFBRSxzQkFBVSxDQUFDLEVBQUQsRUFBSyxFQUFMLENBQVY7QUFBb0IsU0FQckM7QUFRSCxZQUFJLEtBQUssRUFSTjtBQVNILGNBQU0sS0FBSztBQVRSLEtBQVA7QUFXSDtBQUNELEtBQUssUUFBTCxDQUFjLEdBQWQsRUFBbUIsWUFBbkI7O0FBRUEsU0FBUyxjQUFULENBQXdCLE9BQXhCLEVBQWlDO0FBQUE7O0FBQzdCLFFBQU0sa0JBQWtCLElBQXhCO0FBQ0EsWUFBUSxVQUFSLEVBQW9CLFVBQUMsS0FBRCxFQUFRLEdBQVI7QUFBQSxlQUFnQixNQUFLLEtBQUwsSUFBYyxJQUFJLEdBQUosQ0FBUSxPQUFSLEVBQWlCLFNBQVMsR0FBVCxDQUFqQixDQUE5QjtBQUFBLEtBQXBCO0FBQ0EsU0FBSyxXQUFMLEdBQW1CLFdBQW5CO0FBQ0EsU0FBSyxlQUFMLEdBQXVCLFVBQVMsRUFBVCxFQUFhLEtBQWIsRUFBb0I7QUFDdkMsWUFBSSxXQUFXLFdBQVcsRUFBWCxDQUFmO0FBQ0Esd0JBQWdCLFFBQWhCLEVBQTBCLElBQTFCLENBQStCLFFBQVEsQ0FBUixHQUFZLFNBQVosR0FBd0IsVUFBdkQ7QUFDSCxLQUhEO0FBSUg7O0FBRUQsT0FBTyxPQUFQLEdBQWlCLGNBQWpCOzs7OztBQ3JEQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYO0FBQUEsSUFFSSxVQUFVLFFBQVEsZ0JBQVIsQ0FGZDtBQUFBLElBR0ksVUFBVSxRQUFRLGdCQUFSLENBSGQ7O0FBS0EsSUFBTSxrQkFBa0I7QUFDcEIsU0FBSyxDQURlO0FBRXBCLFNBQUssQ0FGZTtBQUdwQixTQUFLLENBSGU7QUFJcEIsU0FBSyxDQUplO0FBS3BCLFNBQUssQ0FMZTtBQU1wQixTQUFLLENBTmU7QUFPcEIsU0FBSyxDQVBlO0FBUXBCLFNBQUs7QUFSZSxDQUF4QjtBQVVBLElBQU0sY0FBYyxPQUFPLElBQVAsQ0FBWSxlQUFaLENBQXBCOztBQUVBLElBQUksZ0JBQWdCLEVBQXBCO0FBQ0EsS0FBSyxJQUFJLElBQUksRUFBYixFQUFpQixLQUFLLEVBQXRCLEVBQTBCLEdBQTFCO0FBQStCLGtCQUFjLElBQWQsQ0FBbUIsQ0FBbkI7QUFBL0IsQ0FFQSxTQUFTLFVBQVQsQ0FBb0IsaUJBQXBCLEVBQXVDLFVBQXZDLEVBQW1ELElBQW5ELEVBQXlEO0FBQ3JELGlCQUFhLElBQWIsQ0FBa0IsSUFBbEI7QUFDQSxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxRQUFULEVBQW1CO0FBQUUsMEJBQWtCLElBQWxCLEVBQXdCLFFBQXhCO0FBQW1DLEtBQXhFO0FBQ0EsU0FBSyxTQUFMLEdBQWlCLFVBQVMsSUFBVCxFQUFlO0FBQUUsbUJBQVcsSUFBWDtBQUFrQixLQUFwRDtBQUNBLFNBQUssS0FBTCxHQUFhLE9BQU8sR0FBUCxHQUFhLE9BQU8sRUFBcEIsR0FBeUIsT0FBTyxFQUE3Qzs7QUFFQSxXQUFPO0FBQ0gsZ0JBQVEsUUFBUSxNQUFSLEVBQWdCLElBQWhCLENBREw7QUFFSCxpQkFBUyxRQUFRLE9BQVIsRUFBaUIsSUFBakIsQ0FGTjtBQUdILGlCQUFTLFFBQVEsT0FBUixFQUFpQixJQUFqQixDQUhOO0FBSUgsWUFBSSxLQUFLLEVBSk47QUFLSCxjQUFNLEtBQUs7QUFMUixLQUFQO0FBT0g7QUFDRCxLQUFLLFFBQUwsQ0FBYyxVQUFkLEVBQTBCLFlBQTFCOztBQUVBLFNBQVMsTUFBVCxDQUFnQixVQUFoQixFQUE0QixLQUE1QixFQUFtQztBQUFFLGVBQVcsUUFBWCxDQUFvQixRQUFRLEtBQVIsR0FBZ0IsR0FBcEM7QUFBMEM7QUFDL0UsU0FBUyxPQUFULENBQWlCLFVBQWpCLEVBQTZCO0FBQUUsZUFBVyxRQUFYLENBQW9CLENBQXBCO0FBQXdCO0FBQ3ZELFNBQVMsT0FBVCxDQUFpQixVQUFqQixFQUE2QixDQUE3QixFQUFnQyxDQUFoQyxFQUFtQyxDQUFuQyxFQUFzQztBQUNsQyxRQUFJLE1BQU0sQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxHQUFWLENBQWMsVUFBQyxDQUFEO0FBQUEsZUFBTyxDQUFDLElBQUksR0FBTCxLQUFhLENBQXBCO0FBQUEsS0FBZCxDQUFWO0FBQUEsUUFDSSxNQUFNLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsR0FBVixDQUFjLFVBQUMsQ0FBRDtBQUFBLGVBQU8sSUFBSSxFQUFYO0FBQUEsS0FBZCxDQURWO0FBRUEsZUFBVyxTQUFYLENBQXFCLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsV0FBVyxLQUFyQixFQUE0QixDQUE1QixFQUErQixJQUFJLENBQUosQ0FBL0IsRUFBdUMsSUFBSSxDQUFKLENBQXZDLEVBQStDLElBQUksQ0FBSixDQUEvQyxFQUF1RCxJQUFJLENBQUosQ0FBdkQsRUFBK0QsSUFBSSxDQUFKLENBQS9ELEVBQXVFLElBQUksQ0FBSixDQUF2RSxDQUFyQjtBQUNIOztBQUVELFNBQVMsSUFBVCxDQUFjLFNBQWQsRUFBeUIsT0FBekIsRUFBa0MsVUFBbEMsRUFBOEM7QUFBQTs7QUFDMUMsU0FBSyxDQUFMLEdBQVMsRUFBVDtBQUNBLFNBQUssTUFBTCxHQUFjLEVBQWQ7QUFDQSxTQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLEtBQUssQ0FBckIsRUFBd0IsR0FBeEIsRUFBNkI7QUFDekIsYUFBSyxDQUFMLENBQU8sQ0FBUCxJQUFZLEVBQUUsR0FBRyxFQUFMLEVBQVo7QUFDQSxhQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLEtBQUssQ0FBckIsRUFBd0IsR0FBeEIsRUFBNkI7QUFDekIsaUJBQUssQ0FBTCxDQUFPLENBQVAsRUFBVSxDQUFWLENBQVksQ0FBWixJQUFpQixJQUFJLFVBQUosQ0FBZSxTQUFmLEVBQTBCLFVBQTFCLEVBQXVDLElBQUksQ0FBTCxHQUFXLENBQUMsSUFBSSxDQUFMLElBQVUsQ0FBckIsR0FBMEIsRUFBaEUsQ0FBakI7QUFDSDtBQUNKOztBQUVELFlBQVEsZUFBUixFQUF5QixVQUFDLEtBQUQsRUFBUSxHQUFSO0FBQUEsZUFBZ0IsTUFBSyxNQUFMLENBQVksS0FBWixJQUFxQixJQUFJLFVBQUosQ0FBZSxPQUFmLEVBQXdCLFVBQXhCLEVBQW9DLFNBQVMsR0FBVCxDQUFwQyxDQUFyQztBQUFBLEtBQXpCO0FBQ0EsU0FBSyxXQUFMLEdBQW1CLFdBQW5CO0FBQ0EsU0FBSyxhQUFMLEdBQXFCLGFBQXJCO0FBQ0EsU0FBSyxpQkFBTCxHQUF5QixRQUFRLGlCQUFSLEVBQTJCLElBQTNCLENBQXpCO0FBQ0EsU0FBSyxlQUFMLEdBQXVCLFFBQVEsZUFBUixFQUF5QixJQUF6QixDQUF2QjtBQUNBLFNBQUssMEJBQUwsR0FBa0MsUUFBUSwwQkFBUixFQUFvQyxJQUFwQyxDQUFsQztBQUNIOztBQUVELFNBQVMsaUJBQVQsQ0FBMkIsSUFBM0IsRUFBaUMsSUFBakMsRUFBdUMsUUFBdkMsRUFBaUQ7QUFDN0MsUUFBSSxTQUFTLGlCQUFpQixJQUFqQixFQUF1QixJQUF2QixDQUFiO0FBQUEsUUFDSSxNQUFNLFNBQVMsUUFBVCxDQURWO0FBRUEsVUFBTSxDQUFOLEdBQVUsT0FBTyxJQUFQLENBQVksU0FBWixFQUF1QixHQUF2QixDQUFWLEdBQXdDLE9BQU8sSUFBUCxDQUFZLFVBQVosQ0FBeEM7QUFDSDs7QUFFRCxTQUFTLGVBQVQsQ0FBeUIsSUFBekIsRUFBK0IsS0FBL0IsRUFBc0MsS0FBdEMsRUFBNkM7QUFDekMsU0FBSyxNQUFMLENBQVksZ0JBQWdCLEtBQWhCLENBQVosRUFBb0MsSUFBcEMsQ0FBeUMsUUFBUSxDQUFSLEdBQVksU0FBWixHQUF3QixVQUFqRTtBQUNIOztBQUVELFNBQVMsMEJBQVQsQ0FBb0MsSUFBcEMsRUFBMEMsSUFBMUMsRUFBZ0QsUUFBaEQsRUFBMEQ7QUFDdEQscUJBQWlCLElBQWpCLEVBQXVCLElBQXZCLEVBQTZCLElBQTdCLENBQWtDLFlBQWxDLEVBQWdELFNBQVMsUUFBVCxDQUFoRDtBQUNIOztBQUVELFNBQVMsZ0JBQVQsQ0FBMEIsSUFBMUIsRUFBZ0MsSUFBaEMsRUFBc0M7QUFDbEMsUUFBSSxvQkFBb0IsT0FBTyxFQUEvQjtBQUFBLFFBQ0ksSUFBSyxvQkFBb0IsQ0FBckIsR0FBMEIsQ0FEbEM7QUFBQSxRQUVJLElBQUksU0FBUyxvQkFBb0IsQ0FBN0IsSUFBa0MsQ0FGMUM7QUFHQSxXQUFPLEtBQUssQ0FBTCxDQUFPLENBQVAsRUFBVSxDQUFWLENBQVksQ0FBWixDQUFQO0FBQ0g7O0FBRUQsT0FBTyxPQUFQLEdBQWlCLElBQWpCOzs7OztBQ25GQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYO0FBQUEsSUFFSSxVQUFVLFFBQVEsZ0JBQVIsQ0FGZDtBQUFBLElBR0ksVUFBVSxRQUFRLGdCQUFSLENBSGQ7O0FBS0EsSUFBSSxVQUFVO0FBQ1YsYUFBUyxFQUFFLE1BQU0sRUFBUixFQUFZLFFBQVEsRUFBcEIsRUFEQztBQUVWLGFBQVMsRUFBRSxNQUFNLEVBQVIsRUFBWSxRQUFRLENBQXBCLEVBRkM7QUFHVixPQUFHLEVBQUUsTUFBTSxFQUFSLEVBQVksUUFBUSxDQUFwQixFQUhPO0FBSVYsT0FBRyxFQUFFLE1BQU0sRUFBUixFQUFZLFFBQVEsQ0FBcEIsRUFKTztBQUtWLE9BQUcsRUFBRSxNQUFNLEVBQVIsRUFBWSxRQUFRLENBQXBCLEVBTE87QUFNVixPQUFHLEVBQUUsTUFBTSxFQUFSLEVBQVksUUFBUSxDQUFwQixFQU5PO0FBT1YsT0FBRyxFQUFFLE1BQU0sRUFBUixFQUFZLFFBQVEsQ0FBcEIsRUFQTztBQVFWLE9BQUcsRUFBRSxNQUFNLEVBQVIsRUFBWSxRQUFRLENBQXBCLEVBUk87QUFTVixPQUFHLEVBQUUsTUFBTSxFQUFSLEVBQVksUUFBUSxDQUFwQixFQVRPO0FBVVYsT0FBRyxFQUFFLE1BQU0sRUFBUixFQUFZLFFBQVEsQ0FBcEIsRUFWTztBQVdWLGNBQVUsRUFBRSxNQUFNLEVBQVIsRUFBWSxRQUFRLENBQXBCO0FBWEEsQ0FBZDs7QUFjQSxJQUFJLGNBQWMsRUFBbEI7QUFDQSxJQUFJLGdCQUFnQixFQUFwQjtBQUNBLFFBQVEsT0FBUixFQUFpQixVQUFDLEtBQUQsRUFBUSxHQUFSLEVBQWdCO0FBQzdCLGdCQUFZLE1BQU0sRUFBbEIsSUFBd0IsR0FBeEI7QUFDQSxrQkFBYyxNQUFNLElBQXBCLElBQTRCLEdBQTVCO0FBQ0gsQ0FIRDtBQUlBLElBQU0sY0FBYyxPQUFPLElBQVAsQ0FBWSxXQUFaLENBQXBCO0FBQUEsSUFDSSxnQkFBZ0IsT0FBTyxJQUFQLENBQVksYUFBWixDQURwQjs7QUFHQSxTQUFTLElBQVQsR0FBZ0I7QUFDWixpQkFBYSxJQUFiLENBQWtCLElBQWxCO0FBQ0g7QUFDRCxLQUFLLFFBQUwsQ0FBYyxJQUFkLEVBQW9CLFlBQXBCOztBQUVBLFNBQVMsS0FBVCxHQUFpQjtBQUFBOztBQUNiLFlBQVEsT0FBUixFQUFpQixVQUFDLEtBQUQsRUFBUSxHQUFSO0FBQUEsZUFBZ0IsTUFBSyxHQUFMLElBQVksSUFBSSxJQUFKLEVBQTVCO0FBQUEsS0FBakI7QUFDQSxTQUFLLFdBQUwsR0FBbUIsV0FBbkI7QUFDQSxTQUFLLGVBQUwsR0FBdUIsUUFBUSxlQUFSLEVBQXlCLElBQXpCLENBQXZCO0FBQ0EsU0FBSyxpQkFBTCxHQUF5QixRQUFRLGlCQUFSLEVBQTJCLElBQTNCLENBQXpCO0FBQ0EsU0FBSyxhQUFMLEdBQXFCLGFBQXJCO0FBQ0g7O0FBRUQsU0FBUyxlQUFULENBQXlCLEtBQXpCLEVBQWdDLEtBQWhDLEVBQXVDLEtBQXZDLEVBQThDO0FBQzFDLFFBQUksWUFBWSxZQUFZLEtBQVosQ0FBaEI7QUFDQSxRQUFJLFFBQVEsUUFBUSxFQUFSLEdBQWEsS0FBYixHQUFxQixRQUFRLEdBQXpDO0FBQ0EsVUFBTSxTQUFOLEVBQWlCLElBQWpCLENBQXNCLFFBQXRCLEVBQWdDLEtBQWhDO0FBQ0g7O0FBRUQsU0FBUyxpQkFBVCxDQUEyQixLQUEzQixFQUFrQyxJQUFsQyxFQUF3QyxRQUF4QyxFQUFrRDtBQUM5QyxRQUFJLFlBQVksY0FBYyxJQUFkLENBQWhCO0FBQ0EsUUFBSSxhQUFhLFdBQVcsQ0FBWCxHQUFlLFNBQWYsR0FBMkIsVUFBNUM7QUFDQSxVQUFNLFNBQU4sRUFBaUIsSUFBakIsQ0FBc0IsVUFBdEI7QUFDSDs7QUFFRCxPQUFPLE9BQVAsR0FBaUIsS0FBakI7Ozs7O0FDckRBLElBQU0sVUFBVSxRQUFRLGdCQUFSLENBQWhCO0FBQUEsSUFDSSxlQUFlLENBQUMsQ0FBRCxFQUFJLENBQUosRUFBTyxDQUFQLEVBQVUsQ0FBVixFQUFhLENBQWIsRUFBZ0IsQ0FBaEIsRUFBbUIsQ0FBbkIsRUFBc0IsQ0FBdEIsQ0FEbkI7QUFBQSxJQUVJLGNBQWMsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLENBRmxCO0FBQUEsSUFHSSxnQkFBZ0IsQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixDQUFoQixFQUFtQixDQUFuQixFQUFzQixDQUF0QixDQUhwQjtBQUFBLElBSUksUUFBUSxFQUpaOztBQU1BLFNBQVMsVUFBVCxDQUFvQixJQUFwQixFQUEwQixVQUExQixFQUFzQztBQUNsQyxRQUFJLGNBQWMsSUFBbEI7QUFDQSxTQUFLLFFBQUwsR0FBZ0IsQ0FBQyxLQUFELEVBQVEsS0FBUixFQUFlLEtBQWYsRUFBc0IsS0FBdEIsRUFBNkIsS0FBN0IsRUFBb0MsS0FBcEMsRUFBMkMsS0FBM0MsRUFBa0QsS0FBbEQsQ0FBaEI7O0FBRUEsU0FBSyxNQUFMLEdBQWMsVUFBUyxJQUFULEVBQWU7QUFDekIsb0JBQVksUUFBWixHQUF1QixTQUFTLE9BQU8sSUFBUCxDQUFULENBQXZCO0FBQ0E7QUFDSCxLQUhEOztBQUtBLFNBQUssS0FBTCxHQUFhLFlBQVc7QUFDcEIsb0JBQVksUUFBWixHQUF1QixTQUFTLE9BQU8sRUFBUCxDQUFULENBQXZCO0FBQ0E7QUFDSCxLQUhEO0FBSUg7O0FBRUQsU0FBUyxRQUFULENBQWtCLElBQWxCLEVBQXdCO0FBQ3BCLFdBQU8sY0FBYyxHQUFkLENBQWtCLFVBQUMsS0FBRCxFQUFXO0FBQ2hDLGVBQU8sS0FBSyxNQUFMLEdBQWMsS0FBZCxHQUFzQixLQUFLLFVBQUwsQ0FBZ0IsS0FBaEIsQ0FBdEIsR0FBK0MsS0FBdEQ7QUFDSCxLQUZNLENBQVA7QUFHSDs7QUFFRCxTQUFTLElBQVQsQ0FBYyxVQUFkLEVBQTBCO0FBQ3RCLFFBQU0sT0FBTyxJQUFiO0FBQ0EsUUFBTSxhQUFhLFNBQWIsVUFBYSxDQUFVLFVBQVYsRUFBc0I7QUFDckMsWUFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQVEsWUFBUixFQUFzQixVQUFDLE9BQUQsRUFBYTtBQUMvQiwyQkFBZSxhQUFhLE1BQWIsQ0FBb0IsS0FBSyxDQUFMLENBQU8sT0FBUCxFQUFnQixDQUFoQixDQUFrQixVQUFsQixFQUE4QixRQUFsRCxDQUFmO0FBQ0EsZ0JBQUssVUFBVSxDQUFYLElBQWlCLENBQXJCLEVBQXdCLGFBQWEsSUFBYixDQUFrQixLQUFsQjtBQUMzQixTQUhEO0FBSUEsbUJBQ0ksQ0FBQyxLQUFLLFVBQU4sRUFDQyxNQURELENBQ1EsQ0FBQyxDQUFELEVBQUksRUFBSixFQUFRLENBQVIsQ0FEUixFQUVDLE1BRkQsQ0FFUSxZQUZSLENBREo7QUFLSCxLQVhEOztBQWFBLFNBQUssS0FBTCxHQUFhLFlBQVc7QUFDcEIsZ0JBQ0ksWUFESixFQUVJLFVBQUMsQ0FBRCxFQUFPO0FBQ0gsaUJBQUssQ0FBTCxDQUFPLENBQVAsSUFBWSxFQUFFLEdBQUcsRUFBTCxFQUFaO0FBQ0Esb0JBQ0ksV0FESixFQUVJLFVBQUMsQ0FBRCxFQUFPO0FBQUUscUJBQUssQ0FBTCxDQUFPLENBQVAsRUFBVSxDQUFWLENBQVksQ0FBWixJQUFpQixJQUFJLFVBQUosQ0FBZSxJQUFmLEVBQXFCO0FBQUEsMkJBQU0sV0FBVyxDQUFYLENBQU47QUFBQSxpQkFBckIsQ0FBakI7QUFBNEQsYUFGekU7QUFJSCxTQVJMOztBQVdBLGdCQUFRLFdBQVIsRUFBcUI7QUFBQSxtQkFBTyxXQUFXLEdBQVgsQ0FBUDtBQUFBLFNBQXJCO0FBQ0gsS0FiRDs7QUFlQSxTQUFLLENBQUwsR0FBUyxFQUFUOztBQUVBLFNBQUssS0FBTDs7QUFFQSxTQUFLLENBQUwsQ0FBTyxDQUFQLEVBQVUsQ0FBVixDQUFZLENBQVosRUFBZSxNQUFmLENBQXNCLFVBQXRCO0FBQ0EsU0FBSyxDQUFMLENBQU8sQ0FBUCxFQUFVLENBQVYsQ0FBWSxDQUFaLEVBQWUsTUFBZixDQUFzQixVQUF0QjtBQUNBLFNBQUssQ0FBTCxDQUFPLENBQVAsRUFBVSxDQUFWLENBQVksQ0FBWixFQUFlLE1BQWYsQ0FBc0IsVUFBdEI7QUFDQSxTQUFLLENBQUwsQ0FBTyxDQUFQLEVBQVUsQ0FBVixDQUFZLENBQVosRUFBZSxNQUFmLENBQXNCLFVBQXRCOztBQUVBLFlBQVEsV0FBUixFQUFxQjtBQUFBLGVBQU8sV0FBVyxHQUFYLENBQVA7QUFBQSxLQUFyQjtBQUNIOztBQUVELE9BQU8sT0FBUCxHQUFpQixJQUFqQjs7Ozs7QUNyRUEsSUFBTSxlQUFlLFFBQVEsUUFBUixDQUFyQjtBQUFBLElBQ0ksT0FBTyxRQUFRLE1BQVIsQ0FEWDtBQUFBLElBRUksVUFBVSxRQUFRLGdCQUFSLENBRmQ7QUFBQSxJQUdJLGdCQUFnQixDQUFDLEVBQUQsQ0FIcEI7O0FBS0EsU0FBUyxVQUFULEdBQXNCO0FBQ2xCLGlCQUFhLElBQWIsQ0FBa0IsSUFBbEI7QUFDQSxTQUFLLHVCQUFMLEdBQStCLFFBQVEsdUJBQVIsRUFBaUMsSUFBakMsQ0FBL0I7QUFDQSxTQUFLLGlCQUFMLEdBQXlCLFFBQVEsaUJBQVIsRUFBMkIsSUFBM0IsQ0FBekI7QUFDQSxTQUFLLGFBQUwsR0FBcUIsYUFBckI7QUFDSDtBQUNELEtBQUssUUFBTCxDQUFjLFVBQWQsRUFBMEIsWUFBMUI7O0FBRUEsU0FBUyx1QkFBVCxDQUFpQyxVQUFqQyxFQUE2QyxrQkFBN0MsRUFBaUU7QUFDN0QsUUFBSSxzQkFBc0IsSUFBMUIsRUFBZ0M7QUFDaEMsZUFBVyxJQUFYLENBQWdCLFdBQWhCLEVBQTZCLGtCQUE3QjtBQUNIOztBQUVELFNBQVMsaUJBQVQsQ0FBMkIsVUFBM0IsRUFBdUMsSUFBdkMsRUFBNkMsUUFBN0MsRUFBdUQ7QUFDbkQsUUFBSSxXQUFXLENBQWYsRUFBa0I7QUFDZCxtQkFBVyxJQUFYLENBQWdCLFNBQWhCO0FBQ0gsS0FGRCxNQUVPO0FBQ0gsbUJBQVcsSUFBWCxDQUFnQixVQUFoQjtBQUNBLG1CQUFXLElBQVgsQ0FBZ0IsV0FBaEIsRUFBNkIsSUFBN0I7QUFDSDtBQUNKOztBQUVELE9BQU8sT0FBUCxHQUFpQixVQUFqQjs7O0FDM0JBOztBQUVBLElBQU0sZUFBZSxRQUFRLFFBQVIsQ0FBckI7QUFBQSxJQUNJLE9BQU8sUUFBUSxNQUFSLENBRFg7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkOztBQUlBLFNBQVMsR0FBVCxDQUFhLE9BQWIsRUFBc0I7QUFDbEIsaUJBQWEsSUFBYixDQUFrQixJQUFsQjtBQUNBLFFBQUksTUFBTSxJQUFWOztBQUVBLFNBQUssT0FBTCxHQUFlLEtBQUssT0FBTCxJQUFnQixLQUFLLE9BQUwsQ0FBaEIsR0FBZ0MsR0FBL0M7O0FBRUEsU0FBSyxNQUFMLEdBQWMsWUFBVztBQUFFLFlBQUksSUFBSixDQUFTLFNBQVQsRUFBb0IsR0FBcEI7QUFBMEIsS0FBckQ7QUFDQSxTQUFLLFNBQUwsR0FBaUIsVUFBUyxNQUFULEVBQWlCO0FBQzlCLFlBQUksT0FBSixHQUFjLEtBQUssSUFBSSxPQUFKLEdBQWMsTUFBbkIsQ0FBZDtBQUNBLFlBQUksTUFBSjtBQUNILEtBSEQ7QUFJSDtBQUNELEtBQUssUUFBTCxDQUFjLEdBQWQsRUFBbUIsWUFBbkI7O0FBRUEsU0FBUyxJQUFULENBQWMsR0FBZCxFQUFtQjtBQUNmLFdBQU8sTUFBTSxFQUFOLEdBQVcsRUFBWCxHQUFpQixNQUFNLEdBQU4sR0FBWSxHQUFaLEdBQWtCLEdBQTFDO0FBQ0g7O0FBRUQsT0FBTyxPQUFQLEdBQWlCLEdBQWpCOzs7QUN4QkE7O0FBRUEsSUFBTSxlQUFlLFFBQVEsUUFBUixDQUFyQjtBQUFBLElBQ0ksT0FBTyxRQUFRLE1BQVIsQ0FEWDtBQUFBLElBRUksVUFBVSxRQUFRLGdCQUFSLENBRmQ7O0FBSUEsU0FBUyxRQUFULENBQWtCLEdBQWxCLEVBQXVCLFVBQXZCLEVBQW1DLEtBQW5DLEVBQTBDO0FBQ3RDLGlCQUFhLElBQWIsQ0FBa0IsSUFBbEI7QUFDQSxRQUFJLFdBQVcsSUFBZjs7QUFFQSxTQUFLLEtBQUwsR0FBYSxLQUFiO0FBQ0EsU0FBSyxNQUFMLEdBQWMsWUFBVztBQUFFLGlCQUFTLElBQVQsQ0FBYyxTQUFkLEVBQTBCLEtBQUssSUFBSSxPQUFWLEdBQXFCLFVBQXJCLEdBQWtDLElBQTNEO0FBQW1FLEtBQTlGOztBQUVBLFFBQUksRUFBSixDQUFPLFNBQVAsRUFBa0IsU0FBUyxNQUEzQjtBQUNIO0FBQ0QsS0FBSyxRQUFMLENBQWMsUUFBZCxFQUF3QixZQUF4Qjs7QUFFQSxPQUFPLE9BQVAsR0FBaUI7QUFDYixVQUFNLFdBQVMsR0FBVCxFQUFjLElBQWQsRUFBb0I7QUFBRSxlQUFPLElBQUksUUFBSixDQUFhLEdBQWIsRUFBa0IsQ0FBbEIsRUFBcUIsT0FBTyxJQUFQLEdBQWMsSUFBbkMsQ0FBUDtBQUFpRCxLQURoRTtBQUViLFdBQU8sWUFBUyxHQUFULEVBQWMsSUFBZCxFQUFvQjtBQUFFLGVBQU8sSUFBSSxRQUFKLENBQWEsR0FBYixFQUFrQixJQUFJLENBQXRCLEVBQXlCLE9BQU8sSUFBUCxHQUFjLEtBQXZDLENBQVA7QUFBc0QsS0FGdEU7QUFHYixVQUFNLFdBQVMsR0FBVCxFQUFjLElBQWQsRUFBb0I7QUFBRSxlQUFPLElBQUksUUFBSixDQUFhLEdBQWIsRUFBa0IsR0FBbEIsRUFBdUIsT0FBTyxJQUFQLEdBQWMsSUFBckMsQ0FBUDtBQUFtRCxLQUhsRTtBQUliLFdBQU8sWUFBUyxHQUFULEVBQWMsSUFBZCxFQUFvQjtBQUFFLGVBQU8sSUFBSSxRQUFKLENBQWEsR0FBYixFQUFrQixJQUFJLENBQXRCLEVBQXlCLE9BQU8sSUFBUCxHQUFjLEtBQXZDLENBQVA7QUFBc0QsS0FKdEU7QUFLYixXQUFPLFdBQVMsR0FBVCxFQUFjLElBQWQsRUFBb0I7QUFBRSxlQUFPLElBQUksUUFBSixDQUFhLEdBQWIsRUFBa0IsSUFBbEIsRUFBd0IsT0FBTyxJQUFQLEdBQWMsS0FBdEMsQ0FBUDtBQUFxRCxLQUxyRTtBQU1iLFlBQVEsWUFBUyxHQUFULEVBQWMsSUFBZCxFQUFvQjtBQUFFLGVBQU8sSUFBSSxRQUFKLENBQWEsR0FBYixFQUFrQixJQUFJLENBQXRCLEVBQXlCLE9BQU8sSUFBUCxHQUFjLE1BQXZDLENBQVA7QUFBdUQsS0FOeEU7QUFPYixXQUFPLFdBQVMsR0FBVCxFQUFjLElBQWQsRUFBb0I7QUFBRSxlQUFPLElBQUksUUFBSixDQUFhLEdBQWIsRUFBa0IsS0FBbEIsRUFBeUIsT0FBTyxJQUFQLEdBQWMsS0FBdkMsQ0FBUDtBQUFzRCxLQVB0RTtBQVFiLFlBQVEsWUFBUyxHQUFULEVBQWMsSUFBZCxFQUFvQjtBQUFFLGVBQU8sSUFBSSxRQUFKLENBQWEsR0FBYixFQUFrQixJQUFJLEVBQXRCLEVBQTBCLE9BQU8sSUFBUCxHQUFjLE1BQXhDLENBQVA7QUFBd0Q7QUFSekUsQ0FBakI7Ozs7O0FDakJBLElBQU0sZUFBZSxRQUFRLFFBQVIsQ0FBckI7QUFBQSxJQUNJLE9BQU8sUUFBUSxNQUFSLENBRFg7QUFBQSxJQUVJLFVBQVUsUUFBUSxnQkFBUixDQUZkOztBQUlBLFNBQVMsTUFBVCxDQUFnQixTQUFoQixFQUEyQixhQUEzQixFQUEwQztBQUFBOztBQUN0QyxpQkFBYSxJQUFiLENBQWtCLElBQWxCO0FBQ0EsUUFBSSxTQUFTLElBQWI7O0FBRUEsU0FBSyxJQUFMLEdBQVksVUFBUyxRQUFULEVBQW1CLGdCQUFuQixFQUFxQztBQUM3QyxhQUFLLE1BQUwsRUFBYSxhQUFiLEVBQTRCLFFBQTVCLEVBQXNDLGdCQUF0QztBQUNILEtBRkQ7O0FBSUEsU0FBSyxvQkFBTCxHQUE0QixVQUFTLElBQVQsRUFBZTtBQUN2Qyw2QkFBcUIsTUFBckIsRUFBNkIsYUFBN0IsRUFBNEMsSUFBNUM7QUFDSCxLQUZEOztBQUlBLFNBQUssT0FBTCxHQUFlLEtBQWY7QUFDQSxTQUFLLE9BQUwsR0FBZSxFQUFmO0FBQ0EsU0FBSyxjQUFMLEdBQXNCLENBQXRCO0FBQ0EsZUFBVyxTQUFYLEVBQXNCLGFBQXRCLEVBQXFDLFVBQUMsTUFBRCxFQUFZO0FBQzdDLGNBQUssT0FBTCxHQUFlLE1BQWY7QUFDQSxjQUFLLE9BQUwsR0FBZSxJQUFmO0FBQ0gsS0FIRDtBQUlIO0FBQ0QsS0FBSyxRQUFMLENBQWMsTUFBZCxFQUFzQixZQUF0Qjs7QUFFQSxTQUFTLFVBQVQsQ0FBb0IsU0FBcEIsRUFBK0IsYUFBL0IsRUFBOEMsSUFBOUMsRUFBb0Q7QUFDaEQsUUFBSSxVQUFVLElBQUksY0FBSixFQUFkO0FBQ0EsWUFBUSxJQUFSLENBQWEsS0FBYixFQUFvQixTQUFwQixFQUErQixJQUEvQjtBQUNBLFlBQVEsWUFBUixHQUF1QixhQUF2QjtBQUNBLFlBQVEsTUFBUixHQUFpQixZQUFZO0FBQ3pCLHNCQUFjLGVBQWQsQ0FBOEIsUUFBUSxRQUF0QyxFQUFnRCxJQUFoRDtBQUNILEtBRkQ7QUFHQSxZQUFRLElBQVI7QUFDSDs7QUFFRCxTQUFTLElBQVQsQ0FBYyxNQUFkLEVBQXNCLGFBQXRCLEVBQXFDLFFBQXJDLEVBQStDLGdCQUEvQyxFQUFpRTtBQUM3RCxRQUFJLENBQUMsT0FBTyxPQUFaLEVBQXFCOztBQUVyQixRQUFJLE1BQU0sU0FBUyxhQUFULENBQVY7O0FBRUEsUUFBSSxXQUFXLE1BQVgsQ0FBSixFQUF3QjtBQUNwQixnQkFBUSxPQUFPLE9BQWYsRUFBd0IsVUFBQyxLQUFELEVBQVc7QUFDL0Isa0JBQU0sSUFBTixDQUFXLHFCQUFYLENBQWlDLEdBQWpDO0FBQ0EsbUJBQU8sTUFBTSxJQUFiLEVBQW1CLEdBQW5CO0FBQ0Esa0JBQU0sSUFBTixDQUFXLHVCQUFYLENBQW1DLENBQW5DLEVBQXNDLE1BQU0sSUFBNUM7QUFDSCxTQUpEO0FBS0EsZUFBTyxJQUFQLENBQVksU0FBWjtBQUNIOztBQUVELFFBQUksWUFBWSxjQUFjLFVBQWQsRUFBaEI7QUFDQSxRQUFJLGNBQWMsY0FBYyxrQkFBZCxFQUFsQjtBQUNBLGdCQUFZLFNBQVosQ0FBc0IsS0FBdEIsR0FBOEIsbUJBQW1CLEVBQW5CLEdBQXdCLGdCQUF4QixHQUEyQyxFQUF6RTtBQUNBLFFBQUksU0FBUyxjQUFjLGtCQUFkLEVBQWI7O0FBRUEsV0FBTyxPQUFQLENBQWUsV0FBZjtBQUNBLGdCQUFZLE9BQVosQ0FBb0IsU0FBcEI7O0FBRUEsY0FBVSxPQUFWLENBQWtCLGNBQWMsV0FBaEM7O0FBRUEsY0FBVSxJQUFWLENBQWUsY0FBZixDQUE4QixDQUE5QixFQUFpQyxHQUFqQztBQUNBLGNBQVUsSUFBVixDQUFlLHVCQUFmLENBQXVDLFdBQVcsR0FBbEQsRUFBdUQsTUFBTSxJQUE3RDs7QUFFQSxXQUFPLFlBQVAsQ0FBb0IsY0FBcEIsQ0FBbUMsT0FBTyxjQUExQyxFQUEwRCxHQUExRDtBQUNBLFdBQU8sTUFBUCxHQUFnQixPQUFPLE9BQXZCOztBQUVBLFdBQU8sZ0JBQVAsQ0FBd0IsT0FBeEIsRUFBaUMsWUFBTTtBQUNuQyxlQUFPLE9BQVAsQ0FBZSxLQUFmO0FBQ0EsWUFBSSxDQUFDLFdBQVcsTUFBWCxDQUFMLEVBQXlCLE9BQU8sSUFBUCxDQUFZLFNBQVo7QUFDNUIsS0FIRDs7QUFLQSxXQUFPLE9BQVAsQ0FBZSxJQUFmLENBQW9CLEVBQUMsUUFBUSxNQUFULEVBQWlCLE1BQU0sVUFBVSxJQUFqQyxFQUFwQjtBQUNBLFdBQU8sS0FBUDtBQUNBLFdBQU8sSUFBUCxDQUFZLFNBQVosRUFBdUIsUUFBdkI7QUFDSDs7QUFFRCxTQUFTLE1BQVQsQ0FBZ0IsV0FBaEIsRUFBNkIsR0FBN0IsRUFBa0M7QUFDOUIsZ0JBQVksY0FBWixDQUEyQixZQUFZLEtBQXZDLEVBQThDLEdBQTlDO0FBQ0g7O0FBRUQsU0FBUyxVQUFULENBQW9CLE1BQXBCLEVBQTRCO0FBQ3hCLFdBQU8sT0FBTyxPQUFQLENBQWUsTUFBZixHQUF3QixDQUEvQjtBQUNIOztBQUVELFNBQVMsb0JBQVQsQ0FBOEIsTUFBOUIsRUFBc0MsYUFBdEMsRUFBcUQsSUFBckQsRUFBMkQ7QUFDdkQsV0FBTyxjQUFQLEdBQXdCLElBQXhCO0FBQ0EsUUFBSSxNQUFNLFNBQVMsYUFBVCxDQUFWO0FBQ0EsWUFBUSxPQUFPLE9BQWYsRUFBd0IsVUFBQyxLQUFELEVBQVc7QUFDL0IsY0FBTSxNQUFOLENBQWEsWUFBYixDQUEwQixjQUExQixDQUF5QyxPQUFPLGNBQWhELEVBQWdFLEdBQWhFO0FBQ0gsS0FGRDtBQUdIOztBQUVELFNBQVMsUUFBVCxDQUFrQixhQUFsQixFQUFpQztBQUM3QixXQUFPLGNBQWMsV0FBckI7QUFDSDs7QUFFRCxPQUFPLE9BQVAsR0FBaUIsTUFBakI7OztBQ2hHQTs7QUFFQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYO0FBRUE7OztBQUdBLFNBQVMsUUFBVCxDQUFrQixtQkFBbEIsRUFBdUMsZ0JBQXZDLEVBQXlEO0FBQ3JELGlCQUFhLElBQWIsQ0FBa0IsSUFBbEI7QUFDQSxRQUFJLFdBQVcsSUFBZjtBQUNBLFNBQUssY0FBTCxHQUFzQixLQUF0QjtBQUNBLFNBQUssU0FBTCxHQUFpQixtQkFBbUIsRUFBbkIsR0FBd0IsZ0JBQXhCLEdBQTJDLEdBQTVELENBSnFELENBSVk7O0FBRWpFLFNBQUssUUFBTCxHQUFnQixVQUFVLFNBQVYsRUFBcUI7QUFDakMsaUJBQVMsU0FBVCxHQUFxQixZQUFZLEVBQVosR0FBaUIsU0FBakIsR0FBNkIsRUFBbEQsQ0FEaUMsQ0FDcUI7QUFDdEQsaUJBQVMsZUFBVDtBQUNILEtBSEQ7O0FBS0EsU0FBSyxLQUFMLEdBQWEsVUFBUyxRQUFULEVBQW1CO0FBQzVCLFlBQUksU0FBUyxjQUFiLEVBQTZCO0FBQzdCLGlCQUFTLGNBQVQsR0FBMEIsSUFBMUI7QUFDQSxpQkFBUyxvQkFBVCxDQUE4QixRQUE5QjtBQUNILEtBSkQ7O0FBTUEsU0FBSyxvQkFBTCxHQUE0QixVQUFTLFFBQVQsRUFBbUI7QUFDM0MsWUFBSSxTQUFTLGNBQWIsRUFBNkI7QUFDekI7QUFDQSxnQ0FBb0I7QUFBQSx1QkFBTSxTQUFTLG9CQUFULENBQThCLFFBQTlCLENBQU47QUFBQSxhQUFwQixFQUFtRSxTQUFTLFNBQTVFO0FBQ0g7QUFDSixLQUxEOztBQU9BLFNBQUssSUFBTCxHQUFZLFlBQVc7QUFDbkIsaUJBQVMsY0FBVCxHQUEwQixLQUExQjtBQUNILEtBRkQ7O0FBSUEsU0FBSyxlQUFMLEdBQXVCLFlBQVc7QUFDOUIsaUJBQVMsSUFBVCxDQUFjLFVBQWQsRUFBMEIsU0FBUyxTQUFuQztBQUNILEtBRkQ7QUFHSDtBQUNELEtBQUssUUFBTCxDQUFjLFFBQWQsRUFBd0IsWUFBeEI7O0FBRUE7QUFDQSxTQUFTLGlDQUFULEdBQTZDLFVBQVMsT0FBVCxFQUFrQixnQkFBbEIsRUFBb0M7QUFDN0UsV0FBTyxJQUFJLFFBQUosQ0FBYSxVQUFDLFFBQUQsRUFBVyxXQUFYLEVBQTJCO0FBQzNDLFlBQUksU0FBUyxRQUFRLGtCQUFSLEVBQWI7QUFBQSxZQUNJLE1BQU0sUUFBUSxXQURsQjtBQUFBLFlBRUksYUFBYSxRQUFRLFVBQVIsR0FBcUIsSUFGdEM7QUFBQSxZQUdJLGVBQWUsTUFBTyxjQUFjLElBSHhDO0FBSUE7QUFDQSxZQUFJLFNBQVMsUUFBUSxZQUFSLENBQXFCLENBQXJCLEVBQXdCLFVBQXhCLEVBQW9DLFFBQVEsVUFBNUMsQ0FBYjtBQUNBLGVBQU8sZ0JBQVAsQ0FBd0IsT0FBeEIsRUFBaUMsUUFBakM7QUFDQSxlQUFPLE1BQVAsR0FBZ0IsTUFBaEI7QUFDQSxlQUFPLE9BQVAsQ0FBZSxRQUFRLFdBQXZCO0FBQ0EsZUFBTyxLQUFQLENBQWEsWUFBYjtBQUNILEtBWE0sRUFXSixnQkFYSSxDQUFQO0FBWUgsQ0FiRDs7QUFlQSxPQUFPLE9BQVAsR0FBaUIsUUFBakI7OztBQ3pEQTs7QUFFQSxJQUFNLGVBQWUsUUFBUSxRQUFSLENBQXJCO0FBQUEsSUFDSSxPQUFPLFFBQVEsTUFBUixDQURYO0FBQUEsSUFFSSxXQUFXLFFBQVEsZUFBUixDQUZmOztBQUlBLFNBQVMsT0FBVCxDQUFpQixRQUFqQixFQUEyQixnQkFBM0IsRUFBNkM7QUFDekMsaUJBQWEsSUFBYixDQUFrQixJQUFsQjtBQUNBLFFBQUksVUFBVSxJQUFkO0FBQ0EsU0FBSyxPQUFMLEdBQWUsS0FBZjtBQUNBLFNBQUssYUFBTCxHQUFxQixLQUFyQjtBQUNBLFNBQUssY0FBTCxHQUFzQixLQUF0QjtBQUNBLFNBQUssaUJBQUwsR0FBeUIsZ0JBQXpCOztBQUVBLFlBQVEsaUJBQVIsQ0FBMEIsRUFBMUIsQ0FBNkIsU0FBN0IsRUFBd0MsU0FBUyxRQUFqRDtBQUNBLFlBQVEsaUJBQVIsQ0FBMEIsTUFBMUI7O0FBRUEsU0FBSyxLQUFMLEdBQWEsWUFBVztBQUNwQixnQkFBUSxjQUFSLEdBQXlCLElBQXpCO0FBQ0gsS0FGRDs7QUFJQSxTQUFLLE9BQUwsR0FBZSxZQUFXO0FBQ3RCLFlBQUksaUJBQWlCLFFBQVEsT0FBN0I7QUFBQSxZQUNJLGVBQWUsUUFBUSxhQUQzQjs7QUFHQSxnQkFBUSxhQUFSLEdBQXdCLEtBQXhCO0FBQ0EsZ0JBQVEsY0FBUixHQUF5QixLQUF6Qjs7QUFFQSxnQkFBUSxJQUFSO0FBQ0ksaUJBQU0sQ0FBQyxjQUFQO0FBQ0ksd0JBQVEsT0FBUixHQUFrQixJQUFsQjtBQUNBLHdCQUFRLElBQVIsQ0FBYSxJQUFiO0FBQ0E7QUFDSixpQkFBTSxrQkFBa0IsQ0FBQyxZQUF6QjtBQUNJLHdCQUFRLE9BQVIsR0FBa0IsS0FBbEI7QUFDQSx3QkFBUSxJQUFSLENBQWEsS0FBYjtBQUNBO0FBUlI7QUFVSCxLQWpCRDs7QUFtQkEsU0FBSyxRQUFMLEdBQWdCLFVBQVMsWUFBVCxFQUF1QjtBQUNuQyxZQUFJLFFBQVEsY0FBWixFQUE0QjtBQUN4QixvQkFBUSxhQUFSLEdBQXdCLElBQXhCO0FBQ0Esb0JBQVEsaUJBQVIsQ0FBMEIsY0FBMUIsQ0FBeUMsU0FBekMsRUFBb0QsU0FBUyxRQUE3RDtBQUNBLG9CQUFRLGlCQUFSLEdBQTRCLFlBQTVCO0FBQ0Esb0JBQVEsaUJBQVIsQ0FBMEIsRUFBMUIsQ0FBNkIsU0FBN0IsRUFBd0MsU0FBUyxRQUFqRDtBQUNBLG9CQUFRLGVBQVI7QUFDQSxvQkFBUSxpQkFBUixDQUEwQixNQUExQjtBQUNIO0FBQ0osS0FURDs7QUFXQSxTQUFLLEtBQUwsR0FBYSxVQUFTLFFBQVQsRUFBbUI7QUFDNUIsWUFBSSxDQUFDLFFBQVEsT0FBYixFQUFzQjtBQUNsQjtBQUNBO0FBQ0g7QUFDRCxpQkFBUyxLQUFULENBQWUsUUFBZjtBQUNILEtBTkQ7O0FBUUEsU0FBSyxJQUFMLEdBQVksU0FBUyxJQUFyQjtBQUNBLFNBQUssZUFBTCxHQUF1QixZQUFXO0FBQUUsZ0JBQVEsSUFBUixDQUFhLFVBQWIsRUFBeUIsUUFBUSxpQkFBUixDQUEwQixLQUFuRDtBQUE0RCxLQUFoRztBQUNIO0FBQ0QsS0FBSyxRQUFMLENBQWMsT0FBZCxFQUF1QixZQUF2Qjs7QUFFQSxPQUFPLE9BQVAsR0FBaUIsT0FBakI7OztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiY29uc3QgUHVzaCA9IHJlcXVpcmUoJ3B1c2gtd3JhcHBlcicpLFxuICAgIGZvcmVhY2ggPSByZXF1aXJlKCdsb2Rhc2guZm9yZWFjaCcpLFxuICAgIHBhcnRpYWwgPSByZXF1aXJlKCdsb2Rhc2gucGFydGlhbCcpLFxuICAgIFBsYXllciA9IHJlcXVpcmUoJy4vc3JjL3BsYXllci5qcycpLFxuICAgIGNvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0ID8gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKSA6IG5ldyB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0KCksXG4gICAgUmVwZXRhZSA9IHJlcXVpcmUoJy4vc3JjL3JlcGV0YWUuanMnKSxcbiAgICBSZXBlYXRlciA9IHJlcXVpcmUoJy4vc3JjL3JlcGVhdGVyLmpzJyksXG4gICAgQlBNID0gcmVxdWlyZSgnLi9zcmMvYnBtLmpzJyksXG4gICAgYnBtID0gbmV3IEJQTSgxMjApLFxuICAgIEludGVydmFsID0gcmVxdWlyZSgnLi9zcmMvaW50ZXJ2YWwuanMnKSxcbiAgICBpbnRlcnZhbHMgPSB7XG4gICAgICAgICcxLzQnOiBJbnRlcnZhbFsnNG4nXShicG0sICcxLzQnKSxcbiAgICAgICAgJzEvNHQnOiBJbnRlcnZhbFsnNG50J10oYnBtLCAnMS80dCcpLFxuICAgICAgICAnMS84JzogSW50ZXJ2YWxbJzhuJ10oYnBtLCAnMS84JyksXG4gICAgICAgICcxLzh0JzogSW50ZXJ2YWxbJzhudCddKGJwbSwgJzEvOHQnKSxcbiAgICAgICAgJzEvMTYnOiBJbnRlcnZhbFsnMTZuJ10oYnBtLCAnMS8xNicpLFxuICAgICAgICAnMS8xNnQnOiBJbnRlcnZhbFsnMTZudCddKGJwbSwgJzEvMTZ0JyksXG4gICAgICAgICcxLzMyJzogSW50ZXJ2YWxbJzMybiddKGJwbSwgJzEvMzInKSxcbiAgICAgICAgJzEvMzJ0JzogSW50ZXJ2YWxbJzMybnQnXShicG0sICcxLzMydCcpLFxuICAgIH0sXG4gICAgc2FtcGxlcyA9IFtcbiAgICAgICAgJ3NhbXBsZXMvQm9udXNfS2ljazI3Lm1wMycsXG4gICAgICAgICdzYW1wbGVzL3NuYXJlX3R1cm5ib290Lm1wMycsXG4gICAgICAgICdzYW1wbGVzL0hhbmRDbGFwLm1wMycsXG4gICAgICAgICdzYW1wbGVzL0JlYXQwN19IYXQubXAzJyxcbiAgICAgICAgJ3NhbXBsZXMvSEhfS0lUMDlfMTAwX1RNQi5tcDMnLFxuICAgICAgICAnc2FtcGxlcy9jbGluZ2ZpbG0ubXAzJyxcbiAgICAgICAgJ3NhbXBsZXMvdGFuZy0xLm1wMycsXG4gICAgICAgICdzYW1wbGVzL0Nhc3NldHRlODA4X1RvbTAxLm1wMydcbiAgICBdLFxuICAgIGZpbHRlcl9mcmVxdWVuY2llcyA9IFswLCAxMDAsIDIwMCwgNDAwLCA4MDAsIDIwMDAsIDYwMDAsIDEwMDAwLCAyMDAwMF07XG5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuICAgIGlmIChuYXZpZ2F0b3IucmVxdWVzdE1JRElBY2Nlc3MpIHtcbiAgICAgICAgbmF2aWdhdG9yLnJlcXVlc3RNSURJQWNjZXNzKHsgc3lzZXg6IHRydWUgfSlcbiAgICAgICAgICAgIC50aGVuKFB1c2guY3JlYXRlX2JvdW5kX3RvX3dlYl9taWRpX2FwaSlcbiAgICAgICAgICAgIC50aGVuKG9mZl93ZV9nbylcbiAgICB9IGVsc2Uge1xuICAgICAgICBQcm9taXNlLnJlc29sdmUobmV3IFB1c2goeyBzZW5kOiAoYnl0ZXMpID0+IHsgfSB9KSkudGhlbihvZmZfd2VfZ28pOyAvL3RvZG8gYWRkIG9uc2NyZWVuIHdhcm5pbmdcbiAgICB9XG59KTtcblxuZnVuY3Rpb24gb2ZmX3dlX2dvKGJvdW5kX3B1c2gpIHtcbiAgICBjb25zdCBidXR0b25zID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgncHVzaC13cmFwcGVyLWJ1dHRvbicpLFxuICAgICAgICBwbGF5ZXJzID0gY3JlYXRlX3BsYXllcnMoKSxcbiAgICAgICAgcHVzaCA9IGJvdW5kX3B1c2g7XG5cbiAgICBwdXNoLmxjZC5jbGVhcigpO1xuXG4gICAgZm9yZWFjaChwbGF5ZXJzLCAocGxheWVyLCBpKSA9PiB7XG4gICAgICAgIHZhciBjb2x1bW5fbnVtYmVyID0gaSArIDEsXG4gICAgICAgICAgICBmdWxsX3BhdGhfc2FtcGxlX25hbWUgPSBzYW1wbGVzW2ldLnNwbGl0KCcuJylbMF0sXG4gICAgICAgICAgICBzYW1wbGVfbmFtZSA9IGZ1bGxfcGF0aF9zYW1wbGVfbmFtZS5zcGxpdCgnLycpLnBvcCgpLFxuICAgICAgICAgICAgcmVwZXRhZSA9IG5ldyBSZXBldGFlKFJlcGVhdGVyLmNyZWF0ZV9zY2hlZHVsZWRfYnlfYXVkaW9fY29udGV4dChjb250ZXh0KSwgaW50ZXJ2YWxzWycxLzQnXSk7XG5cbiAgICAgICAgcHVzaC5ncmlkLnhbY29sdW1uX251bWJlcl0uc2VsZWN0Lm9uKCdwcmVzc2VkJywgcmVwZXRhZS5wcmVzcyk7XG4gICAgICAgIHB1c2guZ3JpZC54W2NvbHVtbl9udW1iZXJdLnNlbGVjdC5vbigncmVsZWFzZWQnLCByZXBldGFlLnJlbGVhc2UpO1xuXG4gICAgICAgIHB1c2guZ3JpZC54W2NvbHVtbl9udW1iZXJdLnNlbGVjdC5sZWRfb24oKTtcbiAgICAgICAgcmVwZXRhZS5vbignb24nLCBwYXJ0aWFsKHB1c2guZ3JpZC54W2NvbHVtbl9udW1iZXJdLnNlbGVjdC5sZWRfcmdiLCAwLCAwLCAyNTUpKTtcbiAgICAgICAgcmVwZXRhZS5vbignb2ZmJywgcHVzaC5ncmlkLnhbY29sdW1uX251bWJlcl0uc2VsZWN0LmxlZF9vbik7XG4gICAgICAgIHJlcGV0YWUub24oJ2ludGVydmFsJywgcHVzaC5sY2QueFtjb2x1bW5fbnVtYmVyXS55WzFdLnVwZGF0ZSk7XG5cbiAgICAgICAgcmVwZXRhZS5yZXBvcnRfaW50ZXJ2YWwoKTtcblxuICAgICAgICBmb3JlYWNoKGludGVydmFscywgKGludGVydmFsLCBidXR0b25fbmFtZSkgPT4ge1xuICAgICAgICAgICAgcHVzaC5idXR0b25bYnV0dG9uX25hbWVdLm9uKCdwcmVzc2VkJywgcGFydGlhbChyZXBldGFlLmludGVydmFsLCBpbnRlcnZhbCkpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHR1cm5fb2ZmX2NvbHVtbihwdXNoLCBjb2x1bW5fbnVtYmVyKTtcbiAgICAgICAgcHVzaC5sY2QueFtjb2x1bW5fbnVtYmVyXS55WzJdLnVwZGF0ZShzYW1wbGVfbmFtZS5sZW5ndGggPiA4ID8gc2FtcGxlX25hbWUuc3Vic3RyKHNhbXBsZV9uYW1lLmxlbmd0aCAtIDgpIDogc2FtcGxlX25hbWUpO1xuICAgICAgICBwbGF5ZXIub24oJ3N0YXJ0ZWQnLCBwYXJ0aWFsKHR1cm5fYnV0dG9uX2Rpc3BsYXlfb24sIGJ1dHRvbnNbaV0pKTtcbiAgICAgICAgcGxheWVyLm9uKCdzdG9wcGVkJywgcGFydGlhbCh0dXJuX2J1dHRvbl9kaXNwbGF5X29mZiwgYnV0dG9uc1tpXSkpO1xuICAgICAgICBwbGF5ZXIub24oJ3N0YXJ0ZWQnLCBwYXJ0aWFsKHR1cm5fb25fY29sdW1uLCBwdXNoLCBjb2x1bW5fbnVtYmVyKSk7XG4gICAgICAgIHBsYXllci5vbignc3RvcHBlZCcsIHBhcnRpYWwodHVybl9vZmZfY29sdW1uLCBwdXNoLCBjb2x1bW5fbnVtYmVyKSk7XG4gICAgICAgIGJ1dHRvbnNbaV0uYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgcGFydGlhbChwbGF5ZXIucGxheSwgMTEwLCBmaWx0ZXJfZnJlcXVlbmNpZXNbOF0pKTtcbiAgICAgICAgYmluZF9jb2x1bW5fdG9fcGxheWVyKHB1c2gsIHBsYXllciwgY29sdW1uX251bWJlciwgcmVwZXRhZSk7XG4gICAgfSk7XG5cbiAgICBmb3JlYWNoKGludGVydmFscywgKGludGVydmFsLCBidXR0b25fbmFtZSkgPT4ge1xuICAgICAgICBwdXNoLmJ1dHRvbltidXR0b25fbmFtZV0ubGVkX2RpbSgpO1xuICAgIH0pO1xuXG4gICAgYmluZF9waXRjaGJlbmQocHVzaCwgcGxheWVycyk7XG5cbiAgICBiaW5kUXdlcnR5dWlUb1BsYXliYWNrKHBsYXllcnMpO1xuICAgIGJpbmRfdGVtcG9fa25vYl90b19icG0ocHVzaCwgYnBtKTtcbiAgICBicG0ucmVwb3J0KCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZV9wbGF5ZXJzKCkge1xuICAgIHZhciBwbGF5ZXJzID0gW107XG4gICAgZm9yICh2YXIgIGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwbGF5ZXJzW2ldID0gbmV3IFBsYXllcihzYW1wbGVzW2ldLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHBsYXllcnM7XG59XG5cbmZ1bmN0aW9uIGJpbmRfY29sdW1uX3RvX3BsYXllcihwdXNoLCBwbGF5ZXIsIHgsIHJlcGV0YWUpIHtcbiAgICBsZXQgbXV0YWJsZV92ZWxvY2l0eSA9IDEyNyxcbiAgICAgICAgbXV0YWJsZV9mcmVxdWVuY3kgPSBmaWx0ZXJfZnJlcXVlbmNpZXNbOF0sXG4gICAgICAgIHByZXNzZWRfcGFkc19pbl9jb2wgPSAwO1xuXG4gICAgbGV0IHBsYXliYWNrID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHBsYXllci5wbGF5KG11dGFibGVfdmVsb2NpdHksIG11dGFibGVfZnJlcXVlbmN5KTtcbiAgICB9XG5cbiAgICBmb3JlYWNoKFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4XSwgKHkpID0+IHtcbiAgICAgICAgY29uc3QgZ3JpZF9idXR0b24gPSBwdXNoLmdyaWQueFt4XS55W3ldO1xuXG4gICAgICAgIGdyaWRfYnV0dG9uLm9uKCdwcmVzc2VkJywgKHZlbG9jaXR5KSA9PiB7XG4gICAgICAgICAgICBtdXRhYmxlX3ZlbG9jaXR5ID0gdmVsb2NpdHk7XG4gICAgICAgICAgICBtdXRhYmxlX2ZyZXF1ZW5jeSA9IGZpbHRlcl9mcmVxdWVuY2llc1t5XTtcbiAgICAgICAgICAgIGlmICgrK3ByZXNzZWRfcGFkc19pbl9jb2wgPT0gMSkgcmVwZXRhZS5zdGFydChwbGF5YmFjayk7XG4gICAgICAgIH0pO1xuICAgICAgICBncmlkX2J1dHRvbi5vbignYWZ0ZXJ0b3VjaCcsIChwcmVzc3VyZSkgPT4geyBpZiAocHJlc3N1cmUgPiAwKSBtdXRhYmxlX3ZlbG9jaXR5ID0gcHJlc3N1cmUgfSk7XG4gICAgICAgIGdyaWRfYnV0dG9uLm9uKCdyZWxlYXNlZCcsICgpID0+IHtcbiAgICAgICAgICAgIGlmICgtLXByZXNzZWRfcGFkc19pbl9jb2wgPT0gMCkgcmVwZXRhZS5zdG9wKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBiaW5kUXdlcnR5dWlUb1BsYXliYWNrKHBsYXllcnMpIHtcbiAgICBsZXQgbG9va3VwID0gezExMzogMCwgMTE5OiAxLCAxMDE6IDIsIDExNDogMywgMTE2OiA0LCAxMjE6IDUsIDExNzogNiwgMTA1OiA3fTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleXByZXNzXCIsIChldmVudCkgPT4ge1xuICAgICAgICBpZiAoZXZlbnQuY2hhckNvZGUgaW4gbG9va3VwKSB7XG4gICAgICAgICAgICBwbGF5ZXJzW2xvb2t1cFtldmVudC5jaGFyQ29kZV1dLnBsYXkoMTEwLCBmaWx0ZXJfZnJlcXVlbmNpZXNbOF0pO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHR1cm5fb25fY29sdW1uKHB1c2gsIHgsIHZlbG9jaXR5KSB7XG4gICAgZm9yZWFjaChbMSwgMiwgMywgNCwgNSwgNiwgNywgOF0sICh5KSA9PiB7XG4gICAgICAgIGlmICgoKHZlbG9jaXR5ICsgMTUpIC8gMTYpID49IHkpIHtcbiAgICAgICAgICAgIHB1c2guZ3JpZC54W3hdLnlbeV0ubGVkX29uKHZlbG9jaXR5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHB1c2guZ3JpZC54W3hdLnlbeV0ubGVkX29mZigpO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHR1cm5fb2ZmX2NvbHVtbihwdXNoLCB4KSB7XG4gICAgZm9yZWFjaChbMiwgMywgNCwgNSwgNiwgNywgOF0sICh5KSA9PiB7XG4gICAgICAgIHB1c2guZ3JpZC54W3hdLnlbeV0ubGVkX29mZigpO1xuICAgIH0pO1xuICAgIHB1c2guZ3JpZC54W3hdLnlbMV0ubGVkX29uKCk7XG59XG5cbmZ1bmN0aW9uIGJpbmRfcGl0Y2hiZW5kKHB1c2gsIHBsYXllcnMpIHtcbiAgICBwdXNoLnRvdWNoc3RyaXAub24oJ3BpdGNoYmVuZCcsIChwYikgPT4ge1xuICAgICAgICB2YXIgcmF0ZSA9IHBiID4gODE5MiA/IHBiIC8gNDA5NiA6IHBiIC8gODE5MjtcbiAgICAgICAgZm9yZWFjaChwbGF5ZXJzLCAocGxheWVyKSA9PiBwbGF5ZXIudXBkYXRlX3BsYXliYWNrX3JhdGUocmF0ZSkpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBiaW5kX3RlbXBvX2tub2JfdG9fYnBtKHB1c2gsIGJwbSkge1xuICAgIHB1c2gua25vYlsndGVtcG8nXS5vbigndHVybmVkJywgYnBtLmNoYW5nZV9ieSk7XG4gICAgYnBtLm9uKCdjaGFuZ2VkJywgYnBtID0+IHB1c2gubGNkLnhbMV0ueVszXS51cGRhdGUoJ2JwbT0gJyArIGJwbS5jdXJyZW50KSk7XG59XG5cbmZ1bmN0aW9uIHR1cm5fYnV0dG9uX2Rpc3BsYXlfb24odWlfYnRuKSB7XG4gICAgdWlfYnRuLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xufVxuXG5mdW5jdGlvbiB0dXJuX2J1dHRvbl9kaXNwbGF5X29mZih1aV9idG4pIHtcbiAgICB1aV9idG4uY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJyk7XG59XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuMCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuNy4wIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKipcbiAqIEEgc3BlY2lhbGl6ZWQgdmVyc2lvbiBvZiBgXy5mb3JFYWNoYCBmb3IgYXJyYXlzIHdpdGhvdXQgc3VwcG9ydCBmb3IgY2FsbGJhY2tcbiAqIHNob3J0aGFuZHMgb3IgYHRoaXNgIGJpbmRpbmcuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBpdGVyYXRlIG92ZXIuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBpdGVyYXRlZSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGBhcnJheWAuXG4gKi9cbmZ1bmN0aW9uIGFycmF5RWFjaChhcnJheSwgaXRlcmF0ZWUpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cbiAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICBpZiAoaXRlcmF0ZWUoYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpID09PSBmYWxzZSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiBhcnJheTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhcnJheUVhY2g7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuNCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xudmFyIGtleXMgPSByZXF1aXJlKCdsb2Rhc2gua2V5cycpO1xuXG4vKipcbiAqIFVzZWQgYXMgdGhlIFttYXhpbXVtIGxlbmd0aF0oaHR0cHM6Ly9wZW9wbGUubW96aWxsYS5vcmcvfmpvcmVuZG9yZmYvZXM2LWRyYWZ0Lmh0bWwjc2VjLW51bWJlci5tYXhfc2FmZV9pbnRlZ2VyKVxuICogb2YgYW4gYXJyYXktbGlrZSB2YWx1ZS5cbiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmZvckVhY2hgIHdpdGhvdXQgc3VwcG9ydCBmb3IgY2FsbGJhY2tcbiAqIHNob3J0aGFuZHMgYW5kIGB0aGlzYCBiaW5kaW5nLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gaXRlcmF0ZWUgVGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAqIEByZXR1cm5zIHtBcnJheXxPYmplY3R8c3RyaW5nfSBSZXR1cm5zIGBjb2xsZWN0aW9uYC5cbiAqL1xudmFyIGJhc2VFYWNoID0gY3JlYXRlQmFzZUVhY2goYmFzZUZvck93bik7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYGJhc2VGb3JJbmAgYW5kIGBiYXNlRm9yT3duYCB3aGljaCBpdGVyYXRlc1xuICogb3ZlciBgb2JqZWN0YCBwcm9wZXJ0aWVzIHJldHVybmVkIGJ5IGBrZXlzRnVuY2AgaW52b2tpbmcgYGl0ZXJhdGVlYCBmb3JcbiAqIGVhY2ggcHJvcGVydHkuIEl0ZXJhdGVlIGZ1bmN0aW9ucyBtYXkgZXhpdCBpdGVyYXRpb24gZWFybHkgYnkgZXhwbGljaXRseVxuICogcmV0dXJuaW5nIGBmYWxzZWAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBpdGVyYXRlZSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICogQHBhcmFtIHtGdW5jdGlvbn0ga2V5c0Z1bmMgVGhlIGZ1bmN0aW9uIHRvIGdldCB0aGUga2V5cyBvZiBgb2JqZWN0YC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbnZhciBiYXNlRm9yID0gY3JlYXRlQmFzZUZvcigpO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmZvck93bmAgd2l0aG91dCBzdXBwb3J0IGZvciBjYWxsYmFja1xuICogc2hvcnRoYW5kcyBhbmQgYHRoaXNgIGJpbmRpbmcuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBpdGVyYXRlZSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqL1xuZnVuY3Rpb24gYmFzZUZvck93bihvYmplY3QsIGl0ZXJhdGVlKSB7XG4gIHJldHVybiBiYXNlRm9yKG9iamVjdCwgaXRlcmF0ZWUsIGtleXMpO1xufVxuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBgYmFzZUVhY2hgIG9yIGBiYXNlRWFjaFJpZ2h0YCBmdW5jdGlvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZWFjaEZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGl0ZXJhdGUgb3ZlciBhIGNvbGxlY3Rpb24uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtmcm9tUmlnaHRdIFNwZWNpZnkgaXRlcmF0aW5nIGZyb20gcmlnaHQgdG8gbGVmdC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGJhc2UgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUJhc2VFYWNoKGVhY2hGdW5jLCBmcm9tUmlnaHQpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGNvbGxlY3Rpb24sIGl0ZXJhdGVlKSB7XG4gICAgdmFyIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBnZXRMZW5ndGgoY29sbGVjdGlvbikgOiAwO1xuICAgIGlmICghaXNMZW5ndGgobGVuZ3RoKSkge1xuICAgICAgcmV0dXJuIGVhY2hGdW5jKGNvbGxlY3Rpb24sIGl0ZXJhdGVlKTtcbiAgICB9XG4gICAgdmFyIGluZGV4ID0gZnJvbVJpZ2h0ID8gbGVuZ3RoIDogLTEsXG4gICAgICAgIGl0ZXJhYmxlID0gdG9PYmplY3QoY29sbGVjdGlvbik7XG5cbiAgICB3aGlsZSAoKGZyb21SaWdodCA/IGluZGV4LS0gOiArK2luZGV4IDwgbGVuZ3RoKSkge1xuICAgICAgaWYgKGl0ZXJhdGVlKGl0ZXJhYmxlW2luZGV4XSwgaW5kZXgsIGl0ZXJhYmxlKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb2xsZWN0aW9uO1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBiYXNlIGZ1bmN0aW9uIGZvciBgXy5mb3JJbmAgb3IgYF8uZm9ySW5SaWdodGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2Zyb21SaWdodF0gU3BlY2lmeSBpdGVyYXRpbmcgZnJvbSByaWdodCB0byBsZWZ0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYmFzZSBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlQmFzZUZvcihmcm9tUmlnaHQpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCwgaXRlcmF0ZWUsIGtleXNGdW5jKSB7XG4gICAgdmFyIGl0ZXJhYmxlID0gdG9PYmplY3Qob2JqZWN0KSxcbiAgICAgICAgcHJvcHMgPSBrZXlzRnVuYyhvYmplY3QpLFxuICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGgsXG4gICAgICAgIGluZGV4ID0gZnJvbVJpZ2h0ID8gbGVuZ3RoIDogLTE7XG5cbiAgICB3aGlsZSAoKGZyb21SaWdodCA/IGluZGV4LS0gOiArK2luZGV4IDwgbGVuZ3RoKSkge1xuICAgICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcbiAgICAgIGlmIChpdGVyYXRlZShpdGVyYWJsZVtrZXldLCBrZXksIGl0ZXJhYmxlKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmplY3Q7XG4gIH07XG59XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGxlbmd0aC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cHM6Ly9wZW9wbGUubW96aWxsYS5vcmcvfmpvcmVuZG9yZmYvZXM2LWRyYWZ0Lmh0bWwjc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGFuIG9iamVjdCBpZiBpdCdzIG5vdCBvbmUuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHByb2Nlc3MuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBvYmplY3QuXG4gKi9cbmZ1bmN0aW9uIHRvT2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdCh2YWx1ZSkgPyB2YWx1ZSA6IE9iamVjdCh2YWx1ZSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAvLyBBdm9pZCBhIFY4IEpJVCBidWcgaW4gQ2hyb21lIDE5LTIwLlxuICAvLyBTZWUgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTEgZm9yIG1vcmUgZGV0YWlscy5cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmFzZUVhY2g7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKipcbiAqIEEgc3BlY2lhbGl6ZWQgdmVyc2lvbiBvZiBgYmFzZUNhbGxiYWNrYCB3aGljaCBvbmx5IHN1cHBvcnRzIGB0aGlzYCBiaW5kaW5nXG4gKiBhbmQgc3BlY2lmeWluZyB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50cyB0byBwcm92aWRlIHRvIGBmdW5jYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYmluZC5cbiAqIEBwYXJhbSB7Kn0gdGhpc0FyZyBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtudW1iZXJ9IFthcmdDb3VudF0gVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdG8gcHJvdmlkZSB0byBgZnVuY2AuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIGNhbGxiYWNrLlxuICovXG5mdW5jdGlvbiBiaW5kQ2FsbGJhY2soZnVuYywgdGhpc0FyZywgYXJnQ291bnQpIHtcbiAgaWYgKHR5cGVvZiBmdW5jICE9ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gaWRlbnRpdHk7XG4gIH1cbiAgaWYgKHRoaXNBcmcgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBmdW5jO1xuICB9XG4gIHN3aXRjaCAoYXJnQ291bnQpIHtcbiAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSk7XG4gICAgfTtcbiAgICBjYXNlIDM6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICB9O1xuICAgIGNhc2UgNDogcmV0dXJuIGZ1bmN0aW9uKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgfTtcbiAgICBjYXNlIDU6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgb3RoZXIsIGtleSwgb2JqZWN0LCBzb3VyY2UpIHtcbiAgICAgIHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgdmFsdWUsIG90aGVyLCBrZXksIG9iamVjdCwgc291cmNlKTtcbiAgICB9O1xuICB9XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmd1bWVudHMpO1xuICB9O1xufVxuXG4vKipcbiAqIFRoaXMgbWV0aG9kIHJldHVybnMgdGhlIGZpcnN0IGFyZ3VtZW50IHByb3ZpZGVkIHRvIGl0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgVXRpbGl0eVxuICogQHBhcmFtIHsqfSB2YWx1ZSBBbnkgdmFsdWUuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyBgdmFsdWVgLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgb2JqZWN0ID0geyAndXNlcic6ICdmcmVkJyB9O1xuICpcbiAqIF8uaWRlbnRpdHkob2JqZWN0KSA9PT0gb2JqZWN0O1xuICogLy8gPT4gdHJ1ZVxuICovXG5mdW5jdGlvbiBpZGVudGl0eSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmluZENhbGxiYWNrO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4yLjAgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xudmFyIHJvb3QgPSByZXF1aXJlKCdsb2Rhc2guX3Jvb3QnKTtcblxuLyoqIFVzZWQgdG8gY29tcG9zZSBiaXRtYXNrcyBmb3Igd3JhcHBlciBtZXRhZGF0YS4gKi9cbnZhciBCSU5EX0ZMQUcgPSAxLFxuICAgIEJJTkRfS0VZX0ZMQUcgPSAyLFxuICAgIENVUlJZX0JPVU5EX0ZMQUcgPSA0LFxuICAgIENVUlJZX0ZMQUcgPSA4LFxuICAgIENVUlJZX1JJR0hUX0ZMQUcgPSAxNixcbiAgICBQQVJUSUFMX0ZMQUcgPSAzMixcbiAgICBQQVJUSUFMX1JJR0hUX0ZMQUcgPSA2NCxcbiAgICBBUllfRkxBRyA9IDEyOCxcbiAgICBGTElQX0ZMQUcgPSA1MTI7XG5cbi8qKiBVc2VkIGFzIHRoZSBgVHlwZUVycm9yYCBtZXNzYWdlIGZvciBcIkZ1bmN0aW9uc1wiIG1ldGhvZHMuICovXG52YXIgRlVOQ19FUlJPUl9URVhUID0gJ0V4cGVjdGVkIGEgZnVuY3Rpb24nO1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBJTkZJTklUWSA9IDEgLyAwLFxuICAgIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxLFxuICAgIE1BWF9JTlRFR0VSID0gMS43OTc2OTMxMzQ4NjIzMTU3ZSszMDgsXG4gICAgTkFOID0gMCAvIDA7XG5cbi8qKiBVc2VkIGFzIHRoZSBpbnRlcm5hbCBhcmd1bWVudCBwbGFjZWhvbGRlci4gKi9cbnZhciBQTEFDRUhPTERFUiA9ICdfX2xvZGFzaF9wbGFjZWhvbGRlcl9fJztcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgIGdlblRhZyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIHRvIG1hdGNoIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2UuICovXG52YXIgcmVUcmltID0gL15cXHMrfFxccyskL2c7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBiYWQgc2lnbmVkIGhleGFkZWNpbWFsIHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc0JhZEhleCA9IC9eWy0rXTB4WzAtOWEtZl0rJC9pO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgYmluYXJ5IHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc0JpbmFyeSA9IC9eMGJbMDFdKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IG9jdGFsIHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc09jdGFsID0gL14wb1swLTddKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IHVuc2lnbmVkIGludGVnZXIgdmFsdWVzLiAqL1xudmFyIHJlSXNVaW50ID0gL14oPzowfFsxLTldXFxkKikkLztcblxuLyoqIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHdpdGhvdXQgYSBkZXBlbmRlbmN5IG9uIGByb290YC4gKi9cbnZhciBmcmVlUGFyc2VJbnQgPSBwYXJzZUludDtcblxuLyoqXG4gKiBBIGZhc3RlciBhbHRlcm5hdGl2ZSB0byBgRnVuY3Rpb24jYXBwbHlgLCB0aGlzIGZ1bmN0aW9uIGludm9rZXMgYGZ1bmNgXG4gKiB3aXRoIHRoZSBgdGhpc2AgYmluZGluZyBvZiBgdGhpc0FyZ2AgYW5kIHRoZSBhcmd1bWVudHMgb2YgYGFyZ3NgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBpbnZva2UuXG4gKiBAcGFyYW0geyp9IHRoaXNBcmcgVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7Li4uKn0gYXJncyBUaGUgYXJndW1lbnRzIHRvIGludm9rZSBgZnVuY2Agd2l0aC5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSByZXN1bHQgb2YgYGZ1bmNgLlxuICovXG5mdW5jdGlvbiBhcHBseShmdW5jLCB0aGlzQXJnLCBhcmdzKSB7XG4gIHZhciBsZW5ndGggPSBhcmdzLmxlbmd0aDtcbiAgc3dpdGNoIChsZW5ndGgpIHtcbiAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpc0FyZyk7XG4gICAgY2FzZSAxOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFyZ3NbMF0pO1xuICAgIGNhc2UgMjogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhcmdzWzBdLCBhcmdzWzFdKTtcbiAgICBjYXNlIDM6IHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSk7XG4gIH1cbiAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIHZhbHVlID0gKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCByZUlzVWludC50ZXN0KHZhbHVlKSkgPyArdmFsdWUgOiAtMTtcbiAgbGVuZ3RoID0gbGVuZ3RoID09IG51bGwgPyBNQVhfU0FGRV9JTlRFR0VSIDogbGVuZ3RoO1xuICByZXR1cm4gdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8IGxlbmd0aDtcbn1cblxuLyoqXG4gKiBSZXBsYWNlcyBhbGwgYHBsYWNlaG9sZGVyYCBlbGVtZW50cyBpbiBgYXJyYXlgIHdpdGggYW4gaW50ZXJuYWwgcGxhY2Vob2xkZXJcbiAqIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mIHRoZWlyIGluZGV4ZXMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBtb2RpZnkuXG4gKiBAcGFyYW0geyp9IHBsYWNlaG9sZGVyIFRoZSBwbGFjZWhvbGRlciB0byByZXBsYWNlLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBuZXcgYXJyYXkgb2YgcGxhY2Vob2xkZXIgaW5kZXhlcy5cbiAqL1xuZnVuY3Rpb24gcmVwbGFjZUhvbGRlcnMoYXJyYXksIHBsYWNlaG9sZGVyKSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgbGVuZ3RoID0gYXJyYXkubGVuZ3RoLFxuICAgICAgcmVzSW5kZXggPSAtMSxcbiAgICAgIHJlc3VsdCA9IFtdO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgaWYgKGFycmF5W2luZGV4XSA9PT0gcGxhY2Vob2xkZXIpIHtcbiAgICAgIGFycmF5W2luZGV4XSA9IFBMQUNFSE9MREVSO1xuICAgICAgcmVzdWx0WysrcmVzSW5kZXhdID0gaW5kZXg7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVNYXggPSBNYXRoLm1heCxcbiAgICBuYXRpdmVNaW4gPSBNYXRoLm1pbjtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5jcmVhdGVgIHdpdGhvdXQgc3VwcG9ydCBmb3IgYXNzaWduaW5nXG4gKiBwcm9wZXJ0aWVzIHRvIHRoZSBjcmVhdGVkIG9iamVjdC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IHByb3RvdHlwZSBUaGUgb2JqZWN0IHRvIGluaGVyaXQgZnJvbS5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIG5ldyBvYmplY3QuXG4gKi9cbnZhciBiYXNlQ3JlYXRlID0gKGZ1bmN0aW9uKCkge1xuICBmdW5jdGlvbiBvYmplY3QoKSB7fVxuICByZXR1cm4gZnVuY3Rpb24ocHJvdG90eXBlKSB7XG4gICAgaWYgKGlzT2JqZWN0KHByb3RvdHlwZSkpIHtcbiAgICAgIG9iamVjdC5wcm90b3R5cGUgPSBwcm90b3R5cGU7XG4gICAgICB2YXIgcmVzdWx0ID0gbmV3IG9iamVjdDtcbiAgICAgIG9iamVjdC5wcm90b3R5cGUgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQgfHwge307XG4gIH07XG59KCkpO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgdGhhdCBpcyB0aGUgY29tcG9zaXRpb24gb2YgcGFydGlhbGx5IGFwcGxpZWQgYXJndW1lbnRzLFxuICogcGxhY2Vob2xkZXJzLCBhbmQgcHJvdmlkZWQgYXJndW1lbnRzIGludG8gYSBzaW5nbGUgYXJyYXkgb2YgYXJndW1lbnRzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gYXJncyBUaGUgcHJvdmlkZWQgYXJndW1lbnRzLlxuICogQHBhcmFtIHtBcnJheX0gcGFydGlhbHMgVGhlIGFyZ3VtZW50cyB0byBwcmVwZW5kIHRvIHRob3NlIHByb3ZpZGVkLlxuICogQHBhcmFtIHtBcnJheX0gaG9sZGVycyBUaGUgYHBhcnRpYWxzYCBwbGFjZWhvbGRlciBpbmRleGVzLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBuZXcgYXJyYXkgb2YgY29tcG9zZWQgYXJndW1lbnRzLlxuICovXG5mdW5jdGlvbiBjb21wb3NlQXJncyhhcmdzLCBwYXJ0aWFscywgaG9sZGVycykge1xuICB2YXIgaG9sZGVyc0xlbmd0aCA9IGhvbGRlcnMubGVuZ3RoLFxuICAgICAgYXJnc0luZGV4ID0gLTEsXG4gICAgICBhcmdzTGVuZ3RoID0gbmF0aXZlTWF4KGFyZ3MubGVuZ3RoIC0gaG9sZGVyc0xlbmd0aCwgMCksXG4gICAgICBsZWZ0SW5kZXggPSAtMSxcbiAgICAgIGxlZnRMZW5ndGggPSBwYXJ0aWFscy5sZW5ndGgsXG4gICAgICByZXN1bHQgPSBBcnJheShsZWZ0TGVuZ3RoICsgYXJnc0xlbmd0aCk7XG5cbiAgd2hpbGUgKCsrbGVmdEluZGV4IDwgbGVmdExlbmd0aCkge1xuICAgIHJlc3VsdFtsZWZ0SW5kZXhdID0gcGFydGlhbHNbbGVmdEluZGV4XTtcbiAgfVxuICB3aGlsZSAoKythcmdzSW5kZXggPCBob2xkZXJzTGVuZ3RoKSB7XG4gICAgcmVzdWx0W2hvbGRlcnNbYXJnc0luZGV4XV0gPSBhcmdzW2FyZ3NJbmRleF07XG4gIH1cbiAgd2hpbGUgKGFyZ3NMZW5ndGgtLSkge1xuICAgIHJlc3VsdFtsZWZ0SW5kZXgrK10gPSBhcmdzW2FyZ3NJbmRleCsrXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gaXMgbGlrZSBgY29tcG9zZUFyZ3NgIGV4Y2VwdCB0aGF0IHRoZSBhcmd1bWVudHMgY29tcG9zaXRpb25cbiAqIGlzIHRhaWxvcmVkIGZvciBgXy5wYXJ0aWFsUmlnaHRgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gYXJncyBUaGUgcHJvdmlkZWQgYXJndW1lbnRzLlxuICogQHBhcmFtIHtBcnJheX0gcGFydGlhbHMgVGhlIGFyZ3VtZW50cyB0byBhcHBlbmQgdG8gdGhvc2UgcHJvdmlkZWQuXG4gKiBAcGFyYW0ge0FycmF5fSBob2xkZXJzIFRoZSBgcGFydGlhbHNgIHBsYWNlaG9sZGVyIGluZGV4ZXMuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIG5ldyBhcnJheSBvZiBjb21wb3NlZCBhcmd1bWVudHMuXG4gKi9cbmZ1bmN0aW9uIGNvbXBvc2VBcmdzUmlnaHQoYXJncywgcGFydGlhbHMsIGhvbGRlcnMpIHtcbiAgdmFyIGhvbGRlcnNJbmRleCA9IC0xLFxuICAgICAgaG9sZGVyc0xlbmd0aCA9IGhvbGRlcnMubGVuZ3RoLFxuICAgICAgYXJnc0luZGV4ID0gLTEsXG4gICAgICBhcmdzTGVuZ3RoID0gbmF0aXZlTWF4KGFyZ3MubGVuZ3RoIC0gaG9sZGVyc0xlbmd0aCwgMCksXG4gICAgICByaWdodEluZGV4ID0gLTEsXG4gICAgICByaWdodExlbmd0aCA9IHBhcnRpYWxzLmxlbmd0aCxcbiAgICAgIHJlc3VsdCA9IEFycmF5KGFyZ3NMZW5ndGggKyByaWdodExlbmd0aCk7XG5cbiAgd2hpbGUgKCsrYXJnc0luZGV4IDwgYXJnc0xlbmd0aCkge1xuICAgIHJlc3VsdFthcmdzSW5kZXhdID0gYXJnc1thcmdzSW5kZXhdO1xuICB9XG4gIHZhciBvZmZzZXQgPSBhcmdzSW5kZXg7XG4gIHdoaWxlICgrK3JpZ2h0SW5kZXggPCByaWdodExlbmd0aCkge1xuICAgIHJlc3VsdFtvZmZzZXQgKyByaWdodEluZGV4XSA9IHBhcnRpYWxzW3JpZ2h0SW5kZXhdO1xuICB9XG4gIHdoaWxlICgrK2hvbGRlcnNJbmRleCA8IGhvbGRlcnNMZW5ndGgpIHtcbiAgICByZXN1bHRbb2Zmc2V0ICsgaG9sZGVyc1tob2xkZXJzSW5kZXhdXSA9IGFyZ3NbYXJnc0luZGV4KytdO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogQ29waWVzIHRoZSB2YWx1ZXMgb2YgYHNvdXJjZWAgdG8gYGFycmF5YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheX0gc291cmNlIFRoZSBhcnJheSB0byBjb3B5IHZhbHVlcyBmcm9tLlxuICogQHBhcmFtIHtBcnJheX0gW2FycmF5PVtdXSBUaGUgYXJyYXkgdG8gY29weSB2YWx1ZXMgdG8uXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYGFycmF5YC5cbiAqL1xuZnVuY3Rpb24gY29weUFycmF5KHNvdXJjZSwgYXJyYXkpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBsZW5ndGggPSBzb3VyY2UubGVuZ3RoO1xuXG4gIGFycmF5IHx8IChhcnJheSA9IEFycmF5KGxlbmd0aCkpO1xuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIGFycmF5W2luZGV4XSA9IHNvdXJjZVtpbmRleF07XG4gIH1cbiAgcmV0dXJuIGFycmF5O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHdyYXBzIGBmdW5jYCB0byBpbnZva2UgaXQgd2l0aCB0aGUgb3B0aW9uYWwgYHRoaXNgXG4gKiBiaW5kaW5nIG9mIGB0aGlzQXJnYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gd3JhcC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBiaXRtYXNrIFRoZSBiaXRtYXNrIG9mIHdyYXBwZXIgZmxhZ3MuIFNlZSBgY3JlYXRlV3JhcHBlcmAgZm9yIG1vcmUgZGV0YWlscy5cbiAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB3cmFwcGVkIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVCYXNlV3JhcHBlcihmdW5jLCBiaXRtYXNrLCB0aGlzQXJnKSB7XG4gIHZhciBpc0JpbmQgPSBiaXRtYXNrICYgQklORF9GTEFHLFxuICAgICAgQ3RvciA9IGNyZWF0ZUN0b3JXcmFwcGVyKGZ1bmMpO1xuXG4gIGZ1bmN0aW9uIHdyYXBwZXIoKSB7XG4gICAgdmFyIGZuID0gKHRoaXMgJiYgdGhpcyAhPT0gcm9vdCAmJiB0aGlzIGluc3RhbmNlb2Ygd3JhcHBlcikgPyBDdG9yIDogZnVuYztcbiAgICByZXR1cm4gZm4uYXBwbHkoaXNCaW5kID8gdGhpc0FyZyA6IHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cbiAgcmV0dXJuIHdyYXBwZXI7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgcHJvZHVjZXMgYW4gaW5zdGFuY2Ugb2YgYEN0b3JgIHJlZ2FyZGxlc3Mgb2ZcbiAqIHdoZXRoZXIgaXQgd2FzIGludm9rZWQgYXMgcGFydCBvZiBhIGBuZXdgIGV4cHJlc3Npb24gb3IgYnkgYGNhbGxgIG9yIGBhcHBseWAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IEN0b3IgVGhlIGNvbnN0cnVjdG9yIHRvIHdyYXAuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB3cmFwcGVkIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVDdG9yV3JhcHBlcihDdG9yKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAvLyBVc2UgYSBgc3dpdGNoYCBzdGF0ZW1lbnQgdG8gd29yayB3aXRoIGNsYXNzIGNvbnN0cnVjdG9ycy5cbiAgICAvLyBTZWUgaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtZWNtYXNjcmlwdC1mdW5jdGlvbi1vYmplY3RzLWNhbGwtdGhpc2FyZ3VtZW50LWFyZ3VtZW50c2xpc3RcbiAgICAvLyBmb3IgbW9yZSBkZXRhaWxzLlxuICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMDogcmV0dXJuIG5ldyBDdG9yO1xuICAgICAgY2FzZSAxOiByZXR1cm4gbmV3IEN0b3IoYXJnc1swXSk7XG4gICAgICBjYXNlIDI6IHJldHVybiBuZXcgQ3RvcihhcmdzWzBdLCBhcmdzWzFdKTtcbiAgICAgIGNhc2UgMzogcmV0dXJuIG5ldyBDdG9yKGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0pO1xuICAgICAgY2FzZSA0OiByZXR1cm4gbmV3IEN0b3IoYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSwgYXJnc1szXSk7XG4gICAgICBjYXNlIDU6IHJldHVybiBuZXcgQ3RvcihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdLCBhcmdzWzRdKTtcbiAgICAgIGNhc2UgNjogcmV0dXJuIG5ldyBDdG9yKGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10sIGFyZ3NbNF0sIGFyZ3NbNV0pO1xuICAgICAgY2FzZSA3OiByZXR1cm4gbmV3IEN0b3IoYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSwgYXJnc1szXSwgYXJnc1s0XSwgYXJnc1s1XSwgYXJnc1s2XSk7XG4gICAgfVxuICAgIHZhciB0aGlzQmluZGluZyA9IGJhc2VDcmVhdGUoQ3Rvci5wcm90b3R5cGUpLFxuICAgICAgICByZXN1bHQgPSBDdG9yLmFwcGx5KHRoaXNCaW5kaW5nLCBhcmdzKTtcblxuICAgIC8vIE1pbWljIHRoZSBjb25zdHJ1Y3RvcidzIGByZXR1cm5gIGJlaGF2aW9yLlxuICAgIC8vIFNlZSBodHRwczovL2VzNS5naXRodWIuaW8vI3gxMy4yLjIgZm9yIG1vcmUgZGV0YWlscy5cbiAgICByZXR1cm4gaXNPYmplY3QocmVzdWx0KSA/IHJlc3VsdCA6IHRoaXNCaW5kaW5nO1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHdyYXBzIGBmdW5jYCB0byBlbmFibGUgY3VycnlpbmcuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHdyYXAuXG4gKiBAcGFyYW0ge251bWJlcn0gYml0bWFzayBUaGUgYml0bWFzayBvZiB3cmFwcGVyIGZsYWdzLiBTZWUgYGNyZWF0ZVdyYXBwZXJgIGZvciBtb3JlIGRldGFpbHMuXG4gKiBAcGFyYW0ge251bWJlcn0gYXJpdHkgVGhlIGFyaXR5IG9mIGBmdW5jYC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUN1cnJ5V3JhcHBlcihmdW5jLCBiaXRtYXNrLCBhcml0eSkge1xuICB2YXIgQ3RvciA9IGNyZWF0ZUN0b3JXcmFwcGVyKGZ1bmMpO1xuXG4gIGZ1bmN0aW9uIHdyYXBwZXIoKSB7XG4gICAgdmFyIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGluZGV4ID0gbGVuZ3RoLFxuICAgICAgICBhcmdzID0gQXJyYXkobGVuZ3RoKSxcbiAgICAgICAgZm4gPSAodGhpcyAmJiB0aGlzICE9PSByb290ICYmIHRoaXMgaW5zdGFuY2VvZiB3cmFwcGVyKSA/IEN0b3IgOiBmdW5jLFxuICAgICAgICBwbGFjZWhvbGRlciA9IHdyYXBwZXIucGxhY2Vob2xkZXI7XG5cbiAgICB3aGlsZSAoaW5kZXgtLSkge1xuICAgICAgYXJnc1tpbmRleF0gPSBhcmd1bWVudHNbaW5kZXhdO1xuICAgIH1cbiAgICB2YXIgaG9sZGVycyA9IChsZW5ndGggPCAzICYmIGFyZ3NbMF0gIT09IHBsYWNlaG9sZGVyICYmIGFyZ3NbbGVuZ3RoIC0gMV0gIT09IHBsYWNlaG9sZGVyKVxuICAgICAgPyBbXVxuICAgICAgOiByZXBsYWNlSG9sZGVycyhhcmdzLCBwbGFjZWhvbGRlcik7XG5cbiAgICBsZW5ndGggLT0gaG9sZGVycy5sZW5ndGg7XG4gICAgcmV0dXJuIGxlbmd0aCA8IGFyaXR5XG4gICAgICA/IGNyZWF0ZVJlY3VycnlXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIGNyZWF0ZUh5YnJpZFdyYXBwZXIsIHBsYWNlaG9sZGVyLCB1bmRlZmluZWQsIGFyZ3MsIGhvbGRlcnMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBhcml0eSAtIGxlbmd0aClcbiAgICAgIDogYXBwbHkoZm4sIHRoaXMsIGFyZ3MpO1xuICB9XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHdyYXBzIGBmdW5jYCB0byBpbnZva2UgaXQgd2l0aCBvcHRpb25hbCBgdGhpc2BcbiAqIGJpbmRpbmcgb2YgYHRoaXNBcmdgLCBwYXJ0aWFsIGFwcGxpY2F0aW9uLCBhbmQgY3VycnlpbmcuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb258c3RyaW5nfSBmdW5jIFRoZSBmdW5jdGlvbiBvciBtZXRob2QgbmFtZSB0byB3cmFwLlxuICogQHBhcmFtIHtudW1iZXJ9IGJpdG1hc2sgVGhlIGJpdG1hc2sgb2Ygd3JhcHBlciBmbGFncy4gU2VlIGBjcmVhdGVXcmFwcGVyYCBmb3IgbW9yZSBkZXRhaWxzLlxuICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7QXJyYXl9IFtwYXJ0aWFsc10gVGhlIGFyZ3VtZW50cyB0byBwcmVwZW5kIHRvIHRob3NlIHByb3ZpZGVkIHRvIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAcGFyYW0ge0FycmF5fSBbaG9sZGVyc10gVGhlIGBwYXJ0aWFsc2AgcGxhY2Vob2xkZXIgaW5kZXhlcy5cbiAqIEBwYXJhbSB7QXJyYXl9IFtwYXJ0aWFsc1JpZ2h0XSBUaGUgYXJndW1lbnRzIHRvIGFwcGVuZCB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQHBhcmFtIHtBcnJheX0gW2hvbGRlcnNSaWdodF0gVGhlIGBwYXJ0aWFsc1JpZ2h0YCBwbGFjZWhvbGRlciBpbmRleGVzLlxuICogQHBhcmFtIHtBcnJheX0gW2FyZ1Bvc10gVGhlIGFyZ3VtZW50IHBvc2l0aW9ucyBvZiB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQHBhcmFtIHtudW1iZXJ9IFthcnldIFRoZSBhcml0eSBjYXAgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtudW1iZXJ9IFthcml0eV0gVGhlIGFyaXR5IG9mIGBmdW5jYC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUh5YnJpZFdyYXBwZXIoZnVuYywgYml0bWFzaywgdGhpc0FyZywgcGFydGlhbHMsIGhvbGRlcnMsIHBhcnRpYWxzUmlnaHQsIGhvbGRlcnNSaWdodCwgYXJnUG9zLCBhcnksIGFyaXR5KSB7XG4gIHZhciBpc0FyeSA9IGJpdG1hc2sgJiBBUllfRkxBRyxcbiAgICAgIGlzQmluZCA9IGJpdG1hc2sgJiBCSU5EX0ZMQUcsXG4gICAgICBpc0JpbmRLZXkgPSBiaXRtYXNrICYgQklORF9LRVlfRkxBRyxcbiAgICAgIGlzQ3VycnkgPSBiaXRtYXNrICYgQ1VSUllfRkxBRyxcbiAgICAgIGlzQ3VycnlSaWdodCA9IGJpdG1hc2sgJiBDVVJSWV9SSUdIVF9GTEFHLFxuICAgICAgaXNGbGlwID0gYml0bWFzayAmIEZMSVBfRkxBRyxcbiAgICAgIEN0b3IgPSBpc0JpbmRLZXkgPyB1bmRlZmluZWQgOiBjcmVhdGVDdG9yV3JhcHBlcihmdW5jKTtcblxuICBmdW5jdGlvbiB3cmFwcGVyKCkge1xuICAgIHZhciBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICBpbmRleCA9IGxlbmd0aCxcbiAgICAgICAgYXJncyA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoaW5kZXgtLSkge1xuICAgICAgYXJnc1tpbmRleF0gPSBhcmd1bWVudHNbaW5kZXhdO1xuICAgIH1cbiAgICBpZiAocGFydGlhbHMpIHtcbiAgICAgIGFyZ3MgPSBjb21wb3NlQXJncyhhcmdzLCBwYXJ0aWFscywgaG9sZGVycyk7XG4gICAgfVxuICAgIGlmIChwYXJ0aWFsc1JpZ2h0KSB7XG4gICAgICBhcmdzID0gY29tcG9zZUFyZ3NSaWdodChhcmdzLCBwYXJ0aWFsc1JpZ2h0LCBob2xkZXJzUmlnaHQpO1xuICAgIH1cbiAgICBpZiAoaXNDdXJyeSB8fCBpc0N1cnJ5UmlnaHQpIHtcbiAgICAgIHZhciBwbGFjZWhvbGRlciA9IHdyYXBwZXIucGxhY2Vob2xkZXIsXG4gICAgICAgICAgYXJnc0hvbGRlcnMgPSByZXBsYWNlSG9sZGVycyhhcmdzLCBwbGFjZWhvbGRlcik7XG5cbiAgICAgIGxlbmd0aCAtPSBhcmdzSG9sZGVycy5sZW5ndGg7XG4gICAgICBpZiAobGVuZ3RoIDwgYXJpdHkpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVJlY3VycnlXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIGNyZWF0ZUh5YnJpZFdyYXBwZXIsIHBsYWNlaG9sZGVyLCB0aGlzQXJnLCBhcmdzLCBhcmdzSG9sZGVycywgYXJnUG9zLCBhcnksIGFyaXR5IC0gbGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIHRoaXNCaW5kaW5nID0gaXNCaW5kID8gdGhpc0FyZyA6IHRoaXMsXG4gICAgICAgIGZuID0gaXNCaW5kS2V5ID8gdGhpc0JpbmRpbmdbZnVuY10gOiBmdW5jO1xuXG4gICAgaWYgKGFyZ1Bvcykge1xuICAgICAgYXJncyA9IHJlb3JkZXIoYXJncywgYXJnUG9zKTtcbiAgICB9IGVsc2UgaWYgKGlzRmxpcCAmJiBhcmdzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGFyZ3MucmV2ZXJzZSgpO1xuICAgIH1cbiAgICBpZiAoaXNBcnkgJiYgYXJ5IDwgYXJncy5sZW5ndGgpIHtcbiAgICAgIGFyZ3MubGVuZ3RoID0gYXJ5O1xuICAgIH1cbiAgICBpZiAodGhpcyAmJiB0aGlzICE9PSByb290ICYmIHRoaXMgaW5zdGFuY2VvZiB3cmFwcGVyKSB7XG4gICAgICBmbiA9IEN0b3IgfHwgY3JlYXRlQ3RvcldyYXBwZXIoZm4pO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpc0JpbmRpbmcsIGFyZ3MpO1xuICB9XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHdyYXBzIGBmdW5jYCB0byBpbnZva2UgaXQgd2l0aCB0aGUgb3B0aW9uYWwgYHRoaXNgXG4gKiBiaW5kaW5nIG9mIGB0aGlzQXJnYCBhbmQgdGhlIGBwYXJ0aWFsc2AgcHJlcGVuZGVkIHRvIHRob3NlIHByb3ZpZGVkIHRvXG4gKiB0aGUgd3JhcHBlci5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gd3JhcC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBiaXRtYXNrIFRoZSBiaXRtYXNrIG9mIHdyYXBwZXIgZmxhZ3MuIFNlZSBgY3JlYXRlV3JhcHBlcmAgZm9yIG1vcmUgZGV0YWlscy5cbiAqIEBwYXJhbSB7Kn0gdGhpc0FyZyBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtBcnJheX0gcGFydGlhbHMgVGhlIGFyZ3VtZW50cyB0byBwcmVwZW5kIHRvIHRob3NlIHByb3ZpZGVkIHRvIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB3cmFwcGVkIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVQYXJ0aWFsV3JhcHBlcihmdW5jLCBiaXRtYXNrLCB0aGlzQXJnLCBwYXJ0aWFscykge1xuICB2YXIgaXNCaW5kID0gYml0bWFzayAmIEJJTkRfRkxBRyxcbiAgICAgIEN0b3IgPSBjcmVhdGVDdG9yV3JhcHBlcihmdW5jKTtcblxuICBmdW5jdGlvbiB3cmFwcGVyKCkge1xuICAgIHZhciBhcmdzSW5kZXggPSAtMSxcbiAgICAgICAgYXJnc0xlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsXG4gICAgICAgIGxlZnRJbmRleCA9IC0xLFxuICAgICAgICBsZWZ0TGVuZ3RoID0gcGFydGlhbHMubGVuZ3RoLFxuICAgICAgICBhcmdzID0gQXJyYXkobGVmdExlbmd0aCArIGFyZ3NMZW5ndGgpLFxuICAgICAgICBmbiA9ICh0aGlzICYmIHRoaXMgIT09IHJvb3QgJiYgdGhpcyBpbnN0YW5jZW9mIHdyYXBwZXIpID8gQ3RvciA6IGZ1bmM7XG5cbiAgICB3aGlsZSAoKytsZWZ0SW5kZXggPCBsZWZ0TGVuZ3RoKSB7XG4gICAgICBhcmdzW2xlZnRJbmRleF0gPSBwYXJ0aWFsc1tsZWZ0SW5kZXhdO1xuICAgIH1cbiAgICB3aGlsZSAoYXJnc0xlbmd0aC0tKSB7XG4gICAgICBhcmdzW2xlZnRJbmRleCsrXSA9IGFyZ3VtZW50c1srK2FyZ3NJbmRleF07XG4gICAgfVxuICAgIHJldHVybiBhcHBseShmbiwgaXNCaW5kID8gdGhpc0FyZyA6IHRoaXMsIGFyZ3MpO1xuICB9XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IHdyYXBzIGBmdW5jYCB0byBjb250aW51ZSBjdXJyeWluZy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gd3JhcC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBiaXRtYXNrIFRoZSBiaXRtYXNrIG9mIHdyYXBwZXIgZmxhZ3MuIFNlZSBgY3JlYXRlV3JhcHBlcmAgZm9yIG1vcmUgZGV0YWlscy5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHdyYXBGdW5jIFRoZSBmdW5jdGlvbiB0byBjcmVhdGUgdGhlIGBmdW5jYCB3cmFwcGVyLlxuICogQHBhcmFtIHsqfSBwbGFjZWhvbGRlciBUaGUgcGxhY2Vob2xkZXIgdG8gcmVwbGFjZS5cbiAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge0FycmF5fSBbcGFydGlhbHNdIFRoZSBhcmd1bWVudHMgdG8gcHJlcGVuZCB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQHBhcmFtIHtBcnJheX0gW2hvbGRlcnNdIFRoZSBgcGFydGlhbHNgIHBsYWNlaG9sZGVyIGluZGV4ZXMuXG4gKiBAcGFyYW0ge0FycmF5fSBbYXJnUG9zXSBUaGUgYXJndW1lbnQgcG9zaXRpb25zIG9mIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyeV0gVGhlIGFyaXR5IGNhcCBvZiBgZnVuY2AuXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyaXR5XSBUaGUgYXJpdHkgb2YgYGZ1bmNgLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgd3JhcHBlZCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlUmVjdXJyeVdyYXBwZXIoZnVuYywgYml0bWFzaywgd3JhcEZ1bmMsIHBsYWNlaG9sZGVyLCB0aGlzQXJnLCBwYXJ0aWFscywgaG9sZGVycywgYXJnUG9zLCBhcnksIGFyaXR5KSB7XG4gIHZhciBpc0N1cnJ5ID0gYml0bWFzayAmIENVUlJZX0ZMQUcsXG4gICAgICBuZXdBcmdQb3MgPSBhcmdQb3MgPyBjb3B5QXJyYXkoYXJnUG9zKSA6IHVuZGVmaW5lZCxcbiAgICAgIG5ld3NIb2xkZXJzID0gaXNDdXJyeSA/IGhvbGRlcnMgOiB1bmRlZmluZWQsXG4gICAgICBuZXdIb2xkZXJzUmlnaHQgPSBpc0N1cnJ5ID8gdW5kZWZpbmVkIDogaG9sZGVycyxcbiAgICAgIG5ld1BhcnRpYWxzID0gaXNDdXJyeSA/IHBhcnRpYWxzIDogdW5kZWZpbmVkLFxuICAgICAgbmV3UGFydGlhbHNSaWdodCA9IGlzQ3VycnkgPyB1bmRlZmluZWQgOiBwYXJ0aWFscztcblxuICBiaXRtYXNrIHw9IChpc0N1cnJ5ID8gUEFSVElBTF9GTEFHIDogUEFSVElBTF9SSUdIVF9GTEFHKTtcbiAgYml0bWFzayAmPSB+KGlzQ3VycnkgPyBQQVJUSUFMX1JJR0hUX0ZMQUcgOiBQQVJUSUFMX0ZMQUcpO1xuXG4gIGlmICghKGJpdG1hc2sgJiBDVVJSWV9CT1VORF9GTEFHKSkge1xuICAgIGJpdG1hc2sgJj0gfihCSU5EX0ZMQUcgfCBCSU5EX0tFWV9GTEFHKTtcbiAgfVxuICB2YXIgcmVzdWx0ID0gd3JhcEZ1bmMoZnVuYywgYml0bWFzaywgdGhpc0FyZywgbmV3UGFydGlhbHMsIG5ld3NIb2xkZXJzLCBuZXdQYXJ0aWFsc1JpZ2h0LCBuZXdIb2xkZXJzUmlnaHQsIG5ld0FyZ1BvcywgYXJ5LCBhcml0eSk7XG5cbiAgcmVzdWx0LnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgZWl0aGVyIGN1cnJpZXMgb3IgaW52b2tlcyBgZnVuY2Agd2l0aCBvcHRpb25hbFxuICogYHRoaXNgIGJpbmRpbmcgYW5kIHBhcnRpYWxseSBhcHBsaWVkIGFyZ3VtZW50cy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbnxzdHJpbmd9IGZ1bmMgVGhlIGZ1bmN0aW9uIG9yIG1ldGhvZCBuYW1lIHRvIHdyYXAuXG4gKiBAcGFyYW0ge251bWJlcn0gYml0bWFzayBUaGUgYml0bWFzayBvZiB3cmFwcGVyIGZsYWdzLlxuICogIFRoZSBiaXRtYXNrIG1heSBiZSBjb21wb3NlZCBvZiB0aGUgZm9sbG93aW5nIGZsYWdzOlxuICogICAgIDEgLSBgXy5iaW5kYFxuICogICAgIDIgLSBgXy5iaW5kS2V5YFxuICogICAgIDQgLSBgXy5jdXJyeWAgb3IgYF8uY3VycnlSaWdodGAgb2YgYSBib3VuZCBmdW5jdGlvblxuICogICAgIDggLSBgXy5jdXJyeWBcbiAqICAgIDE2IC0gYF8uY3VycnlSaWdodGBcbiAqICAgIDMyIC0gYF8ucGFydGlhbGBcbiAqICAgIDY0IC0gYF8ucGFydGlhbFJpZ2h0YFxuICogICAxMjggLSBgXy5yZWFyZ2BcbiAqICAgMjU2IC0gYF8uYXJ5YFxuICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7QXJyYXl9IFtwYXJ0aWFsc10gVGhlIGFyZ3VtZW50cyB0byBiZSBwYXJ0aWFsbHkgYXBwbGllZC5cbiAqIEBwYXJhbSB7QXJyYXl9IFtob2xkZXJzXSBUaGUgYHBhcnRpYWxzYCBwbGFjZWhvbGRlciBpbmRleGVzLlxuICogQHBhcmFtIHtBcnJheX0gW2FyZ1Bvc10gVGhlIGFyZ3VtZW50IHBvc2l0aW9ucyBvZiB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQHBhcmFtIHtudW1iZXJ9IFthcnldIFRoZSBhcml0eSBjYXAgb2YgYGZ1bmNgLlxuICogQHBhcmFtIHtudW1iZXJ9IFthcml0eV0gVGhlIGFyaXR5IG9mIGBmdW5jYC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVdyYXBwZXIoZnVuYywgYml0bWFzaywgdGhpc0FyZywgcGFydGlhbHMsIGhvbGRlcnMsIGFyZ1BvcywgYXJ5LCBhcml0eSkge1xuICB2YXIgaXNCaW5kS2V5ID0gYml0bWFzayAmIEJJTkRfS0VZX0ZMQUc7XG4gIGlmICghaXNCaW5kS2V5ICYmIHR5cGVvZiBmdW5jICE9ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKEZVTkNfRVJST1JfVEVYVCk7XG4gIH1cbiAgdmFyIGxlbmd0aCA9IHBhcnRpYWxzID8gcGFydGlhbHMubGVuZ3RoIDogMDtcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBiaXRtYXNrICY9IH4oUEFSVElBTF9GTEFHIHwgUEFSVElBTF9SSUdIVF9GTEFHKTtcbiAgICBwYXJ0aWFscyA9IGhvbGRlcnMgPSB1bmRlZmluZWQ7XG4gIH1cbiAgYXJ5ID0gYXJ5ID09PSB1bmRlZmluZWQgPyBhcnkgOiBuYXRpdmVNYXgodG9JbnRlZ2VyKGFyeSksIDApO1xuICBhcml0eSA9IGFyaXR5ID09PSB1bmRlZmluZWQgPyBhcml0eSA6IHRvSW50ZWdlcihhcml0eSk7XG4gIGxlbmd0aCAtPSBob2xkZXJzID8gaG9sZGVycy5sZW5ndGggOiAwO1xuXG4gIGlmIChiaXRtYXNrICYgUEFSVElBTF9SSUdIVF9GTEFHKSB7XG4gICAgdmFyIHBhcnRpYWxzUmlnaHQgPSBwYXJ0aWFscyxcbiAgICAgICAgaG9sZGVyc1JpZ2h0ID0gaG9sZGVycztcblxuICAgIHBhcnRpYWxzID0gaG9sZGVycyA9IHVuZGVmaW5lZDtcbiAgfVxuICB2YXIgbmV3RGF0YSA9IFtmdW5jLCBiaXRtYXNrLCB0aGlzQXJnLCBwYXJ0aWFscywgaG9sZGVycywgcGFydGlhbHNSaWdodCwgaG9sZGVyc1JpZ2h0LCBhcmdQb3MsIGFyeSwgYXJpdHldO1xuXG4gIGZ1bmMgPSBuZXdEYXRhWzBdO1xuICBiaXRtYXNrID0gbmV3RGF0YVsxXTtcbiAgdGhpc0FyZyA9IG5ld0RhdGFbMl07XG4gIHBhcnRpYWxzID0gbmV3RGF0YVszXTtcbiAgaG9sZGVycyA9IG5ld0RhdGFbNF07XG4gIGFyaXR5ID0gbmV3RGF0YVs5XSA9IG5ld0RhdGFbOV0gPT0gbnVsbFxuICAgID8gKGlzQmluZEtleSA/IDAgOiBmdW5jLmxlbmd0aClcbiAgICA6IG5hdGl2ZU1heChuZXdEYXRhWzldIC0gbGVuZ3RoLCAwKTtcblxuICBpZiAoIWFyaXR5ICYmIGJpdG1hc2sgJiAoQ1VSUllfRkxBRyB8IENVUlJZX1JJR0hUX0ZMQUcpKSB7XG4gICAgYml0bWFzayAmPSB+KENVUlJZX0ZMQUcgfCBDVVJSWV9SSUdIVF9GTEFHKTtcbiAgfVxuICBpZiAoIWJpdG1hc2sgfHwgYml0bWFzayA9PSBCSU5EX0ZMQUcpIHtcbiAgICB2YXIgcmVzdWx0ID0gY3JlYXRlQmFzZVdyYXBwZXIoZnVuYywgYml0bWFzaywgdGhpc0FyZyk7XG4gIH0gZWxzZSBpZiAoYml0bWFzayA9PSBDVVJSWV9GTEFHIHx8IGJpdG1hc2sgPT0gQ1VSUllfUklHSFRfRkxBRykge1xuICAgIHJlc3VsdCA9IGNyZWF0ZUN1cnJ5V3JhcHBlcihmdW5jLCBiaXRtYXNrLCBhcml0eSk7XG4gIH0gZWxzZSBpZiAoKGJpdG1hc2sgPT0gUEFSVElBTF9GTEFHIHx8IGJpdG1hc2sgPT0gKEJJTkRfRkxBRyB8IFBBUlRJQUxfRkxBRykpICYmICFob2xkZXJzLmxlbmd0aCkge1xuICAgIHJlc3VsdCA9IGNyZWF0ZVBhcnRpYWxXcmFwcGVyKGZ1bmMsIGJpdG1hc2ssIHRoaXNBcmcsIHBhcnRpYWxzKTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSBjcmVhdGVIeWJyaWRXcmFwcGVyLmFwcGx5KHVuZGVmaW5lZCwgbmV3RGF0YSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBSZW9yZGVyIGBhcnJheWAgYWNjb3JkaW5nIHRvIHRoZSBzcGVjaWZpZWQgaW5kZXhlcyB3aGVyZSB0aGUgZWxlbWVudCBhdFxuICogdGhlIGZpcnN0IGluZGV4IGlzIGFzc2lnbmVkIGFzIHRoZSBmaXJzdCBlbGVtZW50LCB0aGUgZWxlbWVudCBhdFxuICogdGhlIHNlY29uZCBpbmRleCBpcyBhc3NpZ25lZCBhcyB0aGUgc2Vjb25kIGVsZW1lbnQsIGFuZCBzbyBvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHJlb3JkZXIuXG4gKiBAcGFyYW0ge0FycmF5fSBpbmRleGVzIFRoZSBhcnJhbmdlZCBhcnJheSBpbmRleGVzLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGBhcnJheWAuXG4gKi9cbmZ1bmN0aW9uIHJlb3JkZXIoYXJyYXksIGluZGV4ZXMpIHtcbiAgdmFyIGFyckxlbmd0aCA9IGFycmF5Lmxlbmd0aCxcbiAgICAgIGxlbmd0aCA9IG5hdGl2ZU1pbihpbmRleGVzLmxlbmd0aCwgYXJyTGVuZ3RoKSxcbiAgICAgIG9sZEFycmF5ID0gY29weUFycmF5KGFycmF5KTtcblxuICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICB2YXIgaW5kZXggPSBpbmRleGVzW2xlbmd0aF07XG4gICAgYXJyYXlbbGVuZ3RoXSA9IGlzSW5kZXgoaW5kZXgsIGFyckxlbmd0aCkgPyBvbGRBcnJheVtpbmRleF0gOiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIGFycmF5O1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBTYWZhcmkgOCB3aGljaCByZXR1cm5zICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMsIGFuZFxuICAvLyBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGFuIGludGVnZXIuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgbG9vc2VseSBiYXNlZCBvbiBbYFRvSW50ZWdlcmBdKGh0dHA6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2ludGVnZXIpLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGNvbnZlcnRlZCBpbnRlZ2VyLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLnRvSW50ZWdlcigzKTtcbiAqIC8vID0+IDNcbiAqXG4gKiBfLnRvSW50ZWdlcihOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IDBcbiAqXG4gKiBfLnRvSW50ZWdlcihJbmZpbml0eSk7XG4gKiAvLyA9PiAxLjc5NzY5MzEzNDg2MjMxNTdlKzMwOFxuICpcbiAqIF8udG9JbnRlZ2VyKCczJyk7XG4gKiAvLyA9PiAzXG4gKi9cbmZ1bmN0aW9uIHRvSW50ZWdlcih2YWx1ZSkge1xuICBpZiAoIXZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSAwID8gdmFsdWUgOiAwO1xuICB9XG4gIHZhbHVlID0gdG9OdW1iZXIodmFsdWUpO1xuICBpZiAodmFsdWUgPT09IElORklOSVRZIHx8IHZhbHVlID09PSAtSU5GSU5JVFkpIHtcbiAgICB2YXIgc2lnbiA9ICh2YWx1ZSA8IDAgPyAtMSA6IDEpO1xuICAgIHJldHVybiBzaWduICogTUFYX0lOVEVHRVI7XG4gIH1cbiAgdmFyIHJlbWFpbmRlciA9IHZhbHVlICUgMTtcbiAgcmV0dXJuIHZhbHVlID09PSB2YWx1ZSA/IChyZW1haW5kZXIgPyB2YWx1ZSAtIHJlbWFpbmRlciA6IHZhbHVlKSA6IDA7XG59XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIG51bWJlci5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHByb2Nlc3MuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8udG9OdW1iZXIoMyk7XG4gKiAvLyA9PiAzXG4gKlxuICogXy50b051bWJlcihOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IDVlLTMyNFxuICpcbiAqIF8udG9OdW1iZXIoSW5maW5pdHkpO1xuICogLy8gPT4gSW5maW5pdHlcbiAqXG4gKiBfLnRvTnVtYmVyKCczJyk7XG4gKiAvLyA9PiAzXG4gKi9cbmZ1bmN0aW9uIHRvTnVtYmVyKHZhbHVlKSB7XG4gIGlmIChpc09iamVjdCh2YWx1ZSkpIHtcbiAgICB2YXIgb3RoZXIgPSBpc0Z1bmN0aW9uKHZhbHVlLnZhbHVlT2YpID8gdmFsdWUudmFsdWVPZigpIDogdmFsdWU7XG4gICAgdmFsdWUgPSBpc09iamVjdChvdGhlcikgPyAob3RoZXIgKyAnJykgOiBvdGhlcjtcbiAgfVxuICBpZiAodHlwZW9mIHZhbHVlICE9ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSAwID8gdmFsdWUgOiArdmFsdWU7XG4gIH1cbiAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKHJlVHJpbSwgJycpO1xuICB2YXIgaXNCaW5hcnkgPSByZUlzQmluYXJ5LnRlc3QodmFsdWUpO1xuICByZXR1cm4gKGlzQmluYXJ5IHx8IHJlSXNPY3RhbC50ZXN0KHZhbHVlKSlcbiAgICA/IGZyZWVQYXJzZUludCh2YWx1ZS5zbGljZSgyKSwgaXNCaW5hcnkgPyAyIDogOClcbiAgICA6IChyZUlzQmFkSGV4LnRlc3QodmFsdWUpID8gTkFOIDogK3ZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVXcmFwcGVyO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy45LjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgaG9zdCBjb25zdHJ1Y3RvcnMgKFNhZmFyaSA+IDUpLiAqL1xudmFyIHJlSXNIb3N0Q3RvciA9IC9eXFxbb2JqZWN0IC4rP0NvbnN0cnVjdG9yXFxdJC87XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGRlY29tcGlsZWQgc291cmNlIG9mIGZ1bmN0aW9ucy4gKi9cbnZhciBmblRvU3RyaW5nID0gRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmpUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgaWYgYSBtZXRob2QgaXMgbmF0aXZlLiAqL1xudmFyIHJlSXNOYXRpdmUgPSBSZWdFeHAoJ14nICtcbiAgZm5Ub1N0cmluZy5jYWxsKGhhc093blByb3BlcnR5KS5yZXBsYWNlKC9bXFxcXF4kLiorPygpW1xcXXt9fF0vZywgJ1xcXFwkJicpXG4gIC5yZXBsYWNlKC9oYXNPd25Qcm9wZXJ0eXwoZnVuY3Rpb24pLio/KD89XFxcXFxcKCl8IGZvciAuKz8oPz1cXFxcXFxdKS9nLCAnJDEuKj8nKSArICckJ1xuKTtcblxuLyoqXG4gKiBHZXRzIHRoZSBuYXRpdmUgZnVuY3Rpb24gYXQgYGtleWAgb2YgYG9iamVjdGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgbWV0aG9kIHRvIGdldC5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBmdW5jdGlvbiBpZiBpdCdzIG5hdGl2ZSwgZWxzZSBgdW5kZWZpbmVkYC5cbiAqL1xuZnVuY3Rpb24gZ2V0TmF0aXZlKG9iamVjdCwga2V5KSB7XG4gIHZhciB2YWx1ZSA9IG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIHJldHVybiBpc05hdGl2ZSh2YWx1ZSkgPyB2YWx1ZSA6IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gb2xkZXIgdmVyc2lvbnMgb2YgQ2hyb21lIGFuZCBTYWZhcmkgd2hpY2ggcmV0dXJuICdmdW5jdGlvbicgZm9yIHJlZ2V4ZXNcbiAgLy8gYW5kIFNhZmFyaSA4IGVxdWl2YWxlbnRzIHdoaWNoIHJldHVybiAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzLlxuICByZXR1cm4gaXNPYmplY3QodmFsdWUpICYmIG9ialRvU3RyaW5nLmNhbGwodmFsdWUpID09IGZ1bmNUYWc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAvLyBBdm9pZCBhIFY4IEpJVCBidWcgaW4gQ2hyb21lIDE5LTIwLlxuICAvLyBTZWUgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTEgZm9yIG1vcmUgZGV0YWlscy5cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24uXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgbmF0aXZlIGZ1bmN0aW9uLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNOYXRpdmUoQXJyYXkucHJvdG90eXBlLnB1c2gpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNOYXRpdmUoXyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc05hdGl2ZSh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICByZXR1cm4gcmVJc05hdGl2ZS50ZXN0KGZuVG9TdHJpbmcuY2FsbCh2YWx1ZSkpO1xuICB9XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIHJlSXNIb3N0Q3Rvci50ZXN0KHZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXROYXRpdmU7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuMCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuNy4wIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogVXNlZCBhcyB0aGUgaW50ZXJuYWwgYXJndW1lbnQgcGxhY2Vob2xkZXIuICovXG52YXIgUExBQ0VIT0xERVIgPSAnX19sb2Rhc2hfcGxhY2Vob2xkZXJfXyc7XG5cbi8qKlxuICogUmVwbGFjZXMgYWxsIGBwbGFjZWhvbGRlcmAgZWxlbWVudHMgaW4gYGFycmF5YCB3aXRoIGFuIGludGVybmFsIHBsYWNlaG9sZGVyXG4gKiBhbmQgcmV0dXJucyBhbiBhcnJheSBvZiB0aGVpciBpbmRleGVzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gbW9kaWZ5LlxuICogQHBhcmFtIHsqfSBwbGFjZWhvbGRlciBUaGUgcGxhY2Vob2xkZXIgdG8gcmVwbGFjZS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgbmV3IGFycmF5IG9mIHBsYWNlaG9sZGVyIGluZGV4ZXMuXG4gKi9cbmZ1bmN0aW9uIHJlcGxhY2VIb2xkZXJzKGFycmF5LCBwbGFjZWhvbGRlcikge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCxcbiAgICAgIHJlc0luZGV4ID0gLTEsXG4gICAgICByZXN1bHQgPSBbXTtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIGlmIChhcnJheVtpbmRleF0gPT09IHBsYWNlaG9sZGVyKSB7XG4gICAgICBhcnJheVtpbmRleF0gPSBQTEFDRUhPTERFUjtcbiAgICAgIHJlc3VsdFsrK3Jlc0luZGV4XSA9IGluZGV4O1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcGxhY2VIb2xkZXJzO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogVXNlZCB0byBkZXRlcm1pbmUgaWYgdmFsdWVzIGFyZSBvZiB0aGUgbGFuZ3VhZ2UgdHlwZSBgT2JqZWN0YC4gKi9cbnZhciBvYmplY3RUeXBlcyA9IHtcbiAgJ2Z1bmN0aW9uJzogdHJ1ZSxcbiAgJ29iamVjdCc6IHRydWVcbn07XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZXhwb3J0c2AuICovXG52YXIgZnJlZUV4cG9ydHMgPSAob2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUpXG4gID8gZXhwb3J0c1xuICA6IHVuZGVmaW5lZDtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgLiAqL1xudmFyIGZyZWVNb2R1bGUgPSAob2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUpXG4gID8gbW9kdWxlXG4gIDogdW5kZWZpbmVkO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAgZnJvbSBOb2RlLmpzLiAqL1xudmFyIGZyZWVHbG9iYWwgPSBjaGVja0dsb2JhbChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlICYmIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsKTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBzZWxmYC4gKi9cbnZhciBmcmVlU2VsZiA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiBzZWxmXSAmJiBzZWxmKTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGB3aW5kb3dgLiAqL1xudmFyIGZyZWVXaW5kb3cgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygd2luZG93XSAmJiB3aW5kb3cpO1xuXG4vKiogRGV0ZWN0IGB0aGlzYCBhcyB0aGUgZ2xvYmFsIG9iamVjdC4gKi9cbnZhciB0aGlzR2xvYmFsID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHRoaXNdICYmIHRoaXMpO1xuXG4vKipcbiAqIFVzZWQgYXMgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QuXG4gKlxuICogVGhlIGB0aGlzYCB2YWx1ZSBpcyB1c2VkIGlmIGl0J3MgdGhlIGdsb2JhbCBvYmplY3QgdG8gYXZvaWQgR3JlYXNlbW9ua2V5J3NcbiAqIHJlc3RyaWN0ZWQgYHdpbmRvd2Agb2JqZWN0LCBvdGhlcndpc2UgdGhlIGB3aW5kb3dgIG9iamVjdCBpcyB1c2VkLlxuICovXG52YXIgcm9vdCA9IGZyZWVHbG9iYWwgfHxcbiAgKChmcmVlV2luZG93ICE9PSAodGhpc0dsb2JhbCAmJiB0aGlzR2xvYmFsLndpbmRvdykpICYmIGZyZWVXaW5kb3cpIHx8XG4gICAgZnJlZVNlbGYgfHwgdGhpc0dsb2JhbCB8fCBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgZ2xvYmFsIG9iamVjdC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7bnVsbHxPYmplY3R9IFJldHVybnMgYHZhbHVlYCBpZiBpdCdzIGEgZ2xvYmFsIG9iamVjdCwgZWxzZSBgbnVsbGAuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrR2xvYmFsKHZhbHVlKSB7XG4gIHJldHVybiAodmFsdWUgJiYgdmFsdWUuT2JqZWN0ID09PSBPYmplY3QpID8gdmFsdWUgOiBudWxsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJvb3Q7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuMyAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xudmFyIGFycmF5RWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5fYXJyYXllYWNoJyksXG4gICAgYmFzZUVhY2ggPSByZXF1aXJlKCdsb2Rhc2guX2Jhc2VlYWNoJyksXG4gICAgYmluZENhbGxiYWNrID0gcmVxdWlyZSgnbG9kYXNoLl9iaW5kY2FsbGJhY2snKSxcbiAgICBpc0FycmF5ID0gcmVxdWlyZSgnbG9kYXNoLmlzYXJyYXknKTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gZm9yIGBfLmZvckVhY2hgIG9yIGBfLmZvckVhY2hSaWdodGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGFycmF5RnVuYyBUaGUgZnVuY3Rpb24gdG8gaXRlcmF0ZSBvdmVyIGFuIGFycmF5LlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZWFjaEZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGl0ZXJhdGUgb3ZlciBhIGNvbGxlY3Rpb24uXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBlYWNoIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVGb3JFYWNoKGFycmF5RnVuYywgZWFjaEZ1bmMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGNvbGxlY3Rpb24sIGl0ZXJhdGVlLCB0aGlzQXJnKSB7XG4gICAgcmV0dXJuICh0eXBlb2YgaXRlcmF0ZWUgPT0gJ2Z1bmN0aW9uJyAmJiB0aGlzQXJnID09PSB1bmRlZmluZWQgJiYgaXNBcnJheShjb2xsZWN0aW9uKSlcbiAgICAgID8gYXJyYXlGdW5jKGNvbGxlY3Rpb24sIGl0ZXJhdGVlKVxuICAgICAgOiBlYWNoRnVuYyhjb2xsZWN0aW9uLCBiaW5kQ2FsbGJhY2soaXRlcmF0ZWUsIHRoaXNBcmcsIDMpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBJdGVyYXRlcyBvdmVyIGVsZW1lbnRzIG9mIGBjb2xsZWN0aW9uYCBpbnZva2luZyBgaXRlcmF0ZWVgIGZvciBlYWNoIGVsZW1lbnQuXG4gKiBUaGUgYGl0ZXJhdGVlYCBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM6XG4gKiAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuIEl0ZXJhdGVlIGZ1bmN0aW9ucyBtYXkgZXhpdCBpdGVyYXRpb24gZWFybHlcbiAqIGJ5IGV4cGxpY2l0bHkgcmV0dXJuaW5nIGBmYWxzZWAuXG4gKlxuICogKipOb3RlOioqIEFzIHdpdGggb3RoZXIgXCJDb2xsZWN0aW9uc1wiIG1ldGhvZHMsIG9iamVjdHMgd2l0aCBhIFwibGVuZ3RoXCIgcHJvcGVydHlcbiAqIGFyZSBpdGVyYXRlZCBsaWtlIGFycmF5cy4gVG8gYXZvaWQgdGhpcyBiZWhhdmlvciBgXy5mb3JJbmAgb3IgYF8uZm9yT3duYFxuICogbWF5IGJlIHVzZWQgZm9yIG9iamVjdCBpdGVyYXRpb24uXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBhbGlhcyBlYWNoXG4gKiBAY2F0ZWdvcnkgQ29sbGVjdGlvblxuICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtpdGVyYXRlZT1fLmlkZW50aXR5XSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBpdGVyYXRlZWAuXG4gKiBAcmV0dXJucyB7QXJyYXl8T2JqZWN0fHN0cmluZ30gUmV0dXJucyBgY29sbGVjdGlvbmAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8oWzEsIDJdKS5mb3JFYWNoKGZ1bmN0aW9uKG4pIHtcbiAqICAgY29uc29sZS5sb2cobik7XG4gKiB9KS52YWx1ZSgpO1xuICogLy8gPT4gbG9ncyBlYWNoIHZhbHVlIGZyb20gbGVmdCB0byByaWdodCBhbmQgcmV0dXJucyB0aGUgYXJyYXlcbiAqXG4gKiBfLmZvckVhY2goeyAnYSc6IDEsICdiJzogMiB9LCBmdW5jdGlvbihuLCBrZXkpIHtcbiAqICAgY29uc29sZS5sb2cobiwga2V5KTtcbiAqIH0pO1xuICogLy8gPT4gbG9ncyBlYWNoIHZhbHVlLWtleSBwYWlyIGFuZCByZXR1cm5zIHRoZSBvYmplY3QgKGl0ZXJhdGlvbiBvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAqL1xudmFyIGZvckVhY2ggPSBjcmVhdGVGb3JFYWNoKGFycmF5RWFjaCwgYmFzZUVhY2gpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZvckVhY2g7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuOCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIGFzIHJlZmVyZW5jZXMgZm9yIHZhcmlvdXMgYE51bWJlcmAgY29uc3RhbnRzLiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgYXJnc1RhZyA9ICdbb2JqZWN0IEFyZ3VtZW50c10nLFxuICAgIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgIGdlblRhZyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIHByb3BlcnR5SXNFbnVtZXJhYmxlID0gb2JqZWN0UHJvdG8ucHJvcGVydHlJc0VudW1lcmFibGU7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ucHJvcGVydHlgIHdpdGhvdXQgc3VwcG9ydCBmb3IgZGVlcCBwYXRocy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSB0byBnZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gYmFzZVByb3BlcnR5KGtleSkge1xuICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIH07XG59XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgbGlrZWx5IGFuIGBhcmd1bWVudHNgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FyZ3VtZW50cyhmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJndW1lbnRzKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FyZ3VtZW50cyh2YWx1ZSkge1xuICAvLyBTYWZhcmkgOC4xIGluY29ycmVjdGx5IG1ha2VzIGBhcmd1bWVudHMuY2FsbGVlYCBlbnVtZXJhYmxlIGluIHN0cmljdCBtb2RlLlxuICByZXR1cm4gaXNBcnJheUxpa2VPYmplY3QodmFsdWUpICYmIGhhc093blByb3BlcnR5LmNhbGwodmFsdWUsICdjYWxsZWUnKSAmJlxuICAgICghcHJvcGVydHlJc0VudW1lcmFibGUuY2FsbCh2YWx1ZSwgJ2NhbGxlZScpIHx8IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpID09IGFyZ3NUYWcpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UuIEEgdmFsdWUgaXMgY29uc2lkZXJlZCBhcnJheS1saWtlIGlmIGl0J3NcbiAqIG5vdCBhIGZ1bmN0aW9uIGFuZCBoYXMgYSBgdmFsdWUubGVuZ3RoYCB0aGF0J3MgYW4gaW50ZWdlciBncmVhdGVyIHRoYW4gb3JcbiAqIGVxdWFsIHRvIGAwYCBhbmQgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUmAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5TGlrZShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoZG9jdW1lbnQuYm9keS5jaGlsZHJlbik7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZSgnYWJjJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheUxpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgaXNMZW5ndGgoZ2V0TGVuZ3RoKHZhbHVlKSkgJiYgIWlzRnVuY3Rpb24odmFsdWUpO1xufVxuXG4vKipcbiAqIFRoaXMgbWV0aG9kIGlzIGxpa2UgYF8uaXNBcnJheUxpa2VgIGV4Y2VwdCB0aGF0IGl0IGFsc28gY2hlY2tzIGlmIGB2YWx1ZWBcbiAqIGlzIGFuIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gYXJyYXktbGlrZSBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5TGlrZU9iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoZG9jdW1lbnQuYm9keS5jaGlsZHJlbik7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZU9iamVjdCgnYWJjJyk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlT2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIGlzQXJyYXlMaWtlKHZhbHVlKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gU2FmYXJpIDggd2hpY2ggcmV0dXJucyAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgYW5kIHdlYWsgbWFwIGNvbnN0cnVjdG9ycyxcbiAgLy8gYW5kIFBoYW50b21KUyAxLjkgd2hpY2ggcmV0dXJucyAnZnVuY3Rpb24nIGZvciBgTm9kZUxpc3RgIGluc3RhbmNlcy5cbiAgdmFyIHRhZyA9IGlzT2JqZWN0KHZhbHVlKSA/IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpIDogJyc7XG4gIHJldHVybiB0YWcgPT0gZnVuY1RhZyB8fCB0YWcgPT0gZ2VuVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgbG9vc2VseSBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtdG9sZW5ndGgpLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTGVuZ3RoKDMpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNMZW5ndGgoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNMZW5ndGgoSW5maW5pdHkpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKCczJyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmXG4gICAgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLiBBIHZhbHVlIGlzIG9iamVjdC1saWtlIGlmIGl0J3Mgbm90IGBudWxsYFxuICogYW5kIGhhcyBhIGB0eXBlb2ZgIHJlc3VsdCBvZiBcIm9iamVjdFwiLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZSh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcmd1bWVudHM7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuNCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgYXJyYXlUYWcgPSAnW29iamVjdCBBcnJheV0nLFxuICAgIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgaG9zdCBjb25zdHJ1Y3RvcnMgKFNhZmFyaSA+IDUpLiAqL1xudmFyIHJlSXNIb3N0Q3RvciA9IC9eXFxbb2JqZWN0IC4rP0NvbnN0cnVjdG9yXFxdJC87XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxuLyoqIFVzZWQgZm9yIG5hdGl2ZSBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGRlY29tcGlsZWQgc291cmNlIG9mIGZ1bmN0aW9ucy4gKi9cbnZhciBmblRvU3RyaW5nID0gRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmpUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgaWYgYSBtZXRob2QgaXMgbmF0aXZlLiAqL1xudmFyIHJlSXNOYXRpdmUgPSBSZWdFeHAoJ14nICtcbiAgZm5Ub1N0cmluZy5jYWxsKGhhc093blByb3BlcnR5KS5yZXBsYWNlKC9bXFxcXF4kLiorPygpW1xcXXt9fF0vZywgJ1xcXFwkJicpXG4gIC5yZXBsYWNlKC9oYXNPd25Qcm9wZXJ0eXwoZnVuY3Rpb24pLio/KD89XFxcXFxcKCl8IGZvciAuKz8oPz1cXFxcXFxdKS9nLCAnJDEuKj8nKSArICckJ1xuKTtcblxuLyogTmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVJc0FycmF5ID0gZ2V0TmF0aXZlKEFycmF5LCAnaXNBcnJheScpO1xuXG4vKipcbiAqIFVzZWQgYXMgdGhlIFttYXhpbXVtIGxlbmd0aF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtbnVtYmVyLm1heF9zYWZlX2ludGVnZXIpXG4gKiBvZiBhbiBhcnJheS1saWtlIHZhbHVlLlxuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKlxuICogR2V0cyB0aGUgbmF0aXZlIGZ1bmN0aW9uIGF0IGBrZXlgIG9mIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIG1ldGhvZCB0byBnZXQuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgZnVuY3Rpb24gaWYgaXQncyBuYXRpdmUsIGVsc2UgYHVuZGVmaW5lZGAuXG4gKi9cbmZ1bmN0aW9uIGdldE5hdGl2ZShvYmplY3QsIGtleSkge1xuICB2YXIgdmFsdWUgPSBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICByZXR1cm4gaXNOYXRpdmUodmFsdWUpID8gdmFsdWUgOiB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGxlbmd0aC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtdG9sZW5ndGgpLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgbGVuZ3RoLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzTGVuZ3RoKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgJiYgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYW4gYEFycmF5YCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheShmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbnZhciBpc0FycmF5ID0gbmF0aXZlSXNBcnJheSB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBpc0xlbmd0aCh2YWx1ZS5sZW5ndGgpICYmIG9ialRvU3RyaW5nLmNhbGwodmFsdWUpID09IGFycmF5VGFnO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gb2xkZXIgdmVyc2lvbnMgb2YgQ2hyb21lIGFuZCBTYWZhcmkgd2hpY2ggcmV0dXJuICdmdW5jdGlvbicgZm9yIHJlZ2V4ZXNcbiAgLy8gYW5kIFNhZmFyaSA4IGVxdWl2YWxlbnRzIHdoaWNoIHJldHVybiAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzLlxuICByZXR1cm4gaXNPYmplY3QodmFsdWUpICYmIG9ialRvU3RyaW5nLmNhbGwodmFsdWUpID09IGZ1bmNUYWc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICAvLyBBdm9pZCBhIFY4IEpJVCBidWcgaW4gQ2hyb21lIDE5LTIwLlxuICAvLyBTZWUgaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTEgZm9yIG1vcmUgZGV0YWlscy5cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24uXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgbmF0aXZlIGZ1bmN0aW9uLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNOYXRpdmUoQXJyYXkucHJvdG90eXBlLnB1c2gpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNOYXRpdmUoXyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc05hdGl2ZSh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICByZXR1cm4gcmVJc05hdGl2ZS50ZXN0KGZuVG9TdHJpbmcuY2FsbCh2YWx1ZSkpO1xuICB9XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIHJlSXNIb3N0Q3Rvci50ZXN0KHZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5O1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4xLjIgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE1IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTUgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciBnZXROYXRpdmUgPSByZXF1aXJlKCdsb2Rhc2guX2dldG5hdGl2ZScpLFxuICAgIGlzQXJndW1lbnRzID0gcmVxdWlyZSgnbG9kYXNoLmlzYXJndW1lbnRzJyksXG4gICAgaXNBcnJheSA9IHJlcXVpcmUoJ2xvZGFzaC5pc2FycmF5Jyk7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eXFxkKyQvO1xuXG4vKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyogTmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVLZXlzID0gZ2V0TmF0aXZlKE9iamVjdCwgJ2tleXMnKTtcblxuLyoqXG4gKiBVc2VkIGFzIHRoZSBbbWF4aW11bSBsZW5ndGhdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW51bWJlci5tYXhfc2FmZV9pbnRlZ2VyKVxuICogb2YgYW4gYXJyYXktbGlrZSB2YWx1ZS5cbiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgdmFsdWUgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBhdm9pZCBhIFtKSVQgYnVnXShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTQyNzkyKVxuICogdGhhdCBhZmZlY3RzIFNhZmFyaSBvbiBhdCBsZWFzdCBpT1MgOC4xLTguMyBBUk02NC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIFwibGVuZ3RoXCIgdmFsdWUuXG4gKi9cbnZhciBnZXRMZW5ndGggPSBiYXNlUHJvcGVydHkoJ2xlbmd0aCcpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiBpc0xlbmd0aChnZXRMZW5ndGgodmFsdWUpKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgaW5kZXguXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHBhcmFtIHtudW1iZXJ9IFtsZW5ndGg9TUFYX1NBRkVfSU5URUdFUl0gVGhlIHVwcGVyIGJvdW5kcyBvZiBhIHZhbGlkIGluZGV4LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBpbmRleCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0luZGV4KHZhbHVlLCBsZW5ndGgpIHtcbiAgdmFsdWUgPSAodHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8IHJlSXNVaW50LnRlc3QodmFsdWUpKSA/ICt2YWx1ZSA6IC0xO1xuICBsZW5ndGggPSBsZW5ndGggPT0gbnVsbCA/IE1BWF9TQUZFX0lOVEVHRVIgOiBsZW5ndGg7XG4gIHJldHVybiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDwgbGVuZ3RoO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBBIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIG9mIGBPYmplY3Qua2V5c2Agd2hpY2ggY3JlYXRlcyBhbiBhcnJheSBvZiB0aGVcbiAqIG93biBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICovXG5mdW5jdGlvbiBzaGltS2V5cyhvYmplY3QpIHtcbiAgdmFyIHByb3BzID0ga2V5c0luKG9iamVjdCksXG4gICAgICBwcm9wc0xlbmd0aCA9IHByb3BzLmxlbmd0aCxcbiAgICAgIGxlbmd0aCA9IHByb3BzTGVuZ3RoICYmIG9iamVjdC5sZW5ndGg7XG5cbiAgdmFyIGFsbG93SW5kZXhlcyA9ICEhbGVuZ3RoICYmIGlzTGVuZ3RoKGxlbmd0aCkgJiZcbiAgICAoaXNBcnJheShvYmplY3QpIHx8IGlzQXJndW1lbnRzKG9iamVjdCkpO1xuXG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgcmVzdWx0ID0gW107XG5cbiAgd2hpbGUgKCsraW5kZXggPCBwcm9wc0xlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgaWYgKChhbGxvd0luZGV4ZXMgJiYgaXNJbmRleChrZXksIGxlbmd0aCkpIHx8IGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSB7XG4gICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KDEpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgLy8gQXZvaWQgYSBWOCBKSVQgYnVnIGluIENocm9tZSAxOS0yMC5cbiAgLy8gU2VlIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0yMjkxIGZvciBtb3JlIGRldGFpbHMuXG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgdGhlIG93biBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBOb24tb2JqZWN0IHZhbHVlcyBhcmUgY29lcmNlZCB0byBvYmplY3RzLiBTZWUgdGhlXG4gKiBbRVMgc3BlY10oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LmtleXMpXG4gKiBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgT2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICogQGV4YW1wbGVcbiAqXG4gKiBmdW5jdGlvbiBGb28oKSB7XG4gKiAgIHRoaXMuYSA9IDE7XG4gKiAgIHRoaXMuYiA9IDI7XG4gKiB9XG4gKlxuICogRm9vLnByb3RvdHlwZS5jID0gMztcbiAqXG4gKiBfLmtleXMobmV3IEZvbyk7XG4gKiAvLyA9PiBbJ2EnLCAnYiddIChpdGVyYXRpb24gb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gKlxuICogXy5rZXlzKCdoaScpO1xuICogLy8gPT4gWycwJywgJzEnXVxuICovXG52YXIga2V5cyA9ICFuYXRpdmVLZXlzID8gc2hpbUtleXMgOiBmdW5jdGlvbihvYmplY3QpIHtcbiAgdmFyIEN0b3IgPSBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdC5jb25zdHJ1Y3RvcjtcbiAgaWYgKCh0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IucHJvdG90eXBlID09PSBvYmplY3QpIHx8XG4gICAgICAodHlwZW9mIG9iamVjdCAhPSAnZnVuY3Rpb24nICYmIGlzQXJyYXlMaWtlKG9iamVjdCkpKSB7XG4gICAgcmV0dXJuIHNoaW1LZXlzKG9iamVjdCk7XG4gIH1cbiAgcmV0dXJuIGlzT2JqZWN0KG9iamVjdCkgPyBuYXRpdmVLZXlzKG9iamVjdCkgOiBbXTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiB0aGUgb3duIGFuZCBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogTm9uLW9iamVjdCB2YWx1ZXMgYXJlIGNvZXJjZWQgdG8gb2JqZWN0cy5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKlxuICogXy5rZXlzSW4obmV3IEZvbyk7XG4gKiAvLyA9PiBbJ2EnLCAnYicsICdjJ10gKGl0ZXJhdGlvbiBvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAqL1xuZnVuY3Rpb24ga2V5c0luKG9iamVjdCkge1xuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICByZXR1cm4gW107XG4gIH1cbiAgaWYgKCFpc09iamVjdChvYmplY3QpKSB7XG4gICAgb2JqZWN0ID0gT2JqZWN0KG9iamVjdCk7XG4gIH1cbiAgdmFyIGxlbmd0aCA9IG9iamVjdC5sZW5ndGg7XG4gIGxlbmd0aCA9IChsZW5ndGggJiYgaXNMZW5ndGgobGVuZ3RoKSAmJlxuICAgIChpc0FycmF5KG9iamVjdCkgfHwgaXNBcmd1bWVudHMob2JqZWN0KSkgJiYgbGVuZ3RoKSB8fCAwO1xuXG4gIHZhciBDdG9yID0gb2JqZWN0LmNvbnN0cnVjdG9yLFxuICAgICAgaW5kZXggPSAtMSxcbiAgICAgIGlzUHJvdG8gPSB0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IucHJvdG90eXBlID09PSBvYmplY3QsXG4gICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpLFxuICAgICAgc2tpcEluZGV4ZXMgPSBsZW5ndGggPiAwO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgcmVzdWx0W2luZGV4XSA9IChpbmRleCArICcnKTtcbiAgfVxuICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgaWYgKCEoc2tpcEluZGV4ZXMgJiYgaXNJbmRleChrZXksIGxlbmd0aCkpICYmXG4gICAgICAgICEoa2V5ID09ICdjb25zdHJ1Y3RvcicgJiYgKGlzUHJvdG8gfHwgIWhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ga2V5cztcbiIsIi8qKlxuICogbG9kYXNoIDMuMS4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kZXJuIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNSBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE1IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgY3JlYXRlV3JhcHBlciA9IHJlcXVpcmUoJ2xvZGFzaC5fY3JlYXRld3JhcHBlcicpLFxuICAgIHJlcGxhY2VIb2xkZXJzID0gcmVxdWlyZSgnbG9kYXNoLl9yZXBsYWNlaG9sZGVycycpLFxuICAgIHJlc3RQYXJhbSA9IHJlcXVpcmUoJ2xvZGFzaC5yZXN0cGFyYW0nKTtcblxuLyoqIFVzZWQgdG8gY29tcG9zZSBiaXRtYXNrcyBmb3Igd3JhcHBlciBtZXRhZGF0YS4gKi9cbnZhciBQQVJUSUFMX0ZMQUcgPSAzMjtcblxuLyoqXG4gKiBDcmVhdGVzIGEgYF8ucGFydGlhbGAgb3IgYF8ucGFydGlhbFJpZ2h0YCBmdW5jdGlvbi5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtib29sZWFufSBmbGFnIFRoZSBwYXJ0aWFsIGJpdCBmbGFnLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbCBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlUGFydGlhbChmbGFnKSB7XG4gIHZhciBwYXJ0aWFsRnVuYyA9IHJlc3RQYXJhbShmdW5jdGlvbihmdW5jLCBwYXJ0aWFscykge1xuICAgIHZhciBob2xkZXJzID0gcmVwbGFjZUhvbGRlcnMocGFydGlhbHMsIHBhcnRpYWxGdW5jLnBsYWNlaG9sZGVyKTtcbiAgICByZXR1cm4gY3JlYXRlV3JhcHBlcihmdW5jLCBmbGFnLCB1bmRlZmluZWQsIHBhcnRpYWxzLCBob2xkZXJzKTtcbiAgfSk7XG4gIHJldHVybiBwYXJ0aWFsRnVuYztcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGBmdW5jYCB3aXRoIGBwYXJ0aWFsYCBhcmd1bWVudHMgcHJlcGVuZGVkXG4gKiB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmJpbmRgIGV4Y2VwdFxuICogaXQgZG9lcyAqKm5vdCoqIGFsdGVyIHRoZSBgdGhpc2AgYmluZGluZy5cbiAqXG4gKiBUaGUgYF8ucGFydGlhbC5wbGFjZWhvbGRlcmAgdmFsdWUsIHdoaWNoIGRlZmF1bHRzIHRvIGBfYCBpbiBtb25vbGl0aGljXG4gKiBidWlsZHMsIG1heSBiZSB1c2VkIGFzIGEgcGxhY2Vob2xkZXIgZm9yIHBhcnRpYWxseSBhcHBsaWVkIGFyZ3VtZW50cy5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBtZXRob2QgZG9lcyBub3Qgc2V0IHRoZSBcImxlbmd0aFwiIHByb3BlcnR5IG9mIHBhcnRpYWxseVxuICogYXBwbGllZCBmdW5jdGlvbnMuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gcGFydGlhbGx5IGFwcGx5IGFyZ3VtZW50cyB0by5cbiAqIEBwYXJhbSB7Li4uKn0gW3BhcnRpYWxzXSBUaGUgYXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbGx5IGFwcGxpZWQgZnVuY3Rpb24uXG4gKiBAZXhhbXBsZVxuICpcbiAqIHZhciBncmVldCA9IGZ1bmN0aW9uKGdyZWV0aW5nLCBuYW1lKSB7XG4gKiAgIHJldHVybiBncmVldGluZyArICcgJyArIG5hbWU7XG4gKiB9O1xuICpcbiAqIHZhciBzYXlIZWxsb1RvID0gXy5wYXJ0aWFsKGdyZWV0LCAnaGVsbG8nKTtcbiAqIHNheUhlbGxvVG8oJ2ZyZWQnKTtcbiAqIC8vID0+ICdoZWxsbyBmcmVkJ1xuICpcbiAqIC8vIHVzaW5nIHBsYWNlaG9sZGVyc1xuICogdmFyIGdyZWV0RnJlZCA9IF8ucGFydGlhbChncmVldCwgXywgJ2ZyZWQnKTtcbiAqIGdyZWV0RnJlZCgnaGknKTtcbiAqIC8vID0+ICdoaSBmcmVkJ1xuICovXG52YXIgcGFydGlhbCA9IGNyZWF0ZVBhcnRpYWwoUEFSVElBTF9GTEFHKTtcblxuLy8gQXNzaWduIGRlZmF1bHQgcGxhY2Vob2xkZXJzLlxucGFydGlhbC5wbGFjZWhvbGRlciA9IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnRpYWw7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjYuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZGVybiBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTUgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNSBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogVXNlZCBhcyB0aGUgYFR5cGVFcnJvcmAgbWVzc2FnZSBmb3IgXCJGdW5jdGlvbnNcIiBtZXRob2RzLiAqL1xudmFyIEZVTkNfRVJST1JfVEVYVCA9ICdFeHBlY3RlZCBhIGZ1bmN0aW9uJztcblxuLyogTmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVNYXggPSBNYXRoLm1heDtcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGBmdW5jYCB3aXRoIHRoZSBgdGhpc2AgYmluZGluZyBvZiB0aGVcbiAqIGNyZWF0ZWQgZnVuY3Rpb24gYW5kIGFyZ3VtZW50cyBmcm9tIGBzdGFydGAgYW5kIGJleW9uZCBwcm92aWRlZCBhcyBhbiBhcnJheS5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBtZXRob2QgaXMgYmFzZWQgb24gdGhlIFtyZXN0IHBhcmFtZXRlcl0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvRnVuY3Rpb25zL3Jlc3RfcGFyYW1ldGVycykuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYXBwbHkgYSByZXN0IHBhcmFtZXRlciB0by5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnQ9ZnVuYy5sZW5ndGgtMV0gVGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoZSByZXN0IHBhcmFtZXRlci5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgc2F5ID0gXy5yZXN0UGFyYW0oZnVuY3Rpb24od2hhdCwgbmFtZXMpIHtcbiAqICAgcmV0dXJuIHdoYXQgKyAnICcgKyBfLmluaXRpYWwobmFtZXMpLmpvaW4oJywgJykgK1xuICogICAgIChfLnNpemUobmFtZXMpID4gMSA/ICcsICYgJyA6ICcnKSArIF8ubGFzdChuYW1lcyk7XG4gKiB9KTtcbiAqXG4gKiBzYXkoJ2hlbGxvJywgJ2ZyZWQnLCAnYmFybmV5JywgJ3BlYmJsZXMnKTtcbiAqIC8vID0+ICdoZWxsbyBmcmVkLCBiYXJuZXksICYgcGViYmxlcydcbiAqL1xuZnVuY3Rpb24gcmVzdFBhcmFtKGZ1bmMsIHN0YXJ0KSB7XG4gIGlmICh0eXBlb2YgZnVuYyAhPSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihGVU5DX0VSUk9SX1RFWFQpO1xuICB9XG4gIHN0YXJ0ID0gbmF0aXZlTWF4KHN0YXJ0ID09PSB1bmRlZmluZWQgPyAoZnVuYy5sZW5ndGggLSAxKSA6ICgrc3RhcnQgfHwgMCksIDApO1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIGluZGV4ID0gLTEsXG4gICAgICAgIGxlbmd0aCA9IG5hdGl2ZU1heChhcmdzLmxlbmd0aCAtIHN0YXJ0LCAwKSxcbiAgICAgICAgcmVzdCA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgcmVzdFtpbmRleF0gPSBhcmdzW3N0YXJ0ICsgaW5kZXhdO1xuICAgIH1cbiAgICBzd2l0Y2ggKHN0YXJ0KSB7XG4gICAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpcywgcmVzdCk7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgcmVzdCk7XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgYXJnc1sxXSwgcmVzdCk7XG4gICAgfVxuICAgIHZhciBvdGhlckFyZ3MgPSBBcnJheShzdGFydCArIDEpO1xuICAgIGluZGV4ID0gLTE7XG4gICAgd2hpbGUgKCsraW5kZXggPCBzdGFydCkge1xuICAgICAgb3RoZXJBcmdzW2luZGV4XSA9IGFyZ3NbaW5kZXhdO1xuICAgIH1cbiAgICBvdGhlckFyZ3Nbc3RhcnRdID0gcmVzdDtcbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBvdGhlckFyZ3MpO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlc3RQYXJhbTtcbiIsIi8vIFB1YmxpYyBBUEkvbm9kZS1tb2R1bGUgZm9yIHRoZSBQdXNoXG5cbmNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgQnV0dG9ucyA9IHJlcXVpcmUoJy4vc3JjL2J1dHRvbnMuanMnKSxcbiAgICBLbm9icyA9IHJlcXVpcmUoJy4vc3JjL2tub2JzJyksXG4gICAgR3JpZCA9IHJlcXVpcmUoJy4vc3JjL2dyaWQuanMnKSxcbiAgICBUb3VjaHN0cmlwID0gcmVxdWlyZSgnLi9zcmMvdG91Y2hzdHJpcC5qcycpLFxuICAgIENvbnRyb2xCdXR0b25zID0gcmVxdWlyZSgnLi9zcmMvY29udHJvbC1idXR0b25zLmpzJyksXG4gICAgTENEcyA9IHJlcXVpcmUoJy4vc3JjL2xjZHMuanMnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKSxcbiAgICBwYXJ0aWFsID0gcmVxdWlyZSgnbG9kYXNoLnBhcnRpYWwnKSxcbiAgICBvbmVfdG9fZWlnaHQgPSBbMSwgMiwgMywgNCwgNSwgNiwgNywgOF07XG5cbmZ1bmN0aW9uIFB1c2gobWlkaV9vdXRfcG9ydCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gICAgdmFyIG1pZGlfb3V0ID0ge1xuICAgICAgICBzZW5kX2NjOiBmdW5jdGlvbihjYywgdmFsdWUpIHsgbWlkaV9vdXRfcG9ydC5zZW5kKFsxNzYsIGNjLCB2YWx1ZV0pIH0sXG4gICAgICAgIHNlbmRfbm90ZTogZnVuY3Rpb24obm90ZSwgdmVsb2NpdHkpIHsgbWlkaV9vdXRfcG9ydC5zZW5kKFsxNDQsIG5vdGUsIHZlbG9jaXR5XSkgfSxcbiAgICAgICAgc2VuZF9zeXNleDogZnVuY3Rpb24oZGF0YSkgeyBtaWRpX291dF9wb3J0LnNlbmQoWzI0MCwgNzEsIDEyNywgMjFdLmNvbmNhdChkYXRhKS5jb25jYXQoWzI0N10pKSB9XG4gICAgfVxuXG4gICAgY29uc3QgYnV0dG9ucyA9IG5ldyBCdXR0b25zKG1pZGlfb3V0LnNlbmRfY2MpO1xuICAgIHRoaXMua25vYnMgPSBuZXcgS25vYnMoKTtcbiAgICB0aGlzLmdyaWQgPSBuZXcgR3JpZChtaWRpX291dC5zZW5kX25vdGUsIG1pZGlfb3V0LnNlbmRfY2MsIG1pZGlfb3V0LnNlbmRfc3lzZXgpO1xuICAgIHRoaXMudG91Y2hzdHJpcCA9IG5ldyBUb3VjaHN0cmlwKCk7XG4gICAgdGhpcy5jb250cm9sID0gbmV3IENvbnRyb2xCdXR0b25zKG1pZGlfb3V0LnNlbmRfY2MpO1xuICAgIHRoaXMuY2NNYXAgPSBbXTtcbiAgICB0aGlzLm5vdGVNYXAgPSBbXTtcblxuICAgIGZvcmVhY2goXG4gICAgICAgIFt0aGlzLmtub2JzLCB0aGlzLnRvdWNoc3RyaXAsIHRoaXMuZ3JpZF0sXG4gICAgICAgIChtb2R1bGUpID0+IGZvcmVhY2gobW9kdWxlLmhhbmRsZWRfbm90ZXMsICh2YWx1ZSwga2V5KSA9PiB0aGlzLm5vdGVNYXBbdmFsdWVdID0gbW9kdWxlKVxuICAgICk7XG5cbiAgICBmb3JlYWNoKFxuICAgICAgICBbdGhpcy5rbm9icywgdGhpcy5jb250cm9sLCBidXR0b25zLCB0aGlzLmdyaWRdLFxuICAgICAgICAobW9kdWxlKSA9PiBmb3JlYWNoKG1vZHVsZS5oYW5kbGVkX2NjcywgKHZhbHVlLCBrZXkpID0+IHRoaXMuY2NNYXBbdmFsdWVdID0gbW9kdWxlKVxuICAgICk7XG5cbiAgICAvLyBEZWZpbmVzIHB1YmxpYyBBUEkgcmV0dXJuZWRcbiAgICBjb25zdCBhcGkgPSB7XG4gICAgICAgIGtub2I6IHtcbiAgICAgICAgICAgIHRlbXBvOiB0aGlzLmtub2JzLnRlbXBvLFxuICAgICAgICAgICAgc3dpbmc6IHRoaXMua25vYnMuc3dpbmcsXG4gICAgICAgICAgICBtYXN0ZXI6IHRoaXMua25vYnMubWFzdGVyLFxuICAgICAgICB9LFxuICAgICAgICBncmlkOiB7IHg6IHt9fSxcbiAgICAgICAgdG91Y2hzdHJpcDogdGhpcy50b3VjaHN0cmlwLFxuICAgICAgICBsY2Q6IG5ldyBMQ0RzKG1pZGlfb3V0LnNlbmRfc3lzZXgpLFxuICAgICAgICBidXR0b246IHtcbiAgICAgICAgICAgICcxLzMydCc6IHRoaXMuY29udHJvbFsnMS8zMnQnXSxcbiAgICAgICAgICAgICcxLzMyJzogdGhpcy5jb250cm9sWycxLzMyJ10sXG4gICAgICAgICAgICAnMS8xNnQnOiB0aGlzLmNvbnRyb2xbJzEvMTZ0J10sXG4gICAgICAgICAgICAnMS8xNic6IHRoaXMuY29udHJvbFsnMS8xNiddLFxuICAgICAgICAgICAgJzEvOHQnOiB0aGlzLmNvbnRyb2xbJzEvOHQnXSxcbiAgICAgICAgICAgICcxLzgnOiB0aGlzLmNvbnRyb2xbJzEvOCddLFxuICAgICAgICAgICAgJzEvNHQnOiB0aGlzLmNvbnRyb2xbJzEvNHQnXSxcbiAgICAgICAgICAgICcxLzQnOiB0aGlzLmNvbnRyb2xbJzEvNCddLFxuICAgICAgICB9LFxuICAgICAgICBjaGFubmVsOiB7fSxcbiAgICAgICAgcmVjZWl2ZV9taWRpOiBwYXJ0aWFsKHJlY2VpdmVfbWlkaSwgdGhpcyksXG4gICAgfVxuICAgIGZvcmVhY2goXG4gICAgICAgIG9uZV90b19laWdodCxcbiAgICAgICAgKG51bWJlcikgPT4gYXBpLmNoYW5uZWxbbnVtYmVyXSA9IHsga25vYjogdGhpcy5rbm9ic1tudW1iZXJdLCBzZWxlY3Q6IHRoaXMuY29udHJvbFtudW1iZXJdIH1cbiAgICApO1xuICAgIGZvcmVhY2goXG4gICAgICAgIG9uZV90b19laWdodCxcbiAgICAgICAgKFgpID0+IHtcbiAgICAgICAgICAgIGFwaS5ncmlkLnhbWF0gPSB7IHk6IHt9LCBzZWxlY3Q6IHRoaXMuZ3JpZC5zZWxlY3RbWF0sIH07XG4gICAgICAgICAgICBmb3JlYWNoKG9uZV90b19laWdodCwgKFkpID0+IHtcbiAgICAgICAgICAgICAgICBhcGkuZ3JpZC54W1hdLnlbWV0gPSB0aGlzLmdyaWQueFtYXS55W1ldO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICApO1xuICAgIGZvcmVhY2goXG4gICAgICAgIGJ1dHRvbnMubmFtZXMsXG4gICAgICAgIChidXR0b25fbmFtZSkgPT4gYXBpLmJ1dHRvbltidXR0b25fbmFtZV0gPSBidXR0b25zW2J1dHRvbl9uYW1lXVxuICAgIClcbiAgICByZXR1cm4gYXBpO1xufVxudXRpbC5pbmhlcml0cyhQdXNoLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBoYW5kbGVfbWlkaV9jYyhwdXNoLCBpbmRleCwgdmFsdWUpIHtcbiAgICBpZiAoaW5kZXggaW4gcHVzaC5jY01hcCkge1xuICAgICAgICBwdXNoLmNjTWFwW2luZGV4XS5yZWNlaXZlX21pZGlfY2MoaW5kZXgsIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnTm8ga25vd24gbWFwcGluZyBmb3IgQ0M6ICcgKyBpbmRleCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVfbWlkaV9ub3RlKHB1c2gsIG5vdGUsIHZlbG9jaXR5KSB7XG4gICAgaWYgKG5vdGUgaW4gcHVzaC5ub3RlTWFwKSB7XG4gICAgICAgIHB1c2gubm90ZU1hcFtub3RlXS5yZWNlaXZlX21pZGlfbm90ZShub3RlLCB2ZWxvY2l0eSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vIGtub3duIG1hcHBpbmcgZm9yIG5vdGU6ICcgKyBub3RlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZV9taWRpX3BpdGNoX2JlbmQocHVzaCwgbHNiX2J5dGUsIG1zYl9ieXRlKSB7XG4gICAgcHVzaC50b3VjaHN0cmlwLnJlY2VpdmVfbWlkaV9waXRjaF9iZW5kKChtc2JfYnl0ZSA8PCA3KSArIGxzYl9ieXRlKTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlX21pZGlfcG9seV9wcmVzc3VyZShwdXNoLCBub3RlLCBwcmVzc3VyZSkge1xuICAgIHB1c2guZ3JpZC5yZWNlaXZlX21pZGlfcG9seV9wcmVzc3VyZShub3RlLCBwcmVzc3VyZSk7XG59XG5cbnZhciBtaWRpX21lc3NhZ2VzID0ge1xuICAgICdub3RlLW9mZic6IDEyOCwgLy8gbm90ZSBudW1iZXIsIHZlbG9jaXR5XG4gICAgJ25vdGUtb24nOiAxNDQsIC8vIG5vdGUgbnVtYmVyLCB2ZWxvY2l0eVxuICAgICdwb2x5LXByZXNzdXJlJzogMTYwLCAvLyBub3RlIG51bWJlciwgdmVsb2NpdHlcbiAgICAnY2MnOiAxNzYsIC8vIGNjIG51bWJlciwgdmFsdWVcbiAgICAncHJvZ3JhbS1jaGFuZ2UnOiAxOTIsIC8vIHBnbSBudW1iZXJcbiAgICAnY2hhbm5lbC1wcmVzc3VyZSc6IDIwOCwgLy8gdmVsb2NpdHlcbiAgICAncGl0Y2gtYmVuZCc6IDIyNCwgLy8gbHNiICg3LWJpdHMpLCBtc2IgKDctYml0cylcbiAgICAnc3lzZXgnOiAyNDAsIC8vIGlkIFsxIG9yIDMgYnl0ZXNdLCBkYXRhIFtuIGJ5dGVzXSwgMjQ3XG59XG5cbi8vIEhhbmRsZXMgTUlESSAoQ0MpIGRhdGEgZnJvbSBQdXNoIC0gY2F1c2VzIGV2ZW50cyB0byBiZSBlbWl0dGVkXG5mdW5jdGlvbiByZWNlaXZlX21pZGkocHVzaCwgYnl0ZXMpIHtcbiAgICB2YXIgbWVzc2FnZV90eXBlID0gYnl0ZXNbMF0gJiAweGYwO1xuICAgIHZhciBtaWRpX2NoYW5uZWwgPSBieXRlc1swXSAmIDB4MGY7XG5cbiAgICBzd2l0Y2ggKG1lc3NhZ2VfdHlwZSkge1xuICAgICAgICBjYXNlIChtaWRpX21lc3NhZ2VzWydjYyddKTpcbiAgICAgICAgICAgIGhhbmRsZV9taWRpX2NjKHB1c2gsIGJ5dGVzWzFdLCBieXRlc1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAobWlkaV9tZXNzYWdlc1snbm90ZS1vbiddKTpcbiAgICAgICAgY2FzZSAobWlkaV9tZXNzYWdlc1snbm90ZS1vZmYnXSk6XG4gICAgICAgICAgICBoYW5kbGVfbWlkaV9ub3RlKHB1c2gsIGJ5dGVzWzFdLCBieXRlc1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAobWlkaV9tZXNzYWdlc1sncGl0Y2gtYmVuZCddKTpcbiAgICAgICAgICAgIGhhbmRsZV9taWRpX3BpdGNoX2JlbmQocHVzaCwgYnl0ZXNbMV0sIGJ5dGVzWzJdKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlKG1pZGlfbWVzc2FnZXNbJ3BvbHktcHJlc3N1cmUnXSk6XG4gICAgICAgICAgICBoYW5kbGVfbWlkaV9wb2x5X3ByZXNzdXJlKHB1c2gsIGJ5dGVzWzFdLCBieXRlc1syXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59XG5cbi8vIEFkYXB0b3IgZnVuY3Rpb24gdXNlZCB0byBiaW5kIHRvIHdlYiBNSURJIEFQSVxuUHVzaC5jcmVhdGVfYm91bmRfdG9fd2ViX21pZGlfYXBpID0gZnVuY3Rpb24obWlkaUFjY2Vzcykge1xuICAgIHZhciBpbnB1dHMgPSBtaWRpQWNjZXNzLmlucHV0cy52YWx1ZXMoKSxcbiAgICAgICAgb3V0cHV0cyA9IG1pZGlBY2Nlc3Mub3V0cHV0cy52YWx1ZXMoKSxcbiAgICAgICAgcHVzaDtcblxuICAgIGZvciAodmFyIG91dHB1dCA9IG91dHB1dHMubmV4dCgpOyBvdXRwdXQgJiYgIW91dHB1dC5kb25lOyBvdXRwdXQgPSBvdXRwdXRzLm5leHQoKSkge1xuICAgICAgICBjb25zb2xlLmxvZygnRm91bmQgb3V0cHV0OiAnICsgb3V0cHV0LnZhbHVlLm5hbWUpO1xuICAgICAgICBpZiAoJ0FibGV0b24gUHVzaCBVc2VyIFBvcnQnID09IG91dHB1dC52YWx1ZS5uYW1lKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQmluZGluZyBNSURJIG91dHB1dCB0byAnICsgb3V0cHV0LnZhbHVlLm5hbWUpO1xuICAgICAgICAgICAgcHVzaCA9IG5ldyBQdXNoKG91dHB1dC52YWx1ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwdXNoID09PSB1bmRlZmluZWQpIHB1c2ggPSBuZXcgUHVzaCh7IHNlbmQ6IChieXRlcykgPT4geyAnbm8gaW1wbGVtZW50YXRpb24gYnkgZGVmYXVsdCcgfSB9KTtcblxuICAgIGZvciAodmFyIGlucHV0ID0gaW5wdXRzLm5leHQoKTsgaW5wdXQgJiYgIWlucHV0LmRvbmU7IGlucHV0ID0gaW5wdXRzLm5leHQoKSkge1xuICAgICAgICBjb25zb2xlLmxvZygnRm91bmQgaW5wdXQ6ICcgKyBpbnB1dC52YWx1ZS5uYW1lKTtcbiAgICAgICAgaWYgKCdBYmxldG9uIFB1c2ggVXNlciBQb3J0JyA9PSBpbnB1dC52YWx1ZS5uYW1lKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQmluZGluZyBNSURJIGlucHV0IHRvICcgKyBpbnB1dC52YWx1ZS5uYW1lKTtcbiAgICAgICAgICAgIGlucHV0LnZhbHVlLm9ubWlkaW1lc3NhZ2UgPSAoZXZlbnQpID0+IHsgcHVzaC5yZWNlaXZlX21pZGkoZXZlbnQuZGF0YSkgfTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHB1c2g7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUHVzaDtcbiIsImNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyk7XG5cbnZhciBjY1RvQnV0dG9uTWFwID0ge1xuICAgIDM6ICd0YXBfdGVtcG8nLFxuICAgIDk6ICdtZXRyb25vbWUnLFxuICAgIDExOTogJ3VuZG8nLFxuICAgIDExODogJ2RlbGV0ZScsXG4gICAgMTE3OiAnZG91YmxlJyxcbiAgICAxMTY6ICdxdWFudGl6ZScsXG4gICAgOTA6ICdmaXhlZF9sZW5ndGgnLFxuICAgIDg5OiAnYXV0b21hdGlvbicsXG4gICAgODg6ICdkdXBsaWNhdGUnLFxuICAgIDg3OiAnbmV3JyxcbiAgICA4NjogJ3JlYycsXG4gICAgODU6ICdwbGF5JyxcbiAgICAyODogJ21hc3RlcicsXG4gICAgMjk6ICdzdG9wJyxcbiAgICA0NDogJ2xlZnQnLFxuICAgIDQ1OiAncmlnaHQnLFxuICAgIDQ2OiAndXAnLFxuICAgIDQ3OiAnZG93bicsXG4gICAgMTE0OiAndm9sdW1lJyxcbiAgICAxMTU6ICdwYW5fJl9zZW5kJyxcbiAgICAxMTI6ICd0cmFjaycsXG4gICAgMTEzOiAnY2xpcCcsXG4gICAgMTEwOiAnZGV2aWNlJyxcbiAgICAxMTE6ICdicm93c2UnLFxuICAgIDYyOiAnc3RlcF9pbicsXG4gICAgNjM6ICdzdGVwX291dCcsXG4gICAgNjA6ICdtdXRlJyxcbiAgICA2MTogJ3NvbG8nLFxuICAgIDU4OiAnc2NhbGVzJyxcbiAgICA1OTogJ3VzZXInLFxuICAgIDU2OiAncmVwZWF0JyxcbiAgICA1NzogJ2FjY2VudCcsXG4gICAgNTQ6ICdvY3RhdmVfZG93bicsXG4gICAgNTU6ICdvY3RhdmVfdXAnLFxuICAgIDUyOiAnYWRkX2VmZmVjdCcsXG4gICAgNTM6ICdhZGRfdHJhY2snLFxuICAgIDUwOiAnbm90ZScsXG4gICAgNTE6ICdzZXNzaW9uJyxcbiAgICA0ODogJ3NlbGVjdCcsXG4gICAgNDk6ICdzaGlmdCdcbn1cbmNvbnN0IGhhbmRsZWRfY2NzID0gT2JqZWN0LmtleXMoY2NUb0J1dHRvbk1hcCk7XG5cbmZ1bmN0aW9uIEJ1dHRvbihzZW5kX2NjLCBjYykge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIHJldHVybiB7XG4gICAgICAgIGxlZF9vbjogZnVuY3Rpb24oKSB7IHNlbmRfY2MoY2MsIDQpIH0sXG4gICAgICAgIGxlZF9kaW06IGZ1bmN0aW9uKCkgeyBzZW5kX2NjKGNjLCAxKSB9LFxuICAgICAgICBsZWRfb2ZmOiBmdW5jdGlvbigpIHsgc2VuZF9jYyhjYywgMCkgfSxcbiAgICAgICAgcmVkOiAoKSA9PiB7fSxcbiAgICAgICAgb3JhbmdlOiAoKSA9PiB7fSxcbiAgICAgICAgeWVsbG93OiAoKSA9PiB7fSxcbiAgICAgICAgZ3JlZW46ICgpID0+IHt9LFxuICAgICAgICBvbjogdGhpcy5vbixcbiAgICAgICAgZW1pdDogdGhpcy5lbWl0LFxuICAgIH1cbn1cbnV0aWwuaW5oZXJpdHMoQnV0dG9uLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBCdXR0b25zKHNlbmRfY2MpIHtcbiAgICBjb25zdCBidXR0b25zID0gdGhpcztcbiAgICBmb3JlYWNoKGNjVG9CdXR0b25NYXAsICh2YWx1ZSwga2V5KSA9PiB0aGlzW3ZhbHVlXSA9IG5ldyBCdXR0b24oc2VuZF9jYywgcGFyc2VJbnQoa2V5KSkpO1xuICAgIHRoaXMubmFtZXMgPSBPYmplY3Qua2V5cyhjY1RvQnV0dG9uTWFwKS5tYXAoKGtleSkgPT4geyByZXR1cm4gY2NUb0J1dHRvbk1hcFtrZXldIH0pO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX2NjID0gZnVuY3Rpb24oaW5kZXgsIHZhbHVlKSB7XG4gICAgICAgIGJ1dHRvbnNbY2NUb0J1dHRvbk1hcFtpbmRleF1dLmVtaXQocHJlc3NlZF9vcl9yZWxlYXNlZCh2YWx1ZSkpO1xuICAgIH07XG4gICAgdGhpcy5oYW5kbGVkX2NjcyA9IGhhbmRsZWRfY2NzO1xufVxuXG5mdW5jdGlvbiBwcmVzc2VkX29yX3JlbGVhc2VkKHZlbG9jaXR5KSB7XG4gICAgcmV0dXJuIHBhcnNlSW50KHZlbG9jaXR5KSA+IDAgPyAncHJlc3NlZCcgOiAncmVsZWFzZWQnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEJ1dHRvbnM7XG4iLCJjb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpLFxuICAgIGZvcmVhY2ggPSByZXF1aXJlKCdsb2Rhc2guZm9yZWFjaCcpO1xuXG52YXIgY2NUb1BhZE1hcCA9IHtcbiAgICAyMDogMSwgLy8gdG9wIHJvdyBhYm92ZSBncmlkXG4gICAgMjE6IDIsXG4gICAgMjI6IDMsXG4gICAgMjM6IDQsXG4gICAgMjQ6IDUsXG4gICAgMjU6IDYsXG4gICAgMjY6IDcsXG4gICAgMjc6IDgsXG4gICAgNDM6ICcxLzMydCcsXG4gICAgNDI6ICcxLzMyJyxcbiAgICA0MTogJzEvMTZ0JyxcbiAgICA0MDogJzEvMTYnLFxuICAgIDM5OiAnMS84dCcsXG4gICAgMzg6ICcxLzgnLFxuICAgIDM3OiAnMS80dCcsXG4gICAgMzY6ICcxLzQnLFxufVxuY29uc3QgaGFuZGxlZF9jY3MgPSBPYmplY3Qua2V5cyhjY1RvUGFkTWFwKTtcblxuZnVuY3Rpb24gUGFkKHNlbmRfY2MsIGNjKSB7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy5vdXRwdXQgPSBmdW5jdGlvbih2YWx1ZSkgeyBzZW5kX2NjKGNjLCB2YWx1ZSkgfTtcbiAgICB2YXIgY29sb3VycyA9IFs3LCAxMF07IC8vIGRpbSwgYnJpZ2h0XG4gICAgdGhpcy5jb2xvdXJzID0gWzcsIDEwXTsgLy8gZGltLCBicmlnaHRcbiAgICByZXR1cm4ge1xuICAgICAgICBsZWRfb246IGZ1bmN0aW9uKCkgeyBzZW5kX2NjKGNjLCBjb2xvdXJzWzFdKSB9LFxuICAgICAgICBsZWRfZGltOiBmdW5jdGlvbigpIHsgc2VuZF9jYyhjYywgY29sb3Vyc1swXSkgfSxcbiAgICAgICAgbGVkX29mZjogZnVuY3Rpb24oKSB7IHNlbmRfY2MoY2MsIDApIH0sXG4gICAgICAgIHJlZDogZnVuY3Rpb24oKSB7IGNvbG91cnMgPSBbMSwgNF0gfSxcbiAgICAgICAgb3JhbmdlOiBmdW5jdGlvbigpIHsgY29sb3VycyA9IFs3LCAxMF0gfSxcbiAgICAgICAgeWVsbG93OiBmdW5jdGlvbigpIHsgY29sb3VycyA9IFsxMywgMTZdIH0sXG4gICAgICAgIGdyZWVuOiBmdW5jdGlvbigpIHsgY29sb3VycyA9IFsxOSwgMjJdIH0sXG4gICAgICAgIG9uOiB0aGlzLm9uLFxuICAgICAgICBlbWl0OiB0aGlzLmVtaXQsXG4gICAgfVxufVxudXRpbC5pbmhlcml0cyhQYWQsIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIENvbnRyb2xCdXR0b25zKHNlbmRfY2MpIHtcbiAgICBjb25zdCBjb250cm9sX2J1dHRvbnMgPSB0aGlzO1xuICAgIGZvcmVhY2goY2NUb1BhZE1hcCwgKHZhbHVlLCBrZXkpID0+IHRoaXNbdmFsdWVdID0gbmV3IFBhZChzZW5kX2NjLCBwYXJzZUludChrZXkpKSk7XG4gICAgdGhpcy5oYW5kbGVkX2NjcyA9IGhhbmRsZWRfY2NzO1xuICAgIHRoaXMucmVjZWl2ZV9taWRpX2NjID0gZnVuY3Rpb24oY2MsIHZhbHVlKSB7XG4gICAgICAgIHZhciBwYWRfbmFtZSA9IGNjVG9QYWRNYXBbY2NdO1xuICAgICAgICBjb250cm9sX2J1dHRvbnNbcGFkX25hbWVdLmVtaXQodmFsdWUgPiAwID8gJ3ByZXNzZWQnIDogJ3JlbGVhc2VkJyk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRyb2xCdXR0b25zO1xuIiwiY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKSxcbiAgICBwYXJ0aWFsID0gcmVxdWlyZSgnbG9kYXNoLnBhcnRpYWwnKTtcblxuY29uc3QgY29udHJvbF9idXR0b25zID0ge1xuICAgIDEwMjogMSxcbiAgICAxMDM6IDIsXG4gICAgMTA0OiAzLFxuICAgIDEwNTogNCxcbiAgICAxMDY6IDUsXG4gICAgMTA3OiA2LFxuICAgIDEwODogNyxcbiAgICAxMDk6IDhcbn07XG5jb25zdCBoYW5kbGVkX2NjcyA9IE9iamVjdC5rZXlzKGNvbnRyb2xfYnV0dG9ucyk7XG5cbnZhciBoYW5kbGVkX25vdGVzID0gW107XG5mb3IgKHZhciBpID0gMzY7IGkgPD0gOTk7IGkrKykgaGFuZGxlZF9ub3Rlcy5wdXNoKGkpO1xuXG5mdW5jdGlvbiBHcmlkQnV0dG9uKHNlbmRfbWlkaV9tZXNzYWdlLCBzZW5kX3N5c2V4LCBub3RlKSB7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgdGhpcy5ub3RlX291dCA9IGZ1bmN0aW9uKHZlbG9jaXR5KSB7IHNlbmRfbWlkaV9tZXNzYWdlKG5vdGUsIHZlbG9jaXR5KSB9O1xuICAgIHRoaXMuc3lzZXhfb3V0ID0gZnVuY3Rpb24oZGF0YSkgeyBzZW5kX3N5c2V4KGRhdGEpIH07XG4gICAgdGhpcy5pbmRleCA9IG5vdGUgPCAxMDIgPyBub3RlIC0gMzYgOiBub3RlIC0gMzg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBsZWRfb246IHBhcnRpYWwobGVkX29uLCB0aGlzKSxcbiAgICAgICAgbGVkX29mZjogcGFydGlhbChsZWRfb2ZmLCB0aGlzKSxcbiAgICAgICAgbGVkX3JnYjogcGFydGlhbChsZWRfcmdiLCB0aGlzKSxcbiAgICAgICAgb246IHRoaXMub24sXG4gICAgICAgIGVtaXQ6IHRoaXMuZW1pdCxcbiAgICB9XG59XG51dGlsLmluaGVyaXRzKEdyaWRCdXR0b24sIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIGxlZF9vbihncmlkQnV0dG9uLCB2YWx1ZSkgeyBncmlkQnV0dG9uLm5vdGVfb3V0KHZhbHVlID8gdmFsdWUgOiAxMDApIH1cbmZ1bmN0aW9uIGxlZF9vZmYoZ3JpZEJ1dHRvbikgeyBncmlkQnV0dG9uLm5vdGVfb3V0KDApIH1cbmZ1bmN0aW9uIGxlZF9yZ2IoZ3JpZEJ1dHRvbiwgciwgZywgYikge1xuICAgIHZhciBtc2IgPSBbciwgZywgYl0ubWFwKCh4KSA9PiAoeCAmIDI0MCkgPj4gNCksXG4gICAgICAgIGxzYiA9IFtyLCBnLCBiXS5tYXAoKHgpID0+IHggJiAxNSk7XG4gICAgZ3JpZEJ1dHRvbi5zeXNleF9vdXQoWzQsIDAsIDgsIGdyaWRCdXR0b24uaW5kZXgsIDAsIG1zYlswXSwgbHNiWzBdLCBtc2JbMV0sIGxzYlsxXSwgbXNiWzJdLCBsc2JbMl1dKTtcbn1cblxuZnVuY3Rpb24gR3JpZChzZW5kX25vdGUsIHNlbmRfY2MsIHNlbmRfc3lzZXgpIHtcbiAgICB0aGlzLnggPSB7fTtcbiAgICB0aGlzLnNlbGVjdCA9IHt9O1xuICAgIGZvciAodmFyIHggPSAxOyB4IDw9IDg7IHgrKykge1xuICAgICAgICB0aGlzLnhbeF0gPSB7IHk6IHt9IH1cbiAgICAgICAgZm9yICh2YXIgeSA9IDE7IHkgPD0gODsgeSsrKSB7XG4gICAgICAgICAgICB0aGlzLnhbeF0ueVt5XSA9IG5ldyBHcmlkQnV0dG9uKHNlbmRfbm90ZSwgc2VuZF9zeXNleCwgKHggLSAxKSArICgoeSAtIDEpICogOCkgKyAzNik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3JlYWNoKGNvbnRyb2xfYnV0dG9ucywgKHZhbHVlLCBrZXkpID0+IHRoaXMuc2VsZWN0W3ZhbHVlXSA9IG5ldyBHcmlkQnV0dG9uKHNlbmRfY2MsIHNlbmRfc3lzZXgsIHBhcnNlSW50KGtleSkpKTtcbiAgICB0aGlzLmhhbmRsZWRfY2NzID0gaGFuZGxlZF9jY3M7XG4gICAgdGhpcy5oYW5kbGVkX25vdGVzID0gaGFuZGxlZF9ub3RlcztcbiAgICB0aGlzLnJlY2VpdmVfbWlkaV9ub3RlID0gcGFydGlhbChyZWNlaXZlX21pZGlfbm90ZSwgdGhpcyk7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfY2MgPSBwYXJ0aWFsKHJlY2VpdmVfbWlkaV9jYywgdGhpcyk7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfcG9seV9wcmVzc3VyZSA9IHBhcnRpYWwocmVjZWl2ZV9taWRpX3BvbHlfcHJlc3N1cmUsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiByZWNlaXZlX21pZGlfbm90ZShncmlkLCBub3RlLCB2ZWxvY2l0eSkge1xuICAgIHZhciBidXR0b24gPSBidXR0b25fZnJvbV9ub3RlKGdyaWQsIG5vdGUpLFxuICAgICAgICB2ZWwgPSBwYXJzZUludCh2ZWxvY2l0eSk7XG4gICAgdmVsID4gMCA/IGJ1dHRvbi5lbWl0KCdwcmVzc2VkJywgdmVsKSA6IGJ1dHRvbi5lbWl0KCdyZWxlYXNlZCcpO1xufVxuXG5mdW5jdGlvbiByZWNlaXZlX21pZGlfY2MoZ3JpZCwgaW5kZXgsIHZhbHVlKSB7XG4gICAgZ3JpZC5zZWxlY3RbY29udHJvbF9idXR0b25zW2luZGV4XV0uZW1pdCh2YWx1ZSA+IDAgPyAncHJlc3NlZCcgOiAncmVsZWFzZWQnKTtcbn1cblxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpX3BvbHlfcHJlc3N1cmUoZ3JpZCwgbm90ZSwgcHJlc3N1cmUpIHtcbiAgICBidXR0b25fZnJvbV9ub3RlKGdyaWQsIG5vdGUpLmVtaXQoJ2FmdGVydG91Y2gnLCBwYXJzZUludChwcmVzc3VyZSkpO1xufVxuXG5mdW5jdGlvbiBidXR0b25fZnJvbV9ub3RlKGdyaWQsIG5vdGUpIHtcbiAgICB2YXIgaW5kZXhlZF9mcm9tX3plcm8gPSBub3RlIC0gMzYsXG4gICAgICAgIHggPSAoaW5kZXhlZF9mcm9tX3plcm8gJSA4KSArIDEsXG4gICAgICAgIHkgPSBwYXJzZUludChpbmRleGVkX2Zyb21femVybyAvIDgpICsgMTtcbiAgICByZXR1cm4gZ3JpZC54W3hdLnlbeV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gR3JpZDtcbiIsImNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksXG4gICAgZm9yZWFjaCA9IHJlcXVpcmUoJ2xvZGFzaC5mb3JlYWNoJyksXG4gICAgcGFydGlhbCA9IHJlcXVpcmUoJ2xvZGFzaC5wYXJ0aWFsJyk7XG5cbnZhciBrbm9iTWFwID0ge1xuICAgICd0ZW1wbyc6IHsgJ2NjJzogMTQsICdub3RlJzogMTAgfSxcbiAgICAnc3dpbmcnOiB7ICdjYyc6IDE1LCAnbm90ZSc6IDkgfSxcbiAgICAxOiB7ICdjYyc6IDcxLCAnbm90ZSc6IDAgfSxcbiAgICAyOiB7ICdjYyc6IDcyLCAnbm90ZSc6IDEgfSxcbiAgICAzOiB7ICdjYyc6IDczLCAnbm90ZSc6IDIgfSxcbiAgICA0OiB7ICdjYyc6IDc0LCAnbm90ZSc6IDMgfSxcbiAgICA1OiB7ICdjYyc6IDc1LCAnbm90ZSc6IDQgfSxcbiAgICA2OiB7ICdjYyc6IDc2LCAnbm90ZSc6IDUgfSxcbiAgICA3OiB7ICdjYyc6IDc3LCAnbm90ZSc6IDYgfSxcbiAgICA4OiB7ICdjYyc6IDc4LCAnbm90ZSc6IDcgfSxcbiAgICAnbWFzdGVyJzogeyAnY2MnOiA3OSwgJ25vdGUnOiA4IH0sXG59XG5cbnZhciBjY1RvS25vYk1hcCA9IHt9O1xudmFyIG5vdGVUb0tub2JNYXAgPSB7fTtcbmZvcmVhY2goa25vYk1hcCwgKHZhbHVlLCBrZXkpID0+IHtcbiAgICBjY1RvS25vYk1hcFt2YWx1ZS5jY10gPSBrZXk7XG4gICAgbm90ZVRvS25vYk1hcFt2YWx1ZS5ub3RlXSA9IGtleTtcbn0pO1xuY29uc3QgaGFuZGxlZF9jY3MgPSBPYmplY3Qua2V5cyhjY1RvS25vYk1hcCksXG4gICAgaGFuZGxlZF9ub3RlcyA9IE9iamVjdC5rZXlzKG5vdGVUb0tub2JNYXApO1xuXG5mdW5jdGlvbiBLbm9iKCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xufVxudXRpbC5pbmhlcml0cyhLbm9iLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBLbm9icygpIHtcbiAgICBmb3JlYWNoKGtub2JNYXAsICh2YWx1ZSwga2V5KSA9PiB0aGlzW2tleV0gPSBuZXcgS25vYigpKTtcbiAgICB0aGlzLmhhbmRsZWRfY2NzID0gaGFuZGxlZF9jY3M7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfY2MgPSBwYXJ0aWFsKHJlY2VpdmVfbWlkaV9jYywgdGhpcyk7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfbm90ZSA9IHBhcnRpYWwocmVjZWl2ZV9taWRpX25vdGUsIHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlZF9ub3RlcyA9IGhhbmRsZWRfbm90ZXM7XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmVfbWlkaV9jYyhrbm9icywgaW5kZXgsIHZhbHVlKSB7XG4gICAgdmFyIGtub2JfbmFtZSA9IGNjVG9Lbm9iTWFwW2luZGV4XTtcbiAgICB2YXIgZGVsdGEgPSB2YWx1ZSA8IDY0ID8gdmFsdWUgOiB2YWx1ZSAtIDEyODtcbiAgICBrbm9ic1trbm9iX25hbWVdLmVtaXQoJ3R1cm5lZCcsIGRlbHRhKTtcbn1cblxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpX25vdGUoa25vYnMsIG5vdGUsIHZlbG9jaXR5KSB7XG4gICAgdmFyIGtub2JfbmFtZSA9IG5vdGVUb0tub2JNYXBbbm90ZV07XG4gICAgdmFyIGV2ZW50X25hbWUgPSB2ZWxvY2l0eSA+IDAgPyAncHJlc3NlZCcgOiAncmVsZWFzZWQnO1xuICAgIGtub2JzW2tub2JfbmFtZV0uZW1pdChldmVudF9uYW1lKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBLbm9icztcbiIsImNvbnN0IGZvcmVhY2ggPSByZXF1aXJlKCdsb2Rhc2guZm9yZWFjaCcpLFxuICAgIG9uZV90b19laWdodCA9IFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4XSxcbiAgICBvbmVfdG9fZm91ciA9IFsxLCAyLCAzLCA0XSxcbiAgICB6ZXJvX3RvX3NldmVuID0gWzAsIDEsIDIsIDMsIDQsIDUsIDYsIDddLFxuICAgIGJsYW5rID0gMzI7XG5cbmZ1bmN0aW9uIExDRFNlZ21lbnQobGNkcywgdXBkYXRlX3Jvdykge1xuICAgIHZhciBsY2Rfc2VnbWVudCA9IHRoaXM7XG4gICAgdGhpcy5sY2RfZGF0YSA9IFtibGFuaywgYmxhbmssIGJsYW5rLCBibGFuaywgYmxhbmssIGJsYW5rLCBibGFuaywgYmxhbmtdO1xuXG4gICAgdGhpcy51cGRhdGUgPSBmdW5jdGlvbih0ZXh0KSB7XG4gICAgICAgIGxjZF9zZWdtZW50LmxjZF9kYXRhID0gbGNkX2RhdGEoU3RyaW5nKHRleHQpKTtcbiAgICAgICAgdXBkYXRlX3JvdygpO1xuICAgIH07XG5cbiAgICB0aGlzLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGxjZF9zZWdtZW50LmxjZF9kYXRhID0gbGNkX2RhdGEoU3RyaW5nKCcnKSk7XG4gICAgICAgIHVwZGF0ZV9yb3coKTtcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBsY2RfZGF0YSh0ZXh0KSB7XG4gICAgcmV0dXJuIHplcm9fdG9fc2V2ZW4ubWFwKChpbmRleCkgPT4ge1xuICAgICAgICByZXR1cm4gdGV4dC5sZW5ndGggPiBpbmRleCA/IHRleHQuY2hhckNvZGVBdChpbmRleCkgOiBibGFuaztcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gTENEcyhzZW5kX3N5c2V4KSB7XG4gICAgY29uc3QgbGNkcyA9IHRoaXM7XG4gICAgY29uc3QgdXBkYXRlX3JvdyA9IGZ1bmN0aW9uIChyb3dfbnVtYmVyKSB7XG4gICAgICAgIHZhciBkaXNwbGF5X2RhdGEgPSBbXTtcbiAgICAgICAgZm9yZWFjaChvbmVfdG9fZWlnaHQsIChjaGFubmVsKSA9PiB7XG4gICAgICAgICAgICBkaXNwbGF5X2RhdGEgPSBkaXNwbGF5X2RhdGEuY29uY2F0KGxjZHMueFtjaGFubmVsXS55W3Jvd19udW1iZXJdLmxjZF9kYXRhKTtcbiAgICAgICAgICAgIGlmICgoY2hhbm5lbCAlIDIpID09IDEpIGRpc3BsYXlfZGF0YS5wdXNoKGJsYW5rKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbmRfc3lzZXgoXG4gICAgICAgICAgICBbMjggLSByb3dfbnVtYmVyXVxuICAgICAgICAgICAgLmNvbmNhdChbMCwgNjksIDBdKVxuICAgICAgICAgICAgLmNvbmNhdChkaXNwbGF5X2RhdGEpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBmb3JlYWNoKFxuICAgICAgICAgICAgb25lX3RvX2VpZ2h0LFxuICAgICAgICAgICAgKHgpID0+IHtcbiAgICAgICAgICAgICAgICBsY2RzLnhbeF0gPSB7IHk6IHt9IH07XG4gICAgICAgICAgICAgICAgZm9yZWFjaChcbiAgICAgICAgICAgICAgICAgICAgb25lX3RvX2ZvdXIsXG4gICAgICAgICAgICAgICAgICAgICh5KSA9PiB7IGxjZHMueFt4XS55W3ldID0gbmV3IExDRFNlZ21lbnQobGNkcywgKCkgPT4gdXBkYXRlX3Jvdyh5KSkgfVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgICAgICBmb3JlYWNoKG9uZV90b19mb3VyLCByb3cgPT4gdXBkYXRlX3Jvdyhyb3cpKTtcbiAgICB9O1xuXG4gICAgdGhpcy54ID0ge307XG5cbiAgICB0aGlzLmNsZWFyKCk7XG5cbiAgICB0aGlzLnhbOF0ueVs0XS51cGRhdGUoJyBwb3dlcmVkJyk7XG4gICAgdGhpcy54WzhdLnlbM10udXBkYXRlKCcgICAgICBieScpO1xuICAgIHRoaXMueFs4XS55WzJdLnVwZGF0ZSgnICAgcHVzaC0nKTtcbiAgICB0aGlzLnhbOF0ueVsxXS51cGRhdGUoJyB3cmFwcGVyJyk7XG5cbiAgICBmb3JlYWNoKG9uZV90b19mb3VyLCByb3cgPT4gdXBkYXRlX3Jvdyhyb3cpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBMQ0RzO1xuIiwiY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBwYXJ0aWFsID0gcmVxdWlyZSgnbG9kYXNoLnBhcnRpYWwnKSxcbiAgICBoYW5kbGVkX25vdGVzID0gWzEyXTtcblxuZnVuY3Rpb24gVG91Y2hTdHJpcCgpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnJlY2VpdmVfbWlkaV9waXRjaF9iZW5kID0gcGFydGlhbChyZWNlaXZlX21pZGlfcGl0Y2hfYmVuZCwgdGhpcyk7XG4gICAgdGhpcy5yZWNlaXZlX21pZGlfbm90ZSA9IHBhcnRpYWwocmVjZWl2ZV9taWRpX25vdGUsIHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlZF9ub3RlcyA9IGhhbmRsZWRfbm90ZXM7XG59XG51dGlsLmluaGVyaXRzKFRvdWNoU3RyaXAsIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIHJlY2VpdmVfbWlkaV9waXRjaF9iZW5kKHRvdWNoc3RyaXAsIGZvdXJ0ZWVuX2JpdF92YWx1ZSkge1xuICAgIGlmIChmb3VydGVlbl9iaXRfdmFsdWUgPT0gODE5MikgcmV0dXJuO1xuICAgIHRvdWNoc3RyaXAuZW1pdCgncGl0Y2hiZW5kJywgZm91cnRlZW5fYml0X3ZhbHVlKTtcbn1cblxuZnVuY3Rpb24gcmVjZWl2ZV9taWRpX25vdGUodG91Y2hzdHJpcCwgbm90ZSwgdmVsb2NpdHkpIHtcbiAgICBpZiAodmVsb2NpdHkgPiAwKSB7XG4gICAgICAgIHRvdWNoc3RyaXAuZW1pdCgncHJlc3NlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRvdWNoc3RyaXAuZW1pdCgncmVsZWFzZWQnKTtcbiAgICAgICAgdG91Y2hzdHJpcC5lbWl0KCdwaXRjaGJlbmQnLCA4MTkyKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVG91Y2hTdHJpcDtcbiIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpLFxuICAgIGZvcmVhY2ggPSByZXF1aXJlKCdsb2Rhc2guZm9yZWFjaCcpO1xuXG5mdW5jdGlvbiBCUE0oaW5pdGlhbCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIGxldCBicG0gPSB0aGlzO1xuXG4gICAgdGhpcy5jdXJyZW50ID0gY2xpcChpbml0aWFsKSA/IGNsaXAoaW5pdGlhbCkgOiAxMjA7XG5cbiAgICB0aGlzLnJlcG9ydCA9IGZ1bmN0aW9uKCkgeyBicG0uZW1pdCgnY2hhbmdlZCcsIGJwbSkgfVxuICAgIHRoaXMuY2hhbmdlX2J5ID0gZnVuY3Rpb24oYW1vdW50KSB7XG4gICAgICAgIGJwbS5jdXJyZW50ID0gY2xpcChicG0uY3VycmVudCArIGFtb3VudCk7XG4gICAgICAgIGJwbS5yZXBvcnQoKTtcbiAgICB9XG59XG51dGlsLmluaGVyaXRzKEJQTSwgRXZlbnRFbWl0dGVyKTtcblxuZnVuY3Rpb24gY2xpcChicG0pIHtcbiAgICByZXR1cm4gYnBtIDwgMjAgPyAyMCA6IChicG0gPiAzMDAgPyAzMDAgOiBicG0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEJQTTsiLCIndXNlIHN0cmljdCdcblxuY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKTtcblxuZnVuY3Rpb24gSW50ZXJ2YWwoYnBtLCBtdWx0aXBsaWVyLCB2YWx1ZSkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIGxldCBpbnRlcnZhbCA9IHRoaXM7XG5cbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy5yZXBvcnQgPSBmdW5jdGlvbigpIHsgaW50ZXJ2YWwuZW1pdCgnY2hhbmdlZCcsICg2MCAvIGJwbS5jdXJyZW50KSAqIG11bHRpcGxpZXIgKiAxMDAwKTsgfTtcblxuICAgIGJwbS5vbignY2hhbmdlZCcsIGludGVydmFsLnJlcG9ydCk7XG59XG51dGlsLmluaGVyaXRzKEludGVydmFsLCBFdmVudEVtaXR0ZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAnNG4nOiBmdW5jdGlvbihicG0sIG5hbWUpIHsgcmV0dXJuIG5ldyBJbnRlcnZhbChicG0sIDEsIG5hbWUgPyBuYW1lIDogJzRuJykgfSxcbiAgICAnNG50JzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAyIC8gMywgbmFtZSA/IG5hbWUgOiAnNG50JykgfSxcbiAgICAnOG4nOiBmdW5jdGlvbihicG0sIG5hbWUpIHsgcmV0dXJuIG5ldyBJbnRlcnZhbChicG0sIDAuNSwgbmFtZSA/IG5hbWUgOiAnOG4nKSB9LFxuICAgICc4bnQnOiBmdW5jdGlvbihicG0sIG5hbWUpIHsgcmV0dXJuIG5ldyBJbnRlcnZhbChicG0sIDEgLyAzLCBuYW1lID8gbmFtZSA6ICc4bnQnKSB9LFxuICAgICcxNm4nOiBmdW5jdGlvbihicG0sIG5hbWUpIHsgcmV0dXJuIG5ldyBJbnRlcnZhbChicG0sIDAuMjUsIG5hbWUgPyBuYW1lIDogJzE2bicpIH0sXG4gICAgJzE2bnQnOiBmdW5jdGlvbihicG0sIG5hbWUpIHsgcmV0dXJuIG5ldyBJbnRlcnZhbChicG0sIDEgLyA2LCBuYW1lID8gbmFtZSA6ICcxNm50JykgfSxcbiAgICAnMzJuJzogZnVuY3Rpb24oYnBtLCBuYW1lKSB7IHJldHVybiBuZXcgSW50ZXJ2YWwoYnBtLCAwLjEyNSwgbmFtZSA/IG5hbWUgOiAnMzJuJykgfSxcbiAgICAnMzJudCc6IGZ1bmN0aW9uKGJwbSwgbmFtZSkgeyByZXR1cm4gbmV3IEludGVydmFsKGJwbSwgMSAvIDEyLCBuYW1lID8gbmFtZSA6ICczMm50JykgfSxcbn07IiwiY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdXRpbCA9IHJlcXVpcmUoJ3V0aWwnKSxcbiAgICBmb3JlYWNoID0gcmVxdWlyZSgnbG9kYXNoLmZvcmVhY2gnKTtcblxuZnVuY3Rpb24gUGxheWVyKGFzc2V0X3VybCwgYXVkaW9fY29udGV4dCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIGxldCBwbGF5ZXIgPSB0aGlzO1xuXG4gICAgdGhpcy5wbGF5ID0gZnVuY3Rpb24odmVsb2NpdHksIGN1dG9mZl9mcmVxdWVuY3kpIHtcbiAgICAgICAgcGxheShwbGF5ZXIsIGF1ZGlvX2NvbnRleHQsIHZlbG9jaXR5LCBjdXRvZmZfZnJlcXVlbmN5KTtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZV9wbGF5YmFja19yYXRlID0gZnVuY3Rpb24ocmF0ZSkge1xuICAgICAgICB1cGRhdGVfcGxheWJhY2tfcmF0ZShwbGF5ZXIsIGF1ZGlvX2NvbnRleHQsIHJhdGUpO1xuICAgIH1cblxuICAgIHRoaXMuX2xvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3ZvaWNlcyA9IFtdO1xuICAgIHRoaXMuX3BsYXliYWNrX3JhdGUgPSAxO1xuICAgIGxvYWRTYW1wbGUoYXNzZXRfdXJsLCBhdWRpb19jb250ZXh0LCAoYnVmZmVyKSA9PiB7XG4gICAgICAgIHRoaXMuX2J1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgICAgdGhpcy5fbG9hZGVkID0gdHJ1ZTtcbiAgICB9KTtcbn1cbnV0aWwuaW5oZXJpdHMoUGxheWVyLCBFdmVudEVtaXR0ZXIpO1xuXG5mdW5jdGlvbiBsb2FkU2FtcGxlKGFzc2V0X3VybCwgYXVkaW9fY29udGV4dCwgZG9uZSkge1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBhc3NldF91cmwsIHRydWUpO1xuICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYXVkaW9fY29udGV4dC5kZWNvZGVBdWRpb0RhdGEocmVxdWVzdC5yZXNwb25zZSwgZG9uZSk7XG4gICAgfVxuICAgIHJlcXVlc3Quc2VuZCgpO1xufVxuXG5mdW5jdGlvbiBwbGF5KHBsYXllciwgYXVkaW9fY29udGV4dCwgdmVsb2NpdHksIGN1dG9mZl9mcmVxdWVuY3kpIHtcbiAgICBpZiAoIXBsYXllci5fbG9hZGVkKSByZXR1cm47XG5cbiAgICB2YXIgbm93ID0gdGltZV9ub3coYXVkaW9fY29udGV4dCk7XG5cbiAgICBpZiAoaXNfcGxheWluZyhwbGF5ZXIpKSB7XG4gICAgICAgIGZvcmVhY2gocGxheWVyLl92b2ljZXMsICh2b2ljZSkgPT4ge1xuICAgICAgICAgICAgdm9pY2UuZ2Fpbi5jYW5jZWxTY2hlZHVsZWRWYWx1ZXMobm93KTtcbiAgICAgICAgICAgIGFuY2hvcih2b2ljZS5nYWluLCBub3cpO1xuICAgICAgICAgICAgdm9pY2UuZ2Fpbi5saW5lYXJSYW1wVG9WYWx1ZUF0VGltZSgwLCBub3cgKyAwLjAxKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHBsYXllci5lbWl0KCdzdG9wcGVkJyk7XG4gICAgfVxuXG4gICAgdmFyIGdhaW5fbm9kZSA9IGF1ZGlvX2NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgIHZhciBmaWx0ZXJfbm9kZSA9IGF1ZGlvX2NvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7ICAgICAgIFxuICAgIGZpbHRlcl9ub2RlLmZyZXF1ZW5jeS52YWx1ZSA9IGN1dG9mZl9mcmVxdWVuY3kgPiAzMCA/IGN1dG9mZl9mcmVxdWVuY3kgOiAzMDtcbiAgICB2YXIgc291cmNlID0gYXVkaW9fY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICBcbiAgICBzb3VyY2UuY29ubmVjdChmaWx0ZXJfbm9kZSk7XG4gICAgZmlsdGVyX25vZGUuY29ubmVjdChnYWluX25vZGUpO1xuXG4gICAgZ2Fpbl9ub2RlLmNvbm5lY3QoYXVkaW9fY29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICBnYWluX25vZGUuZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLCBub3cpO1xuICAgIGdhaW5fbm9kZS5nYWluLmxpbmVhclJhbXBUb1ZhbHVlQXRUaW1lKHZlbG9jaXR5IC8gMTI3LCBub3cgKyAwLjAxKTtcblxuICAgIHNvdXJjZS5wbGF5YmFja1JhdGUuc2V0VmFsdWVBdFRpbWUocGxheWVyLl9wbGF5YmFja19yYXRlLCBub3cpO1xuICAgIHNvdXJjZS5idWZmZXIgPSBwbGF5ZXIuX2J1ZmZlcjtcblxuICAgIHNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsICgpID0+IHtcbiAgICAgICAgcGxheWVyLl92b2ljZXMuc2hpZnQoKTtcbiAgICAgICAgaWYgKCFpc19wbGF5aW5nKHBsYXllcikpIHBsYXllci5lbWl0KCdzdG9wcGVkJyk7XG4gICAgfSk7XG5cbiAgICBwbGF5ZXIuX3ZvaWNlcy5wdXNoKHtzb3VyY2U6IHNvdXJjZSwgZ2FpbjogZ2Fpbl9ub2RlLmdhaW59KTtcbiAgICBzb3VyY2Uuc3RhcnQoKTtcbiAgICBwbGF5ZXIuZW1pdCgnc3RhcnRlZCcsIHZlbG9jaXR5KTtcbn1cblxuZnVuY3Rpb24gYW5jaG9yKGF1ZGlvX3BhcmFtLCBub3cpIHtcbiAgICBhdWRpb19wYXJhbS5zZXRWYWx1ZUF0VGltZShhdWRpb19wYXJhbS52YWx1ZSwgbm93KTtcbn1cblxuZnVuY3Rpb24gaXNfcGxheWluZyhwbGF5ZXIpIHtcbiAgICByZXR1cm4gcGxheWVyLl92b2ljZXMubGVuZ3RoID4gMDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlX3BsYXliYWNrX3JhdGUocGxheWVyLCBhdWRpb19jb250ZXh0LCByYXRlKSB7XG4gICAgcGxheWVyLl9wbGF5YmFja19yYXRlID0gcmF0ZTtcbiAgICB2YXIgbm93ID0gdGltZV9ub3coYXVkaW9fY29udGV4dCk7XG4gICAgZm9yZWFjaChwbGF5ZXIuX3ZvaWNlcywgKHZvaWNlKSA9PiB7XG4gICAgICAgIHZvaWNlLnNvdXJjZS5wbGF5YmFja1JhdGUuc2V0VmFsdWVBdFRpbWUocGxheWVyLl9wbGF5YmFja19yYXRlLCBub3cpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiB0aW1lX25vdyhhdWRpb19jb250ZXh0KSB7XG4gICAgcmV0dXJuIGF1ZGlvX2NvbnRleHQuY3VycmVudFRpbWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGxheWVyOyIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xuLypcblJlcGVhdGVkbHkgY2FsbHMgdGhlIHBhc3NlZCBjYWxsYmFjayBhdCB0aGUgc3BlY2lmaWVkIGludGVydmFsIHVudGlsIHRvbGQgdG8gc3RvcFxuKi9cbmZ1bmN0aW9uIFJlcGVhdGVyKHNjaGVkdWxlZF9leGVjdXRpb24sIGluaXRpYWxfaW50ZXJ2YWwpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICB2YXIgcmVwZWF0ZXIgPSB0aGlzO1xuICAgIHRoaXMuX2lzX3NjaGVkdWxpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9pbnRlcnZhbCA9IGluaXRpYWxfaW50ZXJ2YWwgPiAyMCA/IGluaXRpYWxfaW50ZXJ2YWwgOiA1MDA7IC8vIG1zXG5cbiAgICB0aGlzLmludGVydmFsID0gZnVuY3Rpb24gKGFtb3VudF9tcykge1xuICAgICAgICByZXBlYXRlci5faW50ZXJ2YWwgPSBhbW91bnRfbXMgPiAyMCA/IGFtb3VudF9tcyA6IDIwOyAvLyAyMG1zIG1pbiBpbnRlcnZhbFxuICAgICAgICByZXBlYXRlci5yZXBvcnRfaW50ZXJ2YWwoKTtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXJ0ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHJlcGVhdGVyLl9pc19zY2hlZHVsaW5nKSByZXR1cm47XG4gICAgICAgIHJlcGVhdGVyLl9pc19zY2hlZHVsaW5nID0gdHJ1ZTtcbiAgICAgICAgcmVwZWF0ZXIuX2NhbGxfYW5kX3Jlc2NoZWR1bGUoY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHRoaXMuX2NhbGxfYW5kX3Jlc2NoZWR1bGUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICBpZiAocmVwZWF0ZXIuX2lzX3NjaGVkdWxpbmcpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICBzY2hlZHVsZWRfZXhlY3V0aW9uKCgpID0+IHJlcGVhdGVyLl9jYWxsX2FuZF9yZXNjaGVkdWxlKGNhbGxiYWNrKSwgcmVwZWF0ZXIuX2ludGVydmFsKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVwZWF0ZXIuX2lzX3NjaGVkdWxpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB0aGlzLnJlcG9ydF9pbnRlcnZhbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXBlYXRlci5lbWl0KCdpbnRlcnZhbCcsIHJlcGVhdGVyLl9pbnRlcnZhbCk7XG4gICAgfVxufVxudXRpbC5pbmhlcml0cyhSZXBlYXRlciwgRXZlbnRFbWl0dGVyKTtcblxuLy8gQWRhcHRvciBmdW5jdGlvbiB1c2VkIHRvIGJpbmQgdG8gd2ViIEF1ZGlvIEFQSSBhbmQgdXRpbGlzZSBpdHMgYXVkaW8tcmF0ZSBzY2hlZHVsaW5nXG5SZXBlYXRlci5jcmVhdGVfc2NoZWR1bGVkX2J5X2F1ZGlvX2NvbnRleHQgPSBmdW5jdGlvbihjb250ZXh0LCBpbml0aWFsX2ludGVydmFsKSB7XG4gICAgcmV0dXJuIG5ldyBSZXBlYXRlcigoY2FsbGJhY2ssIGludGVydmFsX21zKSA9PiB7XG4gICAgICAgIGxldCBzb3VyY2UgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpLFxuICAgICAgICAgICAgbm93ID0gY29udGV4dC5jdXJyZW50VGltZSxcbiAgICAgICAgICAgIHRob3VzYW5kdGggPSBjb250ZXh0LnNhbXBsZVJhdGUgLyAxMDAwLFxuICAgICAgICAgICAgc2NoZWR1bGVkX2F0ID0gbm93ICsgKGludGVydmFsX21zIC8gMTAwMCk7XG4gICAgICAgIC8vIGEgYnVmZmVyIGxlbmd0aCBvZiAxIHNhbXBsZSBkb2Vzbid0IHdvcmsgb24gSU9TLCBzbyB1c2UgMS8xMDAwdGggb2YgYSBzZWNvbmRcbiAgICAgICAgbGV0IGJ1ZmZlciA9IGNvbnRleHQuY3JlYXRlQnVmZmVyKDEsIHRob3VzYW5kdGgsIGNvbnRleHQuc2FtcGxlUmF0ZSk7XG4gICAgICAgIHNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsIGNhbGxiYWNrKTtcbiAgICAgICAgc291cmNlLmJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgICAgc291cmNlLmNvbm5lY3QoY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgIHNvdXJjZS5zdGFydChzY2hlZHVsZWRfYXQpO1xuICAgIH0sIGluaXRpYWxfaW50ZXJ2YWwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcGVhdGVyOyIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB1dGlsID0gcmVxdWlyZSgndXRpbCcpLFxuICAgIFJlcGVhdGVyID0gcmVxdWlyZSgnLi9yZXBlYXRlci5qcycpO1xuXG5mdW5jdGlvbiBSZXBldGFlKHJlcGVhdGVyLCBpbml0aWFsX2ludGVydmFsKSB7XG4gICAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG4gICAgdmFyIHJlcGV0YWUgPSB0aGlzO1xuICAgIHRoaXMuX2FjdGl2ZSA9IGZhbHNlO1xuICAgIHRoaXMuX3RpbWVfY2hhbmdlZCA9IGZhbHNlO1xuICAgIHRoaXMuX2JlaW5nX3ByZXNzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9jdXJyZW50X2ludGVydmFsID0gaW5pdGlhbF9pbnRlcnZhbDtcblxuICAgIHJlcGV0YWUuX2N1cnJlbnRfaW50ZXJ2YWwub24oJ2NoYW5nZWQnLCByZXBlYXRlci5pbnRlcnZhbCk7XG4gICAgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbC5yZXBvcnQoKTtcblxuICAgIHRoaXMucHJlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVwZXRhZS5fYmVpbmdfcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy5yZWxlYXNlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGFydGVkX2FjdGl2ZSA9IHJlcGV0YWUuX2FjdGl2ZSxcbiAgICAgICAgICAgIHRpbWVfY2hhbmdlZCA9IHJlcGV0YWUuX3RpbWVfY2hhbmdlZDtcblxuICAgICAgICByZXBldGFlLl90aW1lX2NoYW5nZWQgPSBmYWxzZTtcbiAgICAgICAgcmVwZXRhZS5fYmVpbmdfcHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIHN3aXRjaCAodHJ1ZSkge1xuICAgICAgICAgICAgY2FzZSAoIXN0YXJ0ZWRfYWN0aXZlKTpcbiAgICAgICAgICAgICAgICByZXBldGFlLl9hY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJlcGV0YWUuZW1pdCgnb24nKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgKHN0YXJ0ZWRfYWN0aXZlICYmICF0aW1lX2NoYW5nZWQpOlxuICAgICAgICAgICAgICAgIHJlcGV0YWUuX2FjdGl2ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHJlcGV0YWUuZW1pdCgnb2ZmJyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmludGVydmFsID0gZnVuY3Rpb24obmV3X2ludGVydmFsKSB7XG4gICAgICAgIGlmIChyZXBldGFlLl9iZWluZ19wcmVzc2VkKSB7XG4gICAgICAgICAgICByZXBldGFlLl90aW1lX2NoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgcmVwZXRhZS5fY3VycmVudF9pbnRlcnZhbC5yZW1vdmVMaXN0ZW5lcignY2hhbmdlZCcsIHJlcGVhdGVyLmludGVydmFsKTtcbiAgICAgICAgICAgIHJlcGV0YWUuX2N1cnJlbnRfaW50ZXJ2YWwgPSBuZXdfaW50ZXJ2YWw7XG4gICAgICAgICAgICByZXBldGFlLl9jdXJyZW50X2ludGVydmFsLm9uKCdjaGFuZ2VkJywgcmVwZWF0ZXIuaW50ZXJ2YWwpO1xuICAgICAgICAgICAgcmVwZXRhZS5yZXBvcnRfaW50ZXJ2YWwoKTtcbiAgICAgICAgICAgIHJlcGV0YWUuX2N1cnJlbnRfaW50ZXJ2YWwucmVwb3J0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnN0YXJ0ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFyZXBldGFlLl9hY3RpdmUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmVwZWF0ZXIuc3RhcnQoY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcCA9IHJlcGVhdGVyLnN0b3A7XG4gICAgdGhpcy5yZXBvcnRfaW50ZXJ2YWwgPSBmdW5jdGlvbigpIHsgcmVwZXRhZS5lbWl0KCdpbnRlcnZhbCcsIHJlcGV0YWUuX2N1cnJlbnRfaW50ZXJ2YWwudmFsdWUpICB9O1xufVxudXRpbC5pbmhlcml0cyhSZXBldGFlLCBFdmVudEVtaXR0ZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcGV0YWU7IiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEF0IGxlYXN0IGdpdmUgc29tZSBraW5kIG9mIGNvbnRleHQgdG8gdGhlIHVzZXJcbiAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcgKyBlciArICcpJyk7XG4gICAgICAgIGVyci5jb250ZXh0ID0gZXI7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vIGltcGxlbWVudGF0aW9uIGZyb20gc3RhbmRhcmQgbm9kZS5qcyAndXRpbCcgbW9kdWxlXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgdmFyIFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge31cbiAgICBUZW1wQ3Rvci5wcm90b3R5cGUgPSBzdXBlckN0b3IucHJvdG90eXBlXG4gICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgIGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3RvclxuICB9XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG4oZnVuY3Rpb24gKCkge1xuICB0cnkge1xuICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICB9IGNhdGNoIChlKSB7XG4gICAgY2FjaGVkU2V0VGltZW91dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBpcyBub3QgZGVmaW5lZCcpO1xuICAgIH1cbiAgfVxuICB0cnkge1xuICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGlzIG5vdCBkZWZpbmVkJyk7XG4gICAgfVxuICB9XG59ICgpKVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gY2FjaGVkU2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2FjaGVkQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNCdWZmZXIoYXJnKSB7XG4gIHJldHVybiBhcmcgJiYgdHlwZW9mIGFyZyA9PT0gJ29iamVjdCdcbiAgICAmJiB0eXBlb2YgYXJnLmNvcHkgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLmZpbGwgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLnJlYWRVSW50OCA9PT0gJ2Z1bmN0aW9uJztcbn0iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxudmFyIGZvcm1hdFJlZ0V4cCA9IC8lW3NkaiVdL2c7XG5leHBvcnRzLmZvcm1hdCA9IGZ1bmN0aW9uKGYpIHtcbiAgaWYgKCFpc1N0cmluZyhmKSkge1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIG9iamVjdHMucHVzaChpbnNwZWN0KGFyZ3VtZW50c1tpXSkpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0cy5qb2luKCcgJyk7XG4gIH1cblxuICB2YXIgaSA9IDE7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgbGVuID0gYXJncy5sZW5ndGg7XG4gIHZhciBzdHIgPSBTdHJpbmcoZikucmVwbGFjZShmb3JtYXRSZWdFeHAsIGZ1bmN0aW9uKHgpIHtcbiAgICBpZiAoeCA9PT0gJyUlJykgcmV0dXJuICclJztcbiAgICBpZiAoaSA+PSBsZW4pIHJldHVybiB4O1xuICAgIHN3aXRjaCAoeCkge1xuICAgICAgY2FzZSAnJXMnOiByZXR1cm4gU3RyaW5nKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclZCc6IHJldHVybiBOdW1iZXIoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVqJzpcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYXJnc1tpKytdKTtcbiAgICAgICAgfSBjYXRjaCAoXykge1xuICAgICAgICAgIHJldHVybiAnW0NpcmN1bGFyXSc7XG4gICAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB4O1xuICAgIH1cbiAgfSk7XG4gIGZvciAodmFyIHggPSBhcmdzW2ldOyBpIDwgbGVuOyB4ID0gYXJnc1srK2ldKSB7XG4gICAgaWYgKGlzTnVsbCh4KSB8fCAhaXNPYmplY3QoeCkpIHtcbiAgICAgIHN0ciArPSAnICcgKyB4O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJyAnICsgaW5zcGVjdCh4KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn07XG5cblxuLy8gTWFyayB0aGF0IGEgbWV0aG9kIHNob3VsZCBub3QgYmUgdXNlZC5cbi8vIFJldHVybnMgYSBtb2RpZmllZCBmdW5jdGlvbiB3aGljaCB3YXJucyBvbmNlIGJ5IGRlZmF1bHQuXG4vLyBJZiAtLW5vLWRlcHJlY2F0aW9uIGlzIHNldCwgdGhlbiBpdCBpcyBhIG5vLW9wLlxuZXhwb3J0cy5kZXByZWNhdGUgPSBmdW5jdGlvbihmbiwgbXNnKSB7XG4gIC8vIEFsbG93IGZvciBkZXByZWNhdGluZyB0aGluZ3MgaW4gdGhlIHByb2Nlc3Mgb2Ygc3RhcnRpbmcgdXAuXG4gIGlmIChpc1VuZGVmaW5lZChnbG9iYWwucHJvY2VzcykpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZXhwb3J0cy5kZXByZWNhdGUoZm4sIG1zZykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgaWYgKHByb2Nlc3Mubm9EZXByZWNhdGlvbiA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHZhciB3YXJuZWQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gZGVwcmVjYXRlZCgpIHtcbiAgICBpZiAoIXdhcm5lZCkge1xuICAgICAgaWYgKHByb2Nlc3MudGhyb3dEZXByZWNhdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy50cmFjZURlcHJlY2F0aW9uKSB7XG4gICAgICAgIGNvbnNvbGUudHJhY2UobXNnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICAgIHdhcm5lZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIGRlcHJlY2F0ZWQ7XG59O1xuXG5cbnZhciBkZWJ1Z3MgPSB7fTtcbnZhciBkZWJ1Z0Vudmlyb247XG5leHBvcnRzLmRlYnVnbG9nID0gZnVuY3Rpb24oc2V0KSB7XG4gIGlmIChpc1VuZGVmaW5lZChkZWJ1Z0Vudmlyb24pKVxuICAgIGRlYnVnRW52aXJvbiA9IHByb2Nlc3MuZW52Lk5PREVfREVCVUcgfHwgJyc7XG4gIHNldCA9IHNldC50b1VwcGVyQ2FzZSgpO1xuICBpZiAoIWRlYnVnc1tzZXRdKSB7XG4gICAgaWYgKG5ldyBSZWdFeHAoJ1xcXFxiJyArIHNldCArICdcXFxcYicsICdpJykudGVzdChkZWJ1Z0Vudmlyb24pKSB7XG4gICAgICB2YXIgcGlkID0gcHJvY2Vzcy5waWQ7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbXNnID0gZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignJXMgJWQ6ICVzJywgc2V0LCBwaWQsIG1zZyk7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge307XG4gICAgfVxuICB9XG4gIHJldHVybiBkZWJ1Z3Nbc2V0XTtcbn07XG5cblxuLyoqXG4gKiBFY2hvcyB0aGUgdmFsdWUgb2YgYSB2YWx1ZS4gVHJ5cyB0byBwcmludCB0aGUgdmFsdWUgb3V0XG4gKiBpbiB0aGUgYmVzdCB3YXkgcG9zc2libGUgZ2l2ZW4gdGhlIGRpZmZlcmVudCB0eXBlcy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3QgdG8gcHJpbnQgb3V0LlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHMgT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QgdGhhdCBhbHRlcnMgdGhlIG91dHB1dC5cbiAqL1xuLyogbGVnYWN5OiBvYmosIHNob3dIaWRkZW4sIGRlcHRoLCBjb2xvcnMqL1xuZnVuY3Rpb24gaW5zcGVjdChvYmosIG9wdHMpIHtcbiAgLy8gZGVmYXVsdCBvcHRpb25zXG4gIHZhciBjdHggPSB7XG4gICAgc2VlbjogW10sXG4gICAgc3R5bGl6ZTogc3R5bGl6ZU5vQ29sb3JcbiAgfTtcbiAgLy8gbGVnYWN5Li4uXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDMpIGN0eC5kZXB0aCA9IGFyZ3VtZW50c1syXTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gNCkgY3R4LmNvbG9ycyA9IGFyZ3VtZW50c1szXTtcbiAgaWYgKGlzQm9vbGVhbihvcHRzKSkge1xuICAgIC8vIGxlZ2FjeS4uLlxuICAgIGN0eC5zaG93SGlkZGVuID0gb3B0cztcbiAgfSBlbHNlIGlmIChvcHRzKSB7XG4gICAgLy8gZ290IGFuIFwib3B0aW9uc1wiIG9iamVjdFxuICAgIGV4cG9ydHMuX2V4dGVuZChjdHgsIG9wdHMpO1xuICB9XG4gIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5zaG93SGlkZGVuKSkgY3R4LnNob3dIaWRkZW4gPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5kZXB0aCkpIGN0eC5kZXB0aCA9IDI7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY29sb3JzKSkgY3R4LmNvbG9ycyA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmN1c3RvbUluc3BlY3QpKSBjdHguY3VzdG9tSW5zcGVjdCA9IHRydWU7XG4gIGlmIChjdHguY29sb3JzKSBjdHguc3R5bGl6ZSA9IHN0eWxpemVXaXRoQ29sb3I7XG4gIHJldHVybiBmb3JtYXRWYWx1ZShjdHgsIG9iaiwgY3R4LmRlcHRoKTtcbn1cbmV4cG9ydHMuaW5zcGVjdCA9IGluc3BlY3Q7XG5cblxuLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BTlNJX2VzY2FwZV9jb2RlI2dyYXBoaWNzXG5pbnNwZWN0LmNvbG9ycyA9IHtcbiAgJ2JvbGQnIDogWzEsIDIyXSxcbiAgJ2l0YWxpYycgOiBbMywgMjNdLFxuICAndW5kZXJsaW5lJyA6IFs0LCAyNF0sXG4gICdpbnZlcnNlJyA6IFs3LCAyN10sXG4gICd3aGl0ZScgOiBbMzcsIDM5XSxcbiAgJ2dyZXknIDogWzkwLCAzOV0sXG4gICdibGFjaycgOiBbMzAsIDM5XSxcbiAgJ2JsdWUnIDogWzM0LCAzOV0sXG4gICdjeWFuJyA6IFszNiwgMzldLFxuICAnZ3JlZW4nIDogWzMyLCAzOV0sXG4gICdtYWdlbnRhJyA6IFszNSwgMzldLFxuICAncmVkJyA6IFszMSwgMzldLFxuICAneWVsbG93JyA6IFszMywgMzldXG59O1xuXG4vLyBEb24ndCB1c2UgJ2JsdWUnIG5vdCB2aXNpYmxlIG9uIGNtZC5leGVcbmluc3BlY3Quc3R5bGVzID0ge1xuICAnc3BlY2lhbCc6ICdjeWFuJyxcbiAgJ251bWJlcic6ICd5ZWxsb3cnLFxuICAnYm9vbGVhbic6ICd5ZWxsb3cnLFxuICAndW5kZWZpbmVkJzogJ2dyZXknLFxuICAnbnVsbCc6ICdib2xkJyxcbiAgJ3N0cmluZyc6ICdncmVlbicsXG4gICdkYXRlJzogJ21hZ2VudGEnLFxuICAvLyBcIm5hbWVcIjogaW50ZW50aW9uYWxseSBub3Qgc3R5bGluZ1xuICAncmVnZXhwJzogJ3JlZCdcbn07XG5cblxuZnVuY3Rpb24gc3R5bGl6ZVdpdGhDb2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICB2YXIgc3R5bGUgPSBpbnNwZWN0LnN0eWxlc1tzdHlsZVR5cGVdO1xuXG4gIGlmIChzdHlsZSkge1xuICAgIHJldHVybiAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzBdICsgJ20nICsgc3RyICtcbiAgICAgICAgICAgJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVsxXSArICdtJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyO1xuICB9XG59XG5cblxuZnVuY3Rpb24gc3R5bGl6ZU5vQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgcmV0dXJuIHN0cjtcbn1cblxuXG5mdW5jdGlvbiBhcnJheVRvSGFzaChhcnJheSkge1xuICB2YXIgaGFzaCA9IHt9O1xuXG4gIGFycmF5LmZvckVhY2goZnVuY3Rpb24odmFsLCBpZHgpIHtcbiAgICBoYXNoW3ZhbF0gPSB0cnVlO1xuICB9KTtcblxuICByZXR1cm4gaGFzaDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMpIHtcbiAgLy8gUHJvdmlkZSBhIGhvb2sgZm9yIHVzZXItc3BlY2lmaWVkIGluc3BlY3QgZnVuY3Rpb25zLlxuICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgaWYgKGN0eC5jdXN0b21JbnNwZWN0ICYmXG4gICAgICB2YWx1ZSAmJlxuICAgICAgaXNGdW5jdGlvbih2YWx1ZS5pbnNwZWN0KSAmJlxuICAgICAgLy8gRmlsdGVyIG91dCB0aGUgdXRpbCBtb2R1bGUsIGl0J3MgaW5zcGVjdCBmdW5jdGlvbiBpcyBzcGVjaWFsXG4gICAgICB2YWx1ZS5pbnNwZWN0ICE9PSBleHBvcnRzLmluc3BlY3QgJiZcbiAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgIHZhciByZXQgPSB2YWx1ZS5pbnNwZWN0KHJlY3Vyc2VUaW1lcywgY3R4KTtcbiAgICBpZiAoIWlzU3RyaW5nKHJldCkpIHtcbiAgICAgIHJldCA9IGZvcm1hdFZhbHVlKGN0eCwgcmV0LCByZWN1cnNlVGltZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLy8gUHJpbWl0aXZlIHR5cGVzIGNhbm5vdCBoYXZlIHByb3BlcnRpZXNcbiAgdmFyIHByaW1pdGl2ZSA9IGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKTtcbiAgaWYgKHByaW1pdGl2ZSkge1xuICAgIHJldHVybiBwcmltaXRpdmU7XG4gIH1cblxuICAvLyBMb29rIHVwIHRoZSBrZXlzIG9mIHRoZSBvYmplY3QuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICB2YXIgdmlzaWJsZUtleXMgPSBhcnJheVRvSGFzaChrZXlzKTtcblxuICBpZiAoY3R4LnNob3dIaWRkZW4pIHtcbiAgICBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpO1xuICB9XG5cbiAgLy8gSUUgZG9lc24ndCBtYWtlIGVycm9yIGZpZWxkcyBub24tZW51bWVyYWJsZVxuICAvLyBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvaWUvZHd3NTJzYnQodj12cy45NCkuYXNweFxuICBpZiAoaXNFcnJvcih2YWx1ZSlcbiAgICAgICYmIChrZXlzLmluZGV4T2YoJ21lc3NhZ2UnKSA+PSAwIHx8IGtleXMuaW5kZXhPZignZGVzY3JpcHRpb24nKSA+PSAwKSkge1xuICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICAvLyBTb21lIHR5cGUgb2Ygb2JqZWN0IHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgdmFyIG5hbWUgPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfVxuICAgIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoRGF0ZS5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdkYXRlJyk7XG4gICAgfVxuICAgIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgYmFzZSA9ICcnLCBhcnJheSA9IGZhbHNlLCBicmFjZXMgPSBbJ3snLCAnfSddO1xuXG4gIC8vIE1ha2UgQXJyYXkgc2F5IHRoYXQgdGhleSBhcmUgQXJyYXlcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgYXJyYXkgPSB0cnVlO1xuICAgIGJyYWNlcyA9IFsnWycsICddJ107XG4gIH1cblxuICAvLyBNYWtlIGZ1bmN0aW9ucyBzYXkgdGhhdCB0aGV5IGFyZSBmdW5jdGlvbnNcbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgdmFyIG4gPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICBiYXNlID0gJyBbRnVuY3Rpb24nICsgbiArICddJztcbiAgfVxuXG4gIC8vIE1ha2UgUmVnRXhwcyBzYXkgdGhhdCB0aGV5IGFyZSBSZWdFeHBzXG4gIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZGF0ZXMgd2l0aCBwcm9wZXJ0aWVzIGZpcnN0IHNheSB0aGUgZGF0ZVxuICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBEYXRlLnByb3RvdHlwZS50b1VUQ1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZXJyb3Igd2l0aCBtZXNzYWdlIGZpcnN0IHNheSB0aGUgZXJyb3JcbiAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCAmJiAoIWFycmF5IHx8IHZhbHVlLmxlbmd0aCA9PSAwKSkge1xuICAgIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgYnJhY2VzWzFdO1xuICB9XG5cbiAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tPYmplY3RdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cblxuICBjdHguc2Vlbi5wdXNoKHZhbHVlKTtcblxuICB2YXIgb3V0cHV0O1xuICBpZiAoYXJyYXkpIHtcbiAgICBvdXRwdXQgPSBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KTtcbiAgICB9KTtcbiAgfVxuXG4gIGN0eC5zZWVuLnBvcCgpO1xuXG4gIHJldHVybiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ3VuZGVmaW5lZCcsICd1bmRlZmluZWQnKTtcbiAgaWYgKGlzU3RyaW5nKHZhbHVlKSkge1xuICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKSArICdcXCcnO1xuICAgIHJldHVybiBjdHguc3R5bGl6ZShzaW1wbGUsICdzdHJpbmcnKTtcbiAgfVxuICBpZiAoaXNOdW1iZXIodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG4gIGlmIChpc0Jvb2xlYW4odmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnYm9vbGVhbicpO1xuICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gIGlmIChpc051bGwodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0RXJyb3IodmFsdWUpIHtcbiAgcmV0dXJuICdbJyArIEVycm9yLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSArICddJztcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICBpZiAoaGFzT3duUHJvcGVydHkodmFsdWUsIFN0cmluZyhpKSkpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAgU3RyaW5nKGkpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKCcnKTtcbiAgICB9XG4gIH1cbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICgha2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBrZXksIHRydWUpKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpIHtcbiAgdmFyIG5hbWUsIHN0ciwgZGVzYztcbiAgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodmFsdWUsIGtleSkgfHwgeyB2YWx1ZTogdmFsdWVba2V5XSB9O1xuICBpZiAoZGVzYy5nZXQpIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyL1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmICghaGFzT3duUHJvcGVydHkodmlzaWJsZUtleXMsIGtleSkpIHtcbiAgICBuYW1lID0gJ1snICsga2V5ICsgJ10nO1xuICB9XG4gIGlmICghc3RyKSB7XG4gICAgaWYgKGN0eC5zZWVuLmluZGV4T2YoZGVzYy52YWx1ZSkgPCAwKSB7XG4gICAgICBpZiAoaXNOdWxsKHJlY3Vyc2VUaW1lcykpIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICB9XG4gICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgaWYgKGFycmF5KSB7XG4gICAgICAgICAgc3RyID0gc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpLnN1YnN0cigyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHIgPSAnXFxuJyArIHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoaXNVbmRlZmluZWQobmFtZSkpIHtcbiAgICBpZiAoYXJyYXkgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgbmFtZSA9IEpTT04uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICBpZiAobmFtZS5tYXRjaCgvXlwiKFthLXpBLVpfXVthLXpBLVpfMC05XSopXCIkLykpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICduYW1lJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlwifFwiJCkvZywgXCInXCIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICdzdHJpbmcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZSArICc6ICcgKyBzdHI7XG59XG5cblxuZnVuY3Rpb24gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpIHtcbiAgdmFyIG51bUxpbmVzRXN0ID0gMDtcbiAgdmFyIGxlbmd0aCA9IG91dHB1dC5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyKSB7XG4gICAgbnVtTGluZXNFc3QrKztcbiAgICBpZiAoY3VyLmluZGV4T2YoJ1xcbicpID49IDApIG51bUxpbmVzRXN0Kys7XG4gICAgcmV0dXJuIHByZXYgKyBjdXIucmVwbGFjZSgvXFx1MDAxYlxcW1xcZFxcZD9tL2csICcnKS5sZW5ndGggKyAxO1xuICB9LCAwKTtcblxuICBpZiAobGVuZ3RoID4gNjApIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICtcbiAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIG91dHB1dC5qb2luKCcsXFxuICAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIGJyYWNlc1sxXTtcbiAgfVxuXG4gIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG59XG5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cbmZ1bmN0aW9uIGlzQXJyYXkoYXIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXIpO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gaXNPYmplY3QocmUpICYmIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5leHBvcnRzLmlzUmVnRXhwID0gaXNSZWdFeHA7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuXG5mdW5jdGlvbiBpc0RhdGUoZCkge1xuICByZXR1cm4gaXNPYmplY3QoZCkgJiYgb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cbmV4cG9ydHMuaXNEYXRlID0gaXNEYXRlO1xuXG5mdW5jdGlvbiBpc0Vycm9yKGUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGUpICYmXG4gICAgICAob2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXScgfHwgZSBpbnN0YW5jZW9mIEVycm9yKTtcbn1cbmV4cG9ydHMuaXNFcnJvciA9IGlzRXJyb3I7XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcblxuZnVuY3Rpb24gaXNQcmltaXRpdmUoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGwgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3ltYm9sJyB8fCAgLy8gRVM2IHN5bWJvbFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCc7XG59XG5leHBvcnRzLmlzUHJpbWl0aXZlID0gaXNQcmltaXRpdmU7XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSByZXF1aXJlKCcuL3N1cHBvcnQvaXNCdWZmZXInKTtcblxuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuXG5cbmZ1bmN0aW9uIHBhZChuKSB7XG4gIHJldHVybiBuIDwgMTAgPyAnMCcgKyBuLnRvU3RyaW5nKDEwKSA6IG4udG9TdHJpbmcoMTApO1xufVxuXG5cbnZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJyxcbiAgICAgICAgICAgICAgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbi8vIDI2IEZlYiAxNjoxOTozNFxuZnVuY3Rpb24gdGltZXN0YW1wKCkge1xuICB2YXIgZCA9IG5ldyBEYXRlKCk7XG4gIHZhciB0aW1lID0gW3BhZChkLmdldEhvdXJzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRNaW51dGVzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRTZWNvbmRzKCkpXS5qb2luKCc6Jyk7XG4gIHJldHVybiBbZC5nZXREYXRlKCksIG1vbnRoc1tkLmdldE1vbnRoKCldLCB0aW1lXS5qb2luKCcgJyk7XG59XG5cblxuLy8gbG9nIGlzIGp1c3QgYSB0aGluIHdyYXBwZXIgdG8gY29uc29sZS5sb2cgdGhhdCBwcmVwZW5kcyBhIHRpbWVzdGFtcFxuZXhwb3J0cy5sb2cgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJyVzIC0gJXMnLCB0aW1lc3RhbXAoKSwgZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKSk7XG59O1xuXG5cbi8qKlxuICogSW5oZXJpdCB0aGUgcHJvdG90eXBlIG1ldGhvZHMgZnJvbSBvbmUgY29uc3RydWN0b3IgaW50byBhbm90aGVyLlxuICpcbiAqIFRoZSBGdW5jdGlvbi5wcm90b3R5cGUuaW5oZXJpdHMgZnJvbSBsYW5nLmpzIHJld3JpdHRlbiBhcyBhIHN0YW5kYWxvbmVcbiAqIGZ1bmN0aW9uIChub3Qgb24gRnVuY3Rpb24ucHJvdG90eXBlKS4gTk9URTogSWYgdGhpcyBmaWxlIGlzIHRvIGJlIGxvYWRlZFxuICogZHVyaW5nIGJvb3RzdHJhcHBpbmcgdGhpcyBmdW5jdGlvbiBuZWVkcyB0byBiZSByZXdyaXR0ZW4gdXNpbmcgc29tZSBuYXRpdmVcbiAqIGZ1bmN0aW9ucyBhcyBwcm90b3R5cGUgc2V0dXAgdXNpbmcgbm9ybWFsIEphdmFTY3JpcHQgZG9lcyBub3Qgd29yayBhc1xuICogZXhwZWN0ZWQgZHVyaW5nIGJvb3RzdHJhcHBpbmcgKHNlZSBtaXJyb3IuanMgaW4gcjExNDkwMykuXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB3aGljaCBuZWVkcyB0byBpbmhlcml0IHRoZVxuICogICAgIHByb3RvdHlwZS5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IHN1cGVyQ3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB0byBpbmhlcml0IHByb3RvdHlwZSBmcm9tLlxuICovXG5leHBvcnRzLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuZXhwb3J0cy5fZXh0ZW5kID0gZnVuY3Rpb24ob3JpZ2luLCBhZGQpIHtcbiAgLy8gRG9uJ3QgZG8gYW55dGhpbmcgaWYgYWRkIGlzbid0IGFuIG9iamVjdFxuICBpZiAoIWFkZCB8fCAhaXNPYmplY3QoYWRkKSkgcmV0dXJuIG9yaWdpbjtcblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGFkZCk7XG4gIHZhciBpID0ga2V5cy5sZW5ndGg7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBvcmlnaW5ba2V5c1tpXV0gPSBhZGRba2V5c1tpXV07XG4gIH1cbiAgcmV0dXJuIG9yaWdpbjtcbn07XG5cbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG4iXX0=
