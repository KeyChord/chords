//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
//#endregion
//#region src/js/jetbrains.ts
var import_lib = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.outdent = void 0;
	function noop() {
		var args = [];
		for (var _i = 0; _i < arguments.length; _i++) args[_i] = arguments[_i];
	}
	function createWeakMap() {
		if (typeof WeakMap !== "undefined") return /* @__PURE__ */ new WeakMap();
		else return fakeSetOrMap();
	}
	/**
	* Creates and returns a no-op implementation of a WeakMap / WeakSet that never stores anything.
	*/
	function fakeSetOrMap() {
		return {
			add: noop,
			delete: noop,
			get: noop,
			set: noop,
			has: function(k) {
				return false;
			}
		};
	}
	var hop = Object.prototype.hasOwnProperty;
	var has = function(obj, prop) {
		return hop.call(obj, prop);
	};
	function extend(target, source) {
		for (var prop in source) if (has(source, prop)) target[prop] = source[prop];
		return target;
	}
	var reLeadingNewline = /^[ \t]*(?:\r\n|\r|\n)/;
	var reTrailingNewline = /(?:\r\n|\r|\n)[ \t]*$/;
	var reStartsWithNewlineOrIsEmpty = /^(?:[\r\n]|$)/;
	var reDetectIndentation = /(?:\r\n|\r|\n)([ \t]*)(?:[^ \t\r\n]|$)/;
	var reOnlyWhitespaceWithAtLeastOneNewline = /^[ \t]*[\r\n][ \t\r\n]*$/;
	function _outdentArray(strings, firstInterpolatedValueSetsIndentationLevel, options) {
		var indentationLevel = 0;
		var match = strings[0].match(reDetectIndentation);
		if (match) indentationLevel = match[1].length;
		var reSource = "(\\r\\n|\\r|\\n).{0," + indentationLevel + "}";
		var reMatchIndent = new RegExp(reSource, "g");
		if (firstInterpolatedValueSetsIndentationLevel) strings = strings.slice(1);
		var newline = options.newline, trimLeadingNewline = options.trimLeadingNewline, trimTrailingNewline = options.trimTrailingNewline;
		var normalizeNewlines = typeof newline === "string";
		var l = strings.length;
		return strings.map(function(v, i) {
			v = v.replace(reMatchIndent, "$1");
			if (i === 0 && trimLeadingNewline) v = v.replace(reLeadingNewline, "");
			if (i === l - 1 && trimTrailingNewline) v = v.replace(reTrailingNewline, "");
			if (normalizeNewlines) v = v.replace(/\r\n|\n|\r/g, function(_) {
				return newline;
			});
			return v;
		});
	}
	function concatStringsAndValues(strings, values) {
		var ret = "";
		for (var i = 0, l = strings.length; i < l; i++) {
			ret += strings[i];
			if (i < l - 1) ret += values[i];
		}
		return ret;
	}
	function isTemplateStringsArray(v) {
		return has(v, "raw") && has(v, "length");
	}
	/**
	* It is assumed that opts will not change.  If this is a problem, clone your options object and pass the clone to
	* makeInstance
	* @param options
	* @return {outdent}
	*/
	function createInstance(options) {
		/** Cache of pre-processed template literal arrays */
		var arrayAutoIndentCache = createWeakMap();
		/**
		* Cache of pre-processed template literal arrays, where first interpolated value is a reference to outdent,
		* before interpolated values are injected.
		*/
		var arrayFirstInterpSetsIndentCache = createWeakMap();
		function outdent(stringsOrOptions) {
			var values = [];
			for (var _i = 1; _i < arguments.length; _i++) values[_i - 1] = arguments[_i];
			if (isTemplateStringsArray(stringsOrOptions)) {
				var strings = stringsOrOptions;
				var firstInterpolatedValueSetsIndentationLevel = (values[0] === outdent || values[0] === defaultOutdent) && reOnlyWhitespaceWithAtLeastOneNewline.test(strings[0]) && reStartsWithNewlineOrIsEmpty.test(strings[1]);
				var cache = firstInterpolatedValueSetsIndentationLevel ? arrayFirstInterpSetsIndentCache : arrayAutoIndentCache;
				var renderedArray = cache.get(strings);
				if (!renderedArray) {
					renderedArray = _outdentArray(strings, firstInterpolatedValueSetsIndentationLevel, options);
					cache.set(strings, renderedArray);
				}
				/** If no interpolated values, skip concatenation step */
				if (values.length === 0) return renderedArray[0];
				return concatStringsAndValues(renderedArray, firstInterpolatedValueSetsIndentationLevel ? values.slice(1) : values);
			} else return createInstance(extend(extend({}, options), stringsOrOptions || {}));
		}
		return extend(outdent, { string: function(str) {
			return _outdentArray([str], false, options)[0];
		} });
	}
	var defaultOutdent = createInstance({
		trimLeadingNewline: true,
		trimTrailingNewline: true
	});
	exports.outdent = defaultOutdent;
	exports.default = defaultOutdent;
	if (typeof module !== "undefined") try {
		module.exports = defaultOutdent;
		Object.defineProperty(defaultOutdent, "__esModule", { value: true });
		defaultOutdent.default = defaultOutdent;
		defaultOutdent.outdent = defaultOutdent;
	} catch (e) {}
})))();
function buildAction(ideBinPath) {
	if (!ideBinPath) throw new Error("IDE binpath must be provided");
	const tmp = Bun.env.TMPDIR ?? "/tmp";
	return async function action(commandId) {
		const id = Math.random();
		const scriptPath = `${tmp}/jetbrains_action_${id}.groovy`;
		const resultPath = `${tmp}/jetbrains_action_${id}.txt`;
		const script = import_lib.outdent`
      import com.intellij.openapi.actionSystem.ActionManager

      def actionManager = ActionManager.getInstance()
      def resultFile = new File(${JSON.stringify(resultPath)})

      IDE.application.invokeAndWait {
        try {
          def action = actionManager.getAction(${JSON.stringify(commandId)})
          if (action == null) {
            resultFile.text = "0"
            return
          }

          def result = actionManager.tryToExecute(action, null, null, null, false)
          resultFile.text = result.rejected ? "0" : "1"
        } catch (Throwable ignored) {
          resultFile.text = "0"
        }
      }
    `;
		await Bun.write(scriptPath, script);
		await Bun.spawn([
			ideBinPath,
			"ideScript",
			scriptPath
		]).exited;
		const result = await Bun.file(resultPath).text();
		await Bun.file(scriptPath).delete();
		await Bun.file(resultPath).delete();
		return result == "1";
	};
}
//#endregion
export { buildAction as default };
