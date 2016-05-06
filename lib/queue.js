function Queue() {
    this.data = [];
}

Queue.prototype.push = function(n) {
    this.data.push(n);
};

Queue.prototype.pop = function() {
    if (this.isEmpty()) {
        return null;
    } else {
        value = this.data[0];
        this.data = this.data.splice(1);
        return value;
    }
};

Queue.prototype.peek = function() {
    if (this.isEmpty()) {
        return null;
    } else {
        return this.data[0];
    }
};

Queue.prototype.toString = function() {
    return this.data.toString();
};

Queue.prototype.isEmpty = function() {
    return (this.data.length === 0);
};

module.exports = Queue;
