function handle(payload) {
    var a = payload.operands.pop();
    var b = payload.operands.pop();
    return a * b;
}

exports.handle = handle;