/*
    Heavily inspired by the original js library copyright Mixpanel, Inc.
    (http://mixpanel.com/)

    Modifications by Carl Sverre
*/

var http            = require('http'),
    querystring     = require('querystring'),
    Buffer          = require('buffer').Buffer;

var client = function(token) {
    var metrics = {};
    
    if(!token) {
        throw new Error("The Mixpanel Client needs a Mixpanel token");
    }
    
    metrics.config = {
        test: false,
        debug: false,
        track_endpoint_path: "/track",
        email_endpoint_path: "/email"
    };
    
    metrics.token = token;
    
    // private utility function
    var get_unixtime = function() {
        return parseInt(new Date().getTime().toString().substring(0,10), 10);
    };
    
    /**
        send_track_request(data)
        ---
        this function sends an async GET request to mixpanel
        
        data:object                     the data to send in the request
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.send_track_request = function(data, callback) {
        callback = callback || function() {};
        var event_data = new Buffer(JSON.stringify(data));
        var request_data = {
            'data': event_data.toString('base64'),
            'ip': 0
        };
        
        var request_options = {
            host: 'api.mixpanel.com',
            port: 80,
            headers: {}
        };
    
        if (metrics.config.test) { request_data.test = 1; }
        
        var url = metrics.config.track_endpoint_path;
        var query = querystring.stringify(request_data);
        
        request_options.path = [url,"?",query].join("");
        
        http.get(request_options, function(res) {
            var data = "";
            res.on('data', function(chunk) {
               data += chunk;
            });
            
            res.on('end', function() {
                var e = (data != '1') ? new Error("Mixpanel Server Error: " + data) : undefined;
                callback(e);
            });
        }).on('error', function(e) {
            if(metrics.config.debug) {
                console.log("Got Error: " + e.message);
            }
            callback(e);
        });
    };
    
    /**
        send_email_request(data)
        ---
        this function sends an async POST request to mixpanel
        
        data:object                                    the data to send in the request
        callback:function(err:Error, modified_body)    callback is called when the request is
                                                       finished or an error occurs
    */
    metrics.send_email_request = function(data, callback) {
        callback = callback || function() {};
    
        // Mixpanel's docs don't actually say this is supported for email.
        if (metrics.config.test) { data.test = 1; }
        
        var post_data = querystring.stringify(data);
        
        var request_options = {
            host: 'api.mixpanel.com',
            path: metrics.config.email_endpoint_path,
            port: 80,
            method: 'POST',
            headers: {
               'Content-Type': 'application/x-www-form-urlencoded',
               'Content-Length': post_data.length
            }
        };
        
        req = http.request(request_options, function(res) {
            var data = "";
            res.on('data', function(chunk) {
               data += chunk;
            });
            
            res.on('end', function() {
                callback(null, data);
            });
        });
        req.on('error', function(e) {
            if(metrics.config.debug) {
                console.log("Got Error: " + e.message);
            }
            callback(e);
        });
        req.write(post_data);
        req.end();
    };
    
    /**
        track(event, properties, callback)
        ---
        this function sends an event to mixpanel
        
        event:string                    the event name
        properties:object               additional event properties to send
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.track = function(event, properties, callback) {
        if (!properties) { properties = {}; }
        if (!properties.token) { properties.token = metrics.token; }
        if (!properties.time) { properties.time = get_unixtime(); }

        var data = {
            'event' : event,
            'properties' : properties
        };
        
        if(metrics.config.debug) {
            console.log("Sending the following event to Mixpanel:");
            console.log(data);
        }
        
        metrics.send_track_request(data,callback);
    };

    /**
        track_funnel(funnel, step, goal, properties, callback)
        ---
        this function tracks a specific step in a funnel
        
        NOTE: this is not the recommended way of using funnels, use events
        and the funnel creator in the web interface instead
        
        funnel:string                   the funnel name
        step:int                        the step number
        goal:string                     the name of the step
        properties:object               additional event properties to send
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.track_funnel = function(funnel, step, goal, properties, callback) {
        if(!properties) { properties = {}; }
        
        properties.funnel = funnel;
        properties.step = step;
        properties.goal = goal;
        
        metrics.track('mp_funnel', properties, callback);
    };
    
    /**
        email(campaign, distinct_id, body, properties, callback)
        ---
        this function sends an email to mixpanel for instrumentation
        see http://mixpanel.com/api/docs/guides/email-analytics
        
        campaign:string                 the campaign name
        distinct_id:string              unique identifier for the user
        body:string                     message body of the email
        options:object                  optional parameters (see link for details)
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.email = function(campaign, distinct_id, body, options, callback) {
        if (!options) { options = {}; }
        if (!options.token) { options.token = metrics.token; }
        options.campaign = campaign;
        options.distinct_id = distinct_id;
        options.body = body;
        if (options.properties && typeof options.properties === 'object') {
            options.properties = new Buffer(JSON.stringify(options.properties)).toString('base64');
        }
        
        if (metrics.config.debug) {
            console.log("Sending the following email to Mixpanel:");
            console.log(options);
        }
        
        metrics.send_email_request(options, callback);
    };
    
    /**
        set_config(config)
        ---
        Modifies the mixpanel config
        
        config:object       an object with properties to override in the
                            mixpanel client config
    */
    metrics.set_config = function(config) {
        for (var c in config) {
            if (config.hasOwnProperty(c)) {
                metrics.config[c] = config[c];
            }
        }
    };
    
    return metrics;
};

// module exporting
module.exports = {
    Client: client
};
