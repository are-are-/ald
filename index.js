var oldlog = console.log;
// console.log = function(arg) {
//   if (arg === undefined) {
//     oldlog("undefined");
//   } else if (arg.constructor === Array) {
//     oldlog("[ " + arg.join(" ") + " ]");
//   } else if (arg.type === "block") {
//     oldlog(".(" + arg.cmd + " " + arg.args.join(" ") + ")");
//   } else if (typeof arg === "string") {
//     oldlog("\"" + arg + "\"");
//   } else if (arg.type === "js") {
//     oldlog("`" + arg.code + "`");
//   } else {
//     oldlog(arg);
//   }
// }

Number.prototype.times = function(cb) {
  var i = -1;
  while (++i < this) cb(i);
  return +this;
}

var request = jxcore.utils.smartRequire(require);

var read = request('read'),
    pegjs = request('pegjs'),
    parser = pegjs.buildParser(require('fs').readFileSync('./grammar.pegjs', 'utf8')),
    Promise = request('bluebird');

function readPrompt(p) {
  read({ prompt: (p || ' >') }, function(err, str, isd) {
    parsePrompt(str);
  });
}


var repl = true;

process.on('uncaughtException', function(err) {
  console.log(err);
  if (repl) readPrompt("!>");
});

if (process.argv.length >= 3) {
  var contents = require('fs').readFileSync(process.argv[2], "utf8");

  repl = false;

  var context = {};

  var tree = parser.parse(contents);
  parseTree(context, tree).then(function(result) {
    console.log(result);
  });

} else {
  readPrompt();
}

var MEMORY = {};
var BUILTIN = {
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
  "do": function(p, res) {
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
  "..require": function(p, res, module, name) {
    this[name || module] = request(module);
    res(this);
  },
  "import": function(p, res, filename) {
    var self = this;
    require('fs').readFile(filename + ".dstn", "utf8", function(err, content) {
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
    oldlog(to);
    res(to);
  },
  "print": function(p, res) {
    console.log(Array.prototype.slice.call(arguments).slice(2).join(" "));
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
};

var BUFFER = "";
function parsePrompt(str) {
  if (str === undefined || str === "") {
    if (repl) return readPrompt('!>');
    else return '';
  }

  var lastChar = str[str.length-1],
      command = "";

  BUFFER += "\n" + str;

  if (lastChar === ".") {
    command = BUFFER.slice(0, -1);
    BUFFER = "";
  } else {
    if (str === "!") {
      BUFFER = "";
      console.log('Buffer cleared.');
    }
    if (repl) return readPrompt('.');
  }

  var context = {};

  var tree = parser.parse(command);
  parseTree(context, tree).then(function(result) {
    console.log(result);
    if (repl) readPrompt();
  });
}

function copyTree(tree) {
  return {
    type: tree.type,
    cmd: tree.cmd,
    args: tree.args.slice(0)
  }
}

function replaceInTree(tree, keys, vals) {
  if (tree.type === "block" || tree.type === "command") {
      var ntree = copyTree(tree);

      ntree.args = ntree.args.map(function(arg, i) {
        if (keys.indexOf(arg) >= 0) return vals[keys.indexOf(arg)];
        else if (arg.type === "block" || arg.type === "command" || arg.type === "js") return replaceInTree(arg, keys, vals);
        else if (arg.constructor === Array) {
          return arg.map(function(narg) {
            return replaceInTree(narg, keys, vals); 
          });
        } else {
          return arg;
        }
      });

      return ntree;
  } else if (tree.type === "js") {
    var matches = tree.code.match(/{{[^}{]+}}/g);
    (matches || []).map(function(x) { return x.match(/[^}{]+/)[0]; }).forEach(function(str) {
      if (keys.indexOf(str) >= 0) tree.code = tree.code.replace(new RegExp("{{" + str + "}}", "g"), vals[keys.indexOf(str)]);
    });

    return tree;
  } else {
    return tree;
  }

}

function parseTree(ctx, tree) {
  if (tree.type === "command") {

    var pargs = tree.args.map(function(arg) {
      return parseTree(ctx, arg);
    });

    return Promise.all(pargs).then(function(args) {
      if (checkIfBuiltin(tree)) {
        return new Promise(function(resolve, reject) {
          if (typeof BUILTIN[tree.cmd] === "object") {
            var prop = args.shift();
            BUILTIN[tree.cmd][prop].apply(ctx, [parseBlock, resolve].concat(args));
          } else {
            BUILTIN[tree.cmd].apply(ctx, [parseBlock, resolve].concat(args));
          }
        });
      } else {
        return Promise.resolve(tree);
      }
    });
  } else if (tree.constructor === Array) {
    var pargs = tree.map(function(arg) {
      return parseTree(ctx, arg);
    });

    return Promise.all(pargs);
  } else {
    return Promise.resolve(tree);
  }
}

function parseBlock(ctx, tree, defaults) {
  if (tree.type === "block") {

    var pargs = tree.args.map(function(arg) {
      return parseTree(ctx, arg);
    });

    return Promise.all(pargs).then(function(args) {
      if (checkIfBuiltin(tree)) {
        return new Promise(function(resolve, reject) {
          if (typeof defaults[tree.cmd] === "object") {
            var prop = args.shift();
            defaults[tree.cmd][prop].apply(ctx, [parseBlock, resolve].concat(args));
          } else {
            defaults[tree.cmd].apply(ctx, [parseBlock, resolve].concat(args));
          }
        });
      } else {
        return Promise.resolve(tree);
      }
    });

  } else if (tree.constructor === Array) {
    var pargs = tree.map(function(arg) {
      return parseTree(ctx, arg);
    });

    return Promise.all(pargs);
  } else {
    return Promise.resolve(tree);
  }
}

function checkIfBuiltin(node) {
  if (node.cmd in BUILTIN) {

      return true;
  } else return false;
}


var turningOff = false;
process.on('SIGINT', function() {
  if (turningOff) {
    process.exit(0);
  } else {
    console.log('Press CTRL+C again quickly to quit.');
    turningOff = true;
    setTimeout(function() {
      turningOff = false;
    }, 1000);
  }
});

process.on('exit', function() {
  if (repl) console.log('Bye!');
});