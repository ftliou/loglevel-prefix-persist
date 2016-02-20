
var _ = require('lodash');

var DEFAULT_SERVER_LOG_LEVEL = 'info';
var DEFAULT_CLIENT_LOG_LEVEL = 'info';

function isValidLevel(level) {
    return _.isString(level) && /^(trace|debug|info|warn|error)$/i.test(level);
}

module.exports.getLogLevel = function(env, cfg, isServer) {

    var type = isServer ? 'server' : 'client';
    var level = (isServer ? DEFAULT_SERVER_LOG_LEVEL : DEFAULT_CLIENT_LOG_LEVEL); 

    _.some([['level', env || 'development', type], ['level', env || 'development'], ['level']], function(entry) {
        if (_.has(cfg, entry)) {
            var val = _.get(cfg, entry);
            if (isValidLevel(val)) {
                level = val.toLowerCase();
                return true;
            }
        }
    });
    return level;
}


module.exports.getPersistence = function(cfg, isServer, defaultLevel) {

    var type = isServer ? 'server' : 'client';
    var persistLevel = (isServer ? defaultLevel : false); 

    _.some([['persist', type], ['persist']], function(entry) {
        if (_.has(cfg, entry)) {
            var val = _.get(cfg, entry);
            if (_.isBoolean(val)) {
                if (val) {
                    persistLevel = defaultLevel;
                }
                else {
                    persistLevel = false;
                }
                return true;
            }
            if (isValidLevel(val)) {
                persistLevel = val.toLowerCase();
                return true;
            }
        }
    });
    return persistLevel;
}

