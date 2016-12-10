/*jslint node: true */
"use strict";

var mocha = require('mocha');
var assert = require('assert');
var Queue = require('../lib/queue');

describe('basic queue', function () {
    it('isEmpty on empty queue return true', function () {
        var queue = new Queue();
        assert.equal(true, queue.isEmpty());
    });

    it('isNotEmpty', function () {
        var queue = new Queue();
        queue.push('apple');
        assert.equal(false, queue.isEmpty());
    });

    it('peekEmptyQueue', function () {
        var queue = new Queue();
        assert.equal(null, queue.peek());
    });

    it('peekNonEmptyQueue', function () {
        var queue = new Queue();
        queue.push('apple');
        assert.equal('apple', queue.peek());
    });

    it('peekNonEmptyQueueWithTwoItems', function () {
        var queue = new Queue();
        queue.push('apple');
        queue.push('banana');
        assert.equal('apple', queue.peek());
    });

    it('popEmpty', function () {
        var queue = new Queue();
        assert.equal(null, queue.pop());
    });


    it('overPop', function () {
        var queue = new Queue();
        queue.push('apple');
        assert.equal('apple', queue.pop());
        assert.equal(null, queue.pop());
    });

    it('pushPop', function () {
        var queue = new Queue();
        queue.push('apple');
        assert.equal('apple', queue.pop());
        assert.equal(null, queue.pop());
    });

    it('pushPop3', function () {
        var queue = new Queue();
        queue.push('apple');
        queue.push('banana');
        queue.push('coconut');
        assert.equal('apple', queue.pop());
        assert.equal('banana', queue.pop());
        assert.equal('coconut', queue.pop());
        assert.equal(null, queue.pop());
    });

    it('mixPop', function () {
        var queue = new Queue();
        queue.push('apple');
        queue.push('banana');
        assert.equal('apple', queue.pop());
        assert.equal('banana', queue.pop());
        queue.push('coconut');
        assert.equal('coconut', queue.pop());
        assert.equal(null, queue.pop());
        queue.push('donut');
        assert.equal('donut', queue.pop());
        assert.equal(null, queue.pop());
    });

});
