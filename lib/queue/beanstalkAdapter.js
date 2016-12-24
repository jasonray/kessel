var fivebeansClient = require('fivebeans').client;
var _ = require('underscore');
var LogManager = require('../logManager');
const NO_ERROR = null;
var events = require('events');
var util = require('util');


function BeanstalkAdapter() {
    var self = this;

    var config = {
        beanstalk: {
            host: 'x127.0.0.1',
            port: '3000'
        }
    }

    var logManager = new LogManager();
    self.logger = logManager.getLogger('beanstalk-adapter');

    self.host = config.beanstalk.host;
    self.port = config.beanstalk.port;
}
util.inherits(BeanstalkAdapter, events.EventEmitter);


BeanstalkAdapter.prototype.initialize = function (callback) {
    var self = this;

    self.logger.trace('initialize adapter');

    self.client = new fivebeansClient(self.host, self.port);
    self.logger.debug('connecting to beanstalkd at ' + self.host + ':' + self.port);
    self.client.on('connect', self._onConnect);
    self.client.connect();
};

BeanstalkAdapter.prototype._onConnect = function () {
    var self = this;
    self.logger.debug('connected to beanstalkd at ' + self.host + ':' + self.port);
};

BeanstalkAdapter.prototype._onError = function (err) {
    var self = this;
    self.logger.error('error occurred');
    self.logger.error(err);
};

BeanstalkAdapter.prototype._onClose = function () {
    var self = this;
    self.logger.debug('client disconnected');
};

// BeanstalkAdapter.prototype.enqueue = function (jobRequest, callback) {
//     var self = this;
//     setTimeout(function () {
//         self.queue.push(jobRequest);
//         if (_.isFunction(callback)) {
//             callback(NO_ERROR, jobRequest)
//         }
//     }, self.latency)
// };
//
// BeanstalkAdapter.prototype.dequeue = function (callbackToConsumer) {
//     var self = this;
//     setTimeout(function () {
//         var jobRequest = self.queue.pop();
//
//         if (_.isEmpty(jobRequest)) {
//             callbackToConsumer();
//         } else {
//             var commitCallback = function (commitComplete) {
//                 if (_.isFunction(commitComplete)) {
//                     commitComplete();
//                 }
//             };
//             var rollbackCallback = function (rollbackComplete) {
//                 self.enqueue(jobRequest);
//                 if (_.isFunction(rollbackComplete)) {
//                     rollbackComplete();
//                 }
//             };
//
//             callbackToConsumer(jobRequest, commitCallback, rollbackCallback);
//         }
//     }, self.latency);
// };

module.exports = BeanstalkAdapter;
