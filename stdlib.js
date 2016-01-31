String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

var Promise = require('bluebird');

var lib = {};

function queryArg(query, args) {
	if (/^[0-9]\.\.$/.test(query)) {
		var amount = parseInt(query.substr(0, 1));
		return Array.prototype.slice.call(args).slice(amount);
	} else if (/^[0-9]$/.test(query)) {
		var index = parseInt(query);
		return args[index];
	} else if (/^\-[0-9]$/.test(query)) {
		var index = parseInt(query);
		return index === -1 ? Array.prototype.slice.call(args).slice(index)[0] : Array.prototype.slice.call(args).slice(index, index + 1)[0];
	} else if (/^\-[0-9]\.\.$/.test(query)) {
		var index = parseInt(query.substr(0, 2));
		return Array.prototype.slice.call(args).slice(index);
	} else if (/^[0-9]\.\.\-[0-9]$/.test(query)) {
		var index = parseInt(query.substr(0, 1));
		var lastIndex = parseInt(query.substr(3, 2));
		return Array.prototype.slice.call(args).slice(index, args.length + lastIndex);
	}
}

function checkType(arg, type) {
	if (type === "scope") {
		if (typeof arg === "object") return true;
	} else if (type === "list") {
		if (arg instanceof Array) return true;
	} else if (type === "string") {
		if (typeof arg === "string") return true;
	} else if (type === "number") {
		if (typeof arg === "number") return true;
	} else if (type === "block") {
		if (typeof arg === "object" && arg.type === "block") return true;
	} else if (type === "js") {
		if (typeof arg === "object" && arg.type === "js") return true;
	}

	return false;
}

lib._assureArg = assureArg;

function assureArg(args, query, type, onError) {
	var arg = queryArg(query, args);
	
	if (/list(:[a-z]*)?/.test(type)) {
		var subtype = type.match(/list(:[a-z]*)?/)[1].substr(1);

		var result = arg.every(function(argi) {
			return checkType(argi, subtype);
		});

		if (result) return arg;
		else return onError();
	} else {
		if (checkType(arg, type)) return arg;
		else return onError();
	}
	
}

lib._raise = raise;

function raise(res, name, message) {
	res(getError(name, message));
}

function getError(name, message) {
	throw new Error("(" + name + "): " + message);
}

function typeError(res, name, which, type, plural) {
	return function() {
		raise(res, name, which.capitalizeFirstLetter() + " argument" + (plural ? "s" : "") + " should be of type " + type + ".");
	}
}

/**
 * Executes blocks with scope simultaneously.
 * @param {object} scope [description]
 */
lib.with = function(p, res) {
	var scope = assureArg(arguments, "2", "scope", function() {
		raise(res, "with", typeError(res, "with", "first", "scope"));
	});

	var blocks = assureArg(arguments, "3..", "list:block", function() {
		raise(res, "with", typeError(res, "with", "the rest of", "block", true));
	});

  Promise.all(blocks.map(function(block) {
    return p(scope, block, lib);
  })).then(res);
}

lib.seq = function(p, res) {
	var scope = assureArg(arguments, "2", "scope", function() {
		raise(res, "seq", typeError(res, "seq", "first", "scope"));
	});

  var blocks = assureArg(arguments, "3..", "list:block", function() {
  	raise(res, "seq", typeError(res, "seq", "the rest of", "block", true));
  });

  Promise.reduce(blocks, function(previous, current) {
    return p(scope, current, lib);
  }, {}).then(res);
}

/**
 * Module commands
 */

lib.module = function(p, res) {
	var name = assureArg(arguments, "2", "string", typeError(res, "module", "first", "string"));
	var blocks = assureArg(arguments, "3..", "list:block", typeError(res, "module", "the rest of", "block", true));

  var namespace = {};
  var scope = this;

  Promise.reduce(blocks, function(previous, current) {
    return p(previous, current, lib);
  }, scope).then(function(result) {
    Object.keys(result).forEach(function(key) {
      namespace[key] = result[key];
    });
    lib[name] = namespace;
    res(namespace);
  });
}

lib.define = function(p, res) {
	var name = assureArg(arguments, "2", "string", typeError(res, "define", "first", "string"));
	var block = assureArg(arguments, "3", "block", typeError(res, "define", "second", "block"));
  
  var scope = this;

  p(scope, block, lib).then(function(fun) {
    scope[name] = fun;
    res(scope);
  });
}

lib.jsfn = function(p, res) {
	var args = assureArg(arguments, "2..-1", "list:string", typeError(res, "jsfn", "all but last", "string", true));
	var jsblock = assureArg(arguments, "-1", "js", typeError(res, "jsfn", "last", "js"));

  args.unshift("res");
  args.unshift("p");

	var code = "(function(" + args.join(", ") + "){ " + jsblock.code + " })";
	var result = eval(code);

	res(result); 
}

