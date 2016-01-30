# ALD (another lisp-like dialect)

This is currently one big mess.

### how to run it

Clone it, navigate into it and `node index` it.
Now you are in a basic REPL!

To exit REPL type `quit.`.
Ctrl-C won't work. Seriously. I hate you guys.

## syntax

This is the basic syntax.

    (command argument1 argument2 argumentn...)

Every command has to return something (even if its `undefined`). Also, every command is asynchronous, so the program will wait for every nested command to execute first.
The top most command must not be wrapped in parentheses.

Example:
    
    > return (+ 2 2).
    4

When using REPL, you must end your command with a dot to indicate the end of it. If you press enter without dot at the end, REPL will wait for the next line.
If you create multiline command and want to discard it, just create new line and write `!`.

Nested commands (like `return (+ 2 (- 6 3))`) will be evaluated before their parents. So the previous example will evaluate like this:

    return (+ 2 (- 6 3))
    return (+ 2 3)
    return 5
    5

### argument types


#### block
This is a block. It won't be executed immediately, only on explicit command call.

    .(command argument1 argument2 argumentn...)

#### list
This is a native array.

    [argument1 argument2 argumentn...]

#### string

    "string with whitespaces and single 'quotes'"
    'string with whitespaces and double "quotes"'
    string-without-whitespaces

#### number

    16
    26,236

#### javascript native code
Some native functions can take an argument which is an javascript code.

    `javascript code`

## builtin commands

__important things to know__

Every command has its own `this`-ish scope that inherits from parent (until specifically said it doesn't). Some commands can change the current _scope_, some commands operate on current _scope_.

#### +
Adds arguments. If all of arguments are numbers, it will return number. If one of the arguments is a string, it will concatenate all arguments and return string.

    + arguments...

#### - 
Subtracts arguments. If one of the arguments is not a number, scary things will happen.

    - arguments...

#### with
Executes blocks simultaneously with specified scope. You probably shouldn't use it. Better use `seq`.
Returns an array with results of every block.

    with scope blocks...

#### seq
Executes blocks sequentially with specified scope.
Returns an array with results of every block.

    seq scope blocks...

#### dowith
Like `with` but returns only the result of last block.

    dowith scope blocks...

#### doseq
Like `seq` but returns only the result of last block.

    doseq scope blocks...

#### require
Requires a native node.js module and saves it as `name` into the scope.
If name is not specified, saves it as `module`.

    require module [name]

#### import
Imports `.ald` file.

    import module

#### return
Returns first argument.

    return argument

#### after
Returns first argument after `delay` milliseconds.

    after delay argument

#### readline
Reads line from stdin and returns string. You can specify `prompt` that will appear before cursor.

    readline prompt

#### .
Returns current scope.
    
    .

#### TO-DO document more commands and categorize them

## modules
There are few _stdlib_ modules implemented in lib folder. You can import them with `import` command.

Modules generally have a structure like this:

    module ModuleName
      .(define functionName block)
      .(define functionName block)

By importing them into your main file or even another module, you can use it like this:

    ModuleName functionName arguments...

This is the only exception to the rule that the first word is a command. In case of imported modules, the first and second words are commands.
You can look up the available modules in the `lib` folder. Some of them uses `jsfn` to implement _native_ functions.

## fun examples

### simple http server responding with HTML page

    seq (.)
      .(import HTML)
      .(require http)
      .(.< server (.!> http createServer 
        (lambda req res .(!> res end 
          (HTML html
            (HTML head
              (HTML title "Test")
              (HTML meta [charset "UTF-8"]))
            (HTML body
              (HTML b Its)
              (HTML i working!)))))))
      .(.!> server listen 8080
        (lambda
          .(log Connected!)))

### fibonacci
    
    .(define fib 
      .(fn n 
        .(if .(lte n 2) 
          1 
          .(+ (Math.fib (- n 1)) (Math.fib (- n 2))))))