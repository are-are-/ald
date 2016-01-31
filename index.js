Number.prototype.times = function(cb) {
  var i = -1;
  while (++i < this) cb(i);
  return +this;
}

var read = require('read'),
    pegjs = require('pegjs'),
    parser = pegjs.buildParser(require('fs').readFileSync('./grammar.pegjs', 'utf8')),
    Promise = require('bluebird');

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
var BUILTIN = require('./stdlib.js');

BUILTIN.import = function(p, res) {
  var filename = BUILTIN._assureArg(arguments, "2", "string", function() {
    raise(res, "import", typeError(res, "seq", "first", "string"));
  });

  var scope = this;
  
  require('fs').readFile("lib/" + filename + ".ald", "utf8", function(err, content) {
    if (err) BUILTIN._raise(res, "import", "Couldn't load file 'lib/" + filename + ".ald'.");
    else parseTree(scope, parser.parse(content)).then(res);
  });
}

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
  }).catch(function(error) {
    console.log(error);
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