/*jslint node: true */
'use strict';

const mocha = require('mocha');
const assert = require('assert');
const QueueAdapter = require('../lib/queue/asyncQueueAdapter');
const moment = require('moment');

function getQueueAdapter(callback, latency) {
    const queueAdapter = new QueueAdapter(latency);
    queueAdapter.initialize(function () {
        callback(queueAdapter);
    });
}

function createSampleJobRequest(ref, priority) {
    const request = {
        type: 'sample',
        payload: {
            x: 'x',
            y: 'y'
        }
    };
    if (ref) {
        request.ref = ref;
    }
    if (priority) {
        request.priority = priority;
    }
    return request;
}

describe('asyncQueueAdapter', function () {
    describe('constructor', function () {
        it('using new constructor', function () {
            const queueAdapter = new QueueAdapter();
            assert.ok(queueAdapter);
        });
    });
    describe('size', function () {
        it('initial size is 0', function () {
            const queueAdapter = new QueueAdapter();
            assert.equal(queueAdapter.size(), 0);
        });
        it('after enqueue, size is 1', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request = createSampleJobRequest();
                queueAdapter.enqueue(request, function () {
                    assert.equal(queueAdapter.size(), 1);
                    done();
                });
            });
        });
    });
    describe('isEmpty', function () {
        it('initial isEmpty returns true', function () {
            getQueueAdapter(function (queueAdapter) {
                assert.equal(queueAdapter.isEmpty(), true);
            });
        });
        it('after enqueue, isEmpty is false', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request = createSampleJobRequest();
                queueAdapter.enqueue(request, function () {
                    assert.equal(queueAdapter.isEmpty(), false);
                    done();
                });
            });
        });
    });
    describe('enqueue / dequeue', function () {
        it('dequeue on empty returns empty', function (done) {
            const dequeueCallback = function (reservedJobRequest, commitJobA, rollbackJobA) {
                assert.equal(reservedJobRequest, null);
                done();
            };

            getQueueAdapter(function (queueAdapter) {
                queueAdapter.dequeue(dequeueCallback);
            });
        });
        it('enqueue then dequeue returns job request', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const dequeueCallback = function (err, jobRequest, commitJobA, rollbackJobA) {
                    assert.equal(jobRequest.ref, 'testjob');
                    done();
                };

                const afterEnqueueCallback = function (err, jobRequest) {
                    queueAdapter.dequeue(dequeueCallback);
                };

                const request = createSampleJobRequest('testjob');
                queueAdapter.enqueue(request, afterEnqueueCallback)
            });
        });
        it('enqueue then dequeue returns job request (with latency)', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const dequeueCallback = function (err, jobRequest, commitJobA, rollbackJobA) {
                    assert.equal(jobRequest.ref, 'testjob');
                    done();
                };

                const afterEnqueueCallback = function (err, jobRequest) {
                    queueAdapter.dequeue(dequeueCallback);
                };

                const request = createSampleJobRequest('testjob');
                queueAdapter.enqueue(request, afterEnqueueCallback)
            }, 500);
        });
    });
    describe('enqueue / dequeue with transactions', function () {
        it('dequeue (without commit/rollback) makes item unavailable to another dequeue', function (done) {
            getQueueAdapter(function (queueAdapter) {

                const jobRequestA = createSampleJobRequest('a');
                queueAdapter.enqueue(jobRequestA, afterEnqueueCallback);

                function afterEnqueueCallback(err, jobRequest) {
                    //at this point jobRequestA is in queue
                    queueAdapter.dequeue(function (err, reservedJobA, commitJobA, rollbackJobA) {
                        //at this point, no item on queue and jobRequestA is in reserved state
                        assert.ok(reservedJobA, 'expected an item to be reserved from queue');
                        assert.equal(reservedJobA.ref, 'a');

                        //if we dequeue at this point, we should get empty item as there is nothing available on queue
                        queueAdapter.dequeue(function (err, reservedJobB, commitJobB, rollbackJobB) {
                            assert.equal(reservedJobB, null, 'expected no item available from queue');
                            done();
                        });

                    });
                }
            });
        });
        it('dequeue (with commit) makes item unavailable to another dequeue', function (done) {
            getQueueAdapter(function (queueAdapter) {

                const jobRequestA = createSampleJobRequest('a');
                queueAdapter.enqueue(jobRequestA, afterEnqueueCallback);

                function afterEnqueueCallback(err, jobRequest) {
                    //at this point jobRequestA is in queue
                    queueAdapter.dequeue(function (err, reservedJobA, commitJobA, rollbackJobA) {
                        //at this point, no item on queue and jobRequestA is in reserved state
                        assert.ok(reservedJobA, 'expected an item to be reserved from queue');
                        assert.equal(reservedJobA.ref, 'a');

                        commitJobA(function () {
                            //item commit off of queue

                            //if we dequeue at this point, we should get empty item as there is nothing available on queue
                            queueAdapter.dequeue(function (err, reservedJobB, commitJobB, rollbackJobB) {
                                assert.equal(reservedJobB, null, 'expected no item available from queue');
                                done();
                            });
                        });
                    });
                }
            });
        });
        it('dequeue (with rollback) makes item available to another dequeue', function (done) {
            getQueueAdapter(function (queueAdapter) {

                const jobRequestA = createSampleJobRequest('a');
                queueAdapter.enqueue(jobRequestA, afterEnqueueCallback);

                function afterEnqueueCallback(err, jobRequest) {
                    //at this point jobRequestA is in queue
                    queueAdapter.dequeue(function (err, reservedJobA, commitJobA, rollbackJobA) {
                        //at this point, no item on queue and jobRequestA is in reserved state
                        assert.ok(reservedJobA, 'expected an item to be reserved from queue');
                        assert.equal(reservedJobA.ref, 'a');

                        rollbackJobA(function () {
                            //item rollbacked to queue

                            //if we dequeue at this point, we should get jobRequestA again
                            queueAdapter.dequeue(function (err, reservedJobA2, commitJobA2, rollbackJobA2) {
                                assert.ok(reservedJobA2, 'expected an item to be reserved from queue');
                                assert.equal(reservedJobA2.ref, 'a');
                                done();
                            });
                        });
                    });
                }
            });
        });
        it('ensure support for two no-committed dequeue', function (done) {
            //TODO: holy callbacks, batman.  Switch this to promises.
            //Update: i tried out promises.  And it worked better, but it does have an odd play with
            //how to handle the callbacks on commit() and rollback() that would need to be overcome
            //would need to decide between explicitly switching to promises or using bluebird.promisfy

            getQueueAdapter(function (queueAdapter) {
                const jobRequestA = createSampleJobRequest('a');
                queueAdapter.enqueue(jobRequestA, function () {
                    const jobRequestB = createSampleJobRequest('b');
                    queueAdapter.enqueue(jobRequestB, function () {
                        const jobRequestC = createSampleJobRequest('c');
                        queueAdapter.enqueue(jobRequestC, function () {

                            //at this point there should be three items in the queue

                            queueAdapter.dequeue(function (err, reservedJobA, commitJobA, rollbackJobA) {
                                //expected state: jobA reserved, jobB and jobC on queue
                                assert.ok(reservedJobA, 'expected an item to be reserved from queue');
                                assert.equal(reservedJobA.ref, 'a');

                                queueAdapter.dequeue(function (err, reservedJobB, commitJobB, rollbackJobB) {
                                    //expected state: jobA and jobB reserved, jobC on queue
                                    assert.ok(reservedJobB, 'expected an item to be reserved from queue');
                                    assert.equal(reservedJobB.ref, 'b');

                                    queueAdapter.dequeue(function (err, reservedJobC, commitJobC, rollbackJobC) {
                                        //expected state: jobA, jobB, and jobC reserved
                                        assert.ok(reservedJobC, 'expected an item to be reserved from queue');
                                        assert.equal(reservedJobC.ref, 'c');

                                        rollbackJobB(function () {
                                            //job B rollbacked to queue
                                            //expected state: jobA and jobC reserved, jobB on queue

                                            //if we dequeue at this point, we should get jobB again
                                            queueAdapter.dequeue(function (err, reservedJobB2, commitJobB2, rollbackJobB2) {
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
    });
    describe('expiration', function () {
        it('if expiration is set to 1 sec in future and requested before then, it will be processed normally', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request = createSampleJobRequest('r');
                request.expiration = moment().add(1, 'y').toDate();
                queueAdapter.enqueue(request, function () {
                    queueAdapter.dequeue(function (err, reservedAttempt, commitJob1, rollbackJob1) {
                        assert.equal(reservedAttempt.ref, 'r');
                        done();
                    });
                });
            });
        });
        it('if expiration is set to future and requested after then, it will be not be processed', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request = createSampleJobRequest('r');
                request.expiration = moment().add(1000, 'ms').toDate();
                setTimeout(function () {
                    queueAdapter.enqueue(request, function () {
                        queueAdapter.dequeue(function (err, reservedAttempt, commitJob1, rollbackJob1) {
                            // assert.equal(reservedAttempt, null, 'expected to NOT dequeue an item');
                            assert.equal(reservedAttempt, null);
                            done();
                        });
                    });
                }, 1000);
            });
        });
        it('with two items, expired item will be skipped to get to non-expired item', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const requestExpired = createSampleJobRequest('expired');
                requestExpired.expiration = moment().subtract(1, 'y').toDate();

                const requestNotExpired = createSampleJobRequest('not expired');
                requestNotExpired.expiration = moment().add(1, 'y').toDate();

                queueAdapter.enqueue(requestExpired, function () {
                    queueAdapter.enqueue(requestNotExpired, function () {
                        queueAdapter.dequeue(function (err, reservedAttempt, commitJob1, rollbackJob1) {
                            assert.equal(reservedAttempt.ref, 'not expired');
                            done();
                        });
                    });
                });
            });
        });
    });
    describe('delay', function () {
        it('if delay is set to 1 year in future it cannot be dequeued now', function (done) {
            getQueueAdapter(function (queueAdapter) {
                var request = createSampleJobRequest('delayed item');
                request.delay = moment().add(1, 'y').toDate();
                queueAdapter.enqueue(request, function () {
                    queueAdapter.dequeue(function (err, reservedAttempt1, commitJob1, rollbackJob1) {
                        assert.equal(reservedAttempt1, null, 'expected to not get an item as it should be delayed at this point');
                        done();
                    });
                });
            });
        });
        it('if delay is set to 1 sec in future it will be dequeued after 1s', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request = createSampleJobRequest('delayed item');
                request.delay = moment().add(500, 'ms').toDate();
                queueAdapter.enqueue(request, function () {
                    setTimeout(function () {
                        queueAdapter.dequeue(function (err, reservedAttempt1, commitJob1, rollbackJob1) {
                            assert.equal(reservedAttempt1.ref, 'delayed item');
                            done();
                        });
                    }, 500);
                });
            });
        });
        it('if delay is set to future, the first attempt to dequeue will come up empty, but will be dequeued after delay', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request = createSampleJobRequest('delayed item');
                request.delay = moment().add(500, 'ms').toDate();
                queueAdapter.enqueue(request, function () {
                    queueAdapter.dequeue(function (err, reservedAttempt1, commitJob1, rollbackJob1) {
                        assert.equal(reservedAttempt1, null);
                        setTimeout(function () {
                            queueAdapter.dequeue(function (err, reservedAttempt2, commitJob2, rollbackJob2) {
                                assert.equal(reservedAttempt2.ref, 'delayed item');
                                done();
                            });
                        }, 500);
                    });
                });
            });
        });
    });
    describe('priority', function () {
        const low_priority = 10;
        const high_priority = 1;

        it('insert item without priority does not cause issue', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request1 = createSampleJobRequest('apple');
                const request2 = createSampleJobRequest('banana');

                queueAdapter.enqueue(request1, function () {
                    queueAdapter.enqueue(request2, function () {
                        queueAdapter.dequeue(function (err, reservedAttempt1, commitJob1, rollbackJob1) {
                            assert.equal(reservedAttempt1.ref, 'apple');
                            queueAdapter.dequeue(function (err, reservedAttempt2, commitJob2, rollbackJob2) {
                                assert.equal(reservedAttempt2.ref, 'banana');
                                done();
                            });
                        });
                    });
                });
            });
        });
        it('insert two items with same priority, should pop in same order', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request1 = createSampleJobRequest('apple', low_priority);
                const request2 = createSampleJobRequest('banana', low_priority);

                queueAdapter.enqueue(request1, function () {
                    queueAdapter.enqueue(request2, function () {
                        queueAdapter.dequeue(function (err, reservedAttempt1, commitJob1, rollbackJob1) {
                            assert.equal(reservedAttempt1.ref, 'apple');
                            queueAdapter.dequeue(function (err, reservedAttempt2, commitJob2, rollbackJob2) {
                                assert.equal(reservedAttempt2.ref, 'banana');
                                done();
                            });
                        });
                    });
                });
            });
        });
        it('insert low priority, then high priorty, should pop high priority first', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request1 = createSampleJobRequest('apple', low_priority);
                const request2 = createSampleJobRequest('banana', high_priority);

                queueAdapter.enqueue(request1, function () {
                    queueAdapter.enqueue(request2, function () {
                        queueAdapter.dequeue(function (err, reservedAttempt1, commitJob1, rollbackJob1) {
                            assert.equal(reservedAttempt1.ref, 'banana');
                            queueAdapter.dequeue(function (err, reservedAttempt2, commitJob2, rollbackJob2) {
                                assert.equal(reservedAttempt2.ref, 'apple');
                                done();
                            });
                        });
                    });
                });
            });
        });
        it('insert high priority, then low priorty, should pop high priority first', function (done) {
            getQueueAdapter(function (queueAdapter) {
                const request1 = createSampleJobRequest('apple', high_priority);
                const request2 = createSampleJobRequest('banana', low_priority);

                queueAdapter.enqueue(request1, function () {
                    queueAdapter.enqueue(request2, function () {
                        queueAdapter.dequeue(function (err, reservedAttempt1, commitJob1, rollbackJob1) {
                            assert.equal(reservedAttempt1.ref, 'apple');
                            queueAdapter.dequeue(function (err, reservedAttempt2, commitJob2, rollbackJob2) {
                                assert.equal(reservedAttempt2.ref, 'banana');
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
});