lib["eval"] = function(p, res, str) {
  res(eval(str));
}

lib.pro = function(p, res) {
	console.log(lib);
	res();
}

lib["new"] = function(p, res) {
	var type = assureArg(arguments, "2", "string", function() {
		raise(res, "new", typeError(res, "new", "first", "string"));
	});

	switch (type) {
		case "scope":
			res({});
			break;
		case "string":
			res("");
			break;
		case "number":
			res(0);
			break;
		case "list":
			res([]);
			break;
		case "block":
			res({ type: "block", cmd: "", args: [] });
		default:
			raise(res, "new", "Type '" + type + "' is not recognized.");
			break;
	}
}

lib.Utils = {};

lib.Utils.assureType = function(p, res) {
	var type = assureArg(arguments, "2", "string", function() {
		raise(res, "Utils assureType", "First argument should be of type string.");
	});

	var arg = assureArg(arguments, "3", type, function() {
		raise(res, "Utils assureType", "Second argument should be of type " + type + ".");
	});

	if (arg) res(1);
}

lib.quit = function(p, res) {
	process.exit(0);
}

module.exports = lib;


/*

{
   "with": function(p, res, scope) {
    var blocks = Array.prototype.slice.call(arguments).slice(3);
    var pblocks = blocks.map(function(block) {
      return p(scope, block, BUILTIN);
    });

    Promise.all(pblocks).then(res);
  },
  "using": function(p, res, scope) {
    var blocks = Array.prototype.slice.call(arguments).slice(3);
    var pblocks = blocks.map(function(block) {
      return p(scope, block, scope);
    });

    Promise.all(pblocks).then(res);
  },
  "dowith": function(p, res) {
    var blocks = Array.prototype.slice.call(arguments).slice(2);
    var self = this;
    var pblocks = blocks.map(function(block) {
      return p(self, block, BUILTIN);
    });

    Promise.all(pblocks).then(function(result) {
      res(result[result.length-1]);
    });
  },
  "doseq": function(p, res) {
    var blocks = Array.prototype.slice.call(arguments).slice(2);

    var self = this;
    res(Promise.reduce(blocks, function(previous, current) {
      return p(self, current, BUILTIN);
    }, {}));
  },
  "seq": function(p, res, scope) {
    var blocks = Array.prototype.slice.call(arguments).slice(3);

    res(Promise.reduce(blocks, function(previous, current) {
      return p(scope, current, BUILTIN);
    }, {}));
  },
  "require": function(p, res, module, name) {
    this[name || module] = require(module);
    res(this);
  },
  "import": function(p, res, filename) {
    var self = this;
    require('fs').readFile("lib/" + filename + ".dstn", "utf8", function(err, content) {
      if (err) res(err);
      else parseTree(self, parser.parse(content)).then(res);
    });
  },
  "return": function(p, res, arg) {
    res(arg);
  },
  "after": function(p, res, timeout, arg) {
    var args = arguments;
    setTimeout(function() {
      res(arg);
    }, timeout);
  },
  "set": function(p, res, key, value) {
    MEMORY[key] = value;
    res(value);
  },
  "get": function(p, res, key) {
    res(MEMORY[key]);
  },
  "del": function(p, res, key) {
    delete MEMORY[key];
    res();
  },
  "readline": function(p, res, prompt) {
    read({ prompt: prompt }, function(err, str, isd) {
      res(str);
    });
  },
  "reduce": function(p, res) {
    var blocks = Array.prototype.slice.call(arguments).slice(2);

   res(Promise.reduce(blocks, function(previous, current) {
      return p(previous, current, BUILTIN);
    }, {}));
  },
  "module": function(p, res, name) {
    var blocks = Array.prototype.slice.call(arguments).slice(3);
    var namespace = {};

   Promise.reduce(blocks, function(previous, current) {
      return p(previous, current, BUILTIN);
    }, {}).then(function(result) {
      Object.keys(result).forEach(function(key) {
        namespace[key] = result[key];
      });
      BUILTIN[name] = namespace;
      res(namespace);
    });
  },
  "define": function(p, res, name, block) {
    var self = this;
    p(self, block, BUILTIN).then(function(fun) {
      self[name] = fun;
      res(self);
    });
  },
  ".": function(p, res, name) {
    if (name) res(this[name]);
    else res(this);
  },
  ".!": function(p, res, name) {
    var args = Array.prototype.slice.call(arguments).slice(3);
    res(this[name].apply(this, args));
  },
  ".!>": function(p, res, obj, prop) {
    var args = Array.prototype.slice.call(arguments).slice(4);
    res(this[obj][prop].apply(this[obj], args));
  },
  ".?": function(p, res, name) {
    res(this[name]);
  },
  "new": function(p, res, name) {
    var args = Array.prototype.slice.call(arguments).slice(3);
    res(new (this[name].bind.apply(this[name], args)));
  },
  "$$": function(p, res) {
    res(this.$);
  },
  ".>": function(p, res, prop) {
    res(this[prop]);
  },
  ".<": function(p, res, prop, value) {
    var self = this;
    p(this, value, BUILTIN).then(function(val) {
      self[prop] = val;
      res(val);
    });
  },
  ">": function(p, res, obj, prop) {
    res(obj[prop]);
  },
  "<": function(p, res, obj, prop, val) {
    obj[prop] = value;
    res(obj);
  },
  "!>": function(p, res, obj, prop) {
    var args = Array.prototype.slice.call(arguments).slice(4);
    res(obj[prop].apply(obj, args));
  },
  "eq": function(p, res, val1, val2) {
    res(val1 === val2 ? 1 : 0);
  },
  "lt": function(p, res, val1, val2) {
    res(val1 < val2 ? 1 : 0);
  },
  "lte": function(p, res, val1, val2) {
    res(val1 <= val2 ? 1 : 0);
  },
  "gt": function(p, res, val1, val2) {
    res(val1 > val2 ? 1 : 0);
  },
  "gte": function(p, res, val1, val2) {
    res(val1 >= val2 ? 1 : 0);
  },
  "and": function(p, res, val1, val2) {
    res(val1 && val2 ? 1 : 0);
  },
  "or": function(p ,res, val1, val2) {
    res(val1 || val2 ? 1 : 0)
  },
  "GLOBAL": function(p, res) {
    res(BUILTIN);
  },
  "JS_GLOBAL": function(p, res) {
    res(global);
  },
  "if": function(p, res, cond, yep, nope) {
    var self = this;
    p(this, cond, BUILTIN).then(function(result) {
      if (result) p(self, yep, BUILTIN).then(res);
      else p(self, nope, BUILTIN).then(res);
    });
  },
  "lambda": function(p, res) {
    var argv = Array.prototype.slice.call(arguments);
    var args = argv.slice(2, -1);
    var block = argv.slice(-1)[0];
    var self = this;

    res(function() {
      var iarg = Array.prototype.slice.call(arguments);

      if (iarg.length !== args.length) return;

      var ntree = replaceInTree(block, args, iarg);

      p(self, ntree, BUILTIN);
    });
  },
  "fn": function(p, res) {
    var argv = Array.prototype.slice.call(arguments);
    var args = argv.slice(2, -1);
    var block = argv.slice(-1)[0];

    res(function(p, res2) {
      var iarg = Array.prototype.slice.call(arguments).slice(2);

      if (iarg.length !== args.length) return res2(new Error('Cannot execute function without matching arities.'))

      var ntree = replaceInTree(block, args, iarg);

      p(this, ntree, BUILTIN).then(res2);
    });
  },
  "fn*": function(p, res, name) {
    var argv = Array.prototype.slice.call(arguments);
    var args = argv.slice(3, -1);
    var block = argv.slice(-1)[0];

    res(function(p, res2) {
      var iarg = Array.prototype.slice.call(arguments).slice(2);

      args.unshift(name);
      iarg.unshift(Array.prototype.slice.call(arguments).slice(2));

      var ntree = replaceInTree(block, args, iarg);

      p(this, ntree, BUILTIN).then(res2);
    });
  },
  "jsfn": function(p, res) {
    var args = (['p', 'res']).concat(Array.prototype.slice.call(arguments).slice(2));
    var js = args.slice(-1)[0];
    args = args.slice(0, -1).join(", ");

    var scope = this;
    var code = "(function(" + args + "){ " + js.code + " })";
    var result = eval(code);

    res(result);
  },
  ".jsfn": function(p, res) {
    var args = (['p', 'res']).concat(Array.prototype.slice.call(arguments).slice(2));
    var js = args.slice(-1)[0];
    args = args.slice(0, -1).join(", ");

    var scope = this;
    var code = "(function(" + args + "){ " + js.code + " }).bind(scope)";
    var result = eval(code);

    res(result);
  },
  "log": function(p, res, to) {
 
    res(to);
  },
  "print": function(p, res) {
 
    res();
  },
  "quit": function() {
    process.exit(0);
  },
  "+": function(p, res) {
    res(Array.prototype.slice.call(arguments).slice(2).reduce(function(prev, curr) { return prev + curr; }));
  },
  "-": function(p, res) {
    res(Array.prototype.slice.call(arguments).slice(2).reduce(function(prev, curr) { return prev - curr; }));
  }
}
 */