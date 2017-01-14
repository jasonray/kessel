const _ = require('underscore');

class LogManager {
    constructor() {
        const self = this;

        self._bunyan = require('bunyan');
        self._rootLogName = 'root';
        self._loggers = {};
    }

    _createLogger(name) {
        const self = this;
        self._loggers[name] = self._bunyan.createLogger({
            name: name,
            streams: [{
                level: 'trace',
                stream: process.stdout
            }]
        });
    };

    getLogger(name) {
        const self = this;
        if (!self._doesLogExist(name)) self._createLogger(name);
        return self._loggers[name];

        function _doesLogExist(name) {
            return (!(_.isEmpty(this._loggers[name])));
        };

    };

}

module.exports = LogManager;