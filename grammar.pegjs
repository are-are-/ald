Command
  = _? cmd:CommandName _? args:Arguments? _? {
    return {
      type: "command",
      cmd: cmd,
        args: args || []
    }
}

Arguments
  = arg:Argument _ args:Arguments { return [arg].concat(args); }
    / arg:Argument { return [arg]; }

CommandName = cmd:Identifier+ {
  return cmd.join("");
}

Argument
    = "(" _? cmd:Command _? ")" { return cmd; }
        / ".(" _? cmd:Command _? ")" { cmd.type = "block"; return cmd; }
        / "[" _? args:Arguments? _? "]" { return args || []; }
        / "`" code:[^`]* "`" { return { type: "js", code: code.join("") }; }
        / "\"" str:[^"]* "\"" { return str.join(""); }
        / "'" str:[^']* "'" { return str.join(""); }
        / parts:([0-9]* "," [0-9]+) { return parseFloat(parts[0].join("") + "." + parts[2].join("")); }
        / first:[0-9]+ { return parseInt(first.join("")); }
        / arg:Identifier { return arg; }

Identifier = head:[a-zA-Z\.,_\-$#@!?<>+=/\\&^%*] tail:[[a-zA-Z\.,_\-$#@!?0-9<>]* { return head + tail.join(""); }

_ = [ \t\r\n]+ {
  return undefined;
}