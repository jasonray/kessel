/*jslint node: true */
"use strict";

var mocha = require('mocha');
var assert = require('assert');
var QueueAdapter = require('../lib/queue/asyncQueueAdapter');
var moment = require('moment');

describe('asyncQueueAdapter', function () {
    describe('size', function () {
        it('initial size is 0', function () {
            var queueAdapter = new QueueAdapter();
            assert.equal(queueAdapter.size(), 0);
        });
        it('after enqueue, size is 1', function (done) {
            var queueAdapter = new QueueAdapter();
            var request = createSampleJobRequest();
            queueAdapter.enqueue(request, function () {
                assert.equal(queueAdapter.size(), 1);
                done();
            });
        });
    });
    describe('isEmpty', function () {
        it('initial isEmpty returns true', function () {
            var queueAdapter = new QueueAdapter();
            assert.equal(queueAdapter.isEmpty(), true);
        });
        it('after enqueue, isEmpty is false', function (done) {
            var queueAdapter = new QueueAdapter();
            var request = createSampleJobRequest();
            queueAdapter.enqueue(request, function () {
                assert.equal(queueAdapter.isEmpty(), false);
                done();
            });
        });
    });
    describe('enqueue / dequeue', function () {
        it('dequeue on empty returns empty', function (done) {
            var dequeueCallback = function (reservedJobRequest, commitJobA, rollbackJobA) {
                assert.equal(reservedJobRequest, null);
                done();
            }

            var queueAdapter = new QueueAdapter();
            queueAdapter.dequeue(dequeueCallback);
        });
        it('enqueue then dequeue returns job request', function (done) {
            var dequeueCallback = function (jobRequest, commitJobA, rollbackJobA) {
                assert.equal(jobRequest.ref, 'testjob');
                done();
            }

            var afterEnqueueCallback = function (err, jobRequest) {
                queueAdapter.dequeue(dequeueCallback);
            }

            var queueAdapter = new QueueAdapter();
            var request = createSampleJobRequest('testjob');
            queueAdapter.enqueue(request, afterEnqueueCallback)
        });
        it('enqueue then dequeue returns job request (with latency)', function (done) {
            var dequeueCallback = function (jobRequest, commitJobA, rollbackJobA) {
                assert.equal(jobRequest.ref, 'testjob');
                done();
            }

            var afterEnqueueCallback = function (err, jobRequest) {
                queueAdapter.dequeue(dequeueCallback);
            }

            var queueAdapter = new QueueAdapter(100);
            var request = createSampleJobRequest('testjob');
            queueAdapter.enqueue(request, afterEnqueueCallback)
        });
    });
    describe('enqueue / dequeue with transactions', function () {
        it('dequeue (without commit/rollback) makes item unavailable to another dequeue', function (done) {
            var queueAdapter = new QueueAdapter();

            var jobRequestA = createSampleJobRequest('a');
            queueAdapter.enqueue(jobRequestA, afterEnqueueCallback);

            function afterEnqueueCallback(err, jobRequest) {
                //at this point jobRequestA is in queue
                queueAdapter.dequeue(function (reservedJobA, commitJobA, rollbackJobA) {
                    //at this point, no item on queue and jobRequestA is in reserved state
                    assert.ok(reservedJobA, 'expected an item to be reserved from queue');
                    assert.equal(reservedJobA.ref, 'a');

                    //if we dequeue at this point, we should get empty item as there is nothing available on queue
                    queueAdapter.dequeue(function (reservedJobB, commitJobB, rollbackJobB) {
                        assert.equal(reservedJobB, null, 'expected no item available from queue');
                        done();
                    });

                });
            }
        });
        it('dequeue (with commit) makes item unavailable to another dequeue', function (done) {
            var queueAdapter = new QueueAdapter();

            var jobRequestA = createSampleJobRequest('a');
            queueAdapter.enqueue(jobRequestA, afterEnqueueCallback);

            function afterEnqueueCallback(err, jobRequest) {
                //at this point jobRequestA is in queue
                queueAdapter.dequeue(function (reservedJobA, commitJobA, rollbackJobA) {
                    //at this point, no item on queue and jobRequestA is in reserved state
                    assert.ok(reservedJobA, 'expected an item to be reserved from queue');
                    assert.equal(reservedJobA.ref, 'a');

                    commitJobA(function () {
                        //item commit off of queue

                        //if we dequeue at this point, we should get empty item as there is nothing available on queue
                        queueAdapter.dequeue(function (reservedJobB, commitJobB, rollbackJobB) {
                            assert.equal(reservedJobB, null, 'expected no item available from queue');
                            done();
                        });
                    });
                });
            }
        });
        it('dequeue (with rollback) makes item available to another dequeue', function (done) {
            var queueAdapter = new QueueAdapter();

            var jobRequestA = createSampleJobRequest('a');
            queueAdapter.enqueue(jobRequestA, afterEnqueueCallback);

            function afterEnqueueCallback(err, jobRequest) {
                //at this point jobRequestA is in queue
                queueAdapter.dequeue(function (reservedJobA, commitJobA, rollbackJobA) {
                    //at this point, no item on queue and jobRequestA is in reserved state
                    assert.ok(reservedJobA, 'expected an item to be reserved from queue');
                    assert.equal(reservedJobA.ref, 'a');

                    rollbackJobA(function () {
                        //item rollbacked to queue

                        //if we dequeue at this point, we should get jobRequestA again
                        queueAdapter.dequeue(function (reservedJobA2, commitJobA2, rollbackJobA2) {
                            assert.ok(reservedJobA2, 'expected an item to be reserved from queue');
                            assert.equal(reservedJobA2.ref, 'a');
                            done();
                        });
                    });
                });
            }
        });
        it('ensure support for two no-committed dequeue', function (done) {
            //TODO: holy callbacks, batman.  Switch this to promises.
            //Update: i tried out promises.  And it worked better, but it does have an odd play with
            //how to handle the callbacks on commit() and rollback() that would need to be overcome
            //would need to decide between explicitly switching to promises or using bluebird.promisfy

            var queueAdapter = new QueueAdapter();

            var jobRequestA = createSampleJobRequest('a');
            queueAdapter.enqueue(jobRequestA, function () {
                var jobRequestB = createSampleJobRequest('b');
                queueAdapter.enqueue(jobRequestB, function () {
                    var jobRequestC = createSampleJobRequest('c');
                    queueAdapter.enqueue(jobRequestC, function () {

                        //at this point there should be three items in the queue

                        queueAdapter.dequeue(function (reservedJobA, commitJobA, rollbackJobA) {
                            //expected state: jobA reserved, jobB and jobC on queue
                            assert.ok(reservedJobA, 'expected an item to be reserved from queue');
                            assert.equal(reservedJobA.ref, 'a');

                            queueAdapter.dequeue(function (reservedJobB, commitJobB, rollbackJobB) {
                                //expected state: jobA and jobB reserved, jobC on queue
                                assert.ok(reservedJobB, 'expected an item to be reserved from queue');
                                assert.equal(reservedJobB.ref, 'b');

                                queueAdapter.dequeue(function (reservedJobC, commitJobC, rollbackJobC) {
                                    //expected state: jobA, jobB, and jobC reserved
                                    assert.ok(reservedJobC, 'expected an item to be reserved from queue');
                                    assert.equal(reservedJobC.ref, 'c');

                                    rollbackJobB(function () {
                                        //job B rollbacked to queue
                                        //expected state: jobA and jobC reserved, jobB on queue

                                        //if we dequeue at this point, we should get jobB again
                                        queueAdapter.dequeue(function (reservedJobB2, commitJobB2, rollbackJobB2) {
                                            assert.ok(reservedJobB2, 'expected an item to be reserved from queue');
                                            assert.equal(reservedJobB2.ref, 'b');
                                            done();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });

        });
    });
    describe('expiration', function () {
        it('if expiration is set to 1 sec in future and requested before then, it will be processed normally', function (done) {
            var queueAdapter = new QueueAdapter();
            var request = createSampleJobRequest('r');
            request.timeout = moment().add(1, "y").toDate();
            queueAdapter.enqueue(request, function () {
                queueAdapter.dequeue(function (reservedAttempt, commitJob1, rollbackJob1) {
                    assert.equal(reservedAttempt.ref, 'r');
                    done();
                });
            });
        });
        it('if expiration is set to future and requested after then, it will be not be processed', function (done) {
            const delay = 1000;
            var queueAdapter = new QueueAdapter();
            var request = createSampleJobRequest('r');
            request.timeout = moment().add(delay, "ms").toDate();
            setTimeout(function () {
                queueAdapter.enqueue(request, function () {
                    queueAdapter.dequeue(function (reservedAttempt, commitJob1, rollbackJob1) {
                        // assert.equal(reservedAttempt, null, 'expected to NOT dequeue an item');
                        assert.equal(reservedAttempt, null);
                        done();
                    });
                });
            }, delay);
        });
        it('with two items, expired item will be skipped to get to non-expired item', function (done) {
            var queueAdapter = new QueueAdapter();
            var requestExpired = createSampleJobRequest('expired');
            requestExpired.timeout = moment().subtract(1, "y").toDate();

            var requestNotExpired = createSampleJobRequest('not expired');
            requestNotExpired.timeout = moment().add(1, "y").toDate();

            queueAdapter.enqueue(requestExpired, function () {
                queueAdapter.enqueue(requestNotExpired, function () {
                    queueAdapter.dequeue(function (reservedAttempt, commitJob1, rollbackJob1) {
                        assert.equal(reservedAttempt.ref, 'not expired');
                        done();
                    });
                });
            });
        });
    });
    describe.skip('delay', function () {
        it('if delay is set to 1 sec in future it cannot be dequeued until +1s', function (done) {
            console.log('begin');
            var queueAdapter = new QueueAdapter();
            console.log('size: ', queueAdapter.size());
            var request = createSampleJobRequest('delayed item');
            request.timeout = moment().add(1, "y").toDate();
            console.log('about to enqueue item with delay: ', request);
            queueAdapter.enqueue(request, function () {
                console.log('enqueued, size: ', queueAdapter.size());
                console.log('about to dequeue');
                queueAdapter.dequeue(function (reservedAttempt1, commitJob1, rollbackJob1) {
                    console.log('dequeued1: ', reservedAttempt1);
                    assert.equal(reservedAttempt1, null, 'expected to not get an item as it should be delayed at this point');
                    setTimeout(function () {
                        queueAdapter.dequeue(function (reservedAttempt2, commitJob2, rollbackJob2) {
                            console.log('dequeued2: ', reservedAttempt2);
                            assert.ok(reservedAttempt2);
                            assert.equal(reservedAttempt2.ref, 'delayed item');
                            done();
                        });
                    }, 1000);
                });
            });
        });
    });
})
;

function createSampleJobRequest(ref) {
    var request = {
        type: 'sample',
        payload: {
            x: 'x',
            y: 'y'
        }
    };
    if (ref) {
        request.ref = ref;
    }
    return request;
}