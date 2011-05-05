var httpProxy = require('http-proxy');

Object.spawn = function (parent, props) {
  var defs = {}, key;
  for (key in props) {
    if (props.hasOwnProperty(key)) {
      defs[key] = {value: props[key], enumerable: true};
    }
  }
  return Object.create(parent, defs);
};

/** Constants */
exports.Constants = function() {
}

exports.Constants.INTERCEPTOR_FLAGS = {
	HEADER_MODIFIED: 1,
	CONTENT_MODIFIED: 2,
}
exports.Constants.INTERCEPTOR_OPTIONS = {
	IGNORE_FURTHER_INTERCEPTORS: 0
}

/** Chain **/
exports.Chain = function(match_function) {
	if (match_function) {
		this.match = match_function;
	}

	this.afterInterceptors = [];
	this.beforeInterceptors = [];
	this.current_stage = 0;
	this.stages = ['before', 'after'];
};

exports.Chain.prototype = {
	before: function(action) {
		if (typeof(action) != 'function') {
			throw Error("only functions are allowed");
		}

		this.beforeInterceptors.push(action);
        return this;
	},

	after: function(action) {
		if (typeof(action) != 'function') {
			throw Error("only functions are allowed");
		}

		this.afterInterceptors.push(action);
        return this;
	},
    
    process: function(req, res, policy_req) {
		if (policy_req == undefined) {
			policy_req = new ProxyPolicyConfiguration();
		}

        // make parameters available in forEach
        var curStage = this.currentStage();

		for (i = 0, m = this[curStage + "Interceptors"].length; i < m; i++) {
			            
			var action = this[curStage + "Interceptors"][i], 
				r = action(req, res, policy_req, curStage);

            policy_req.interceptors_executed.push(action);

            if (r === exports.Constants.INTERCEPTOR_OPTIONS.IGNORE_FURTHER_INTERCEPTORS) {
                break;
            }
        };
        
        return this;
    },
    
	nextStage: function() {
        if (++(this.current_stage) == this.stages.length) {
            throw Error("Invalid call of nextStage. No more stages available");
        }
        
        return this;
	},
	
	currentStage: function() {
		return this.stages[this.current_stage];
	},

	clear: function() {
		this.afterInterceptors = [];
		this.beforeInterceptors = [];
	},

	reset: function() {
		this.current_stage = 0;
	},
};

/** ProxyPolicyRequest */
exports.ProxyPolicyRequest = function() {
    this.flags = 0;
    this.interceptors_executed = [];
};

exports.ProxyConfiguration = function(_defaultPolicy) {
    this.policies = [];

	if (typeof(_defaultPolicy) == 'function') {
		this.defaultPolicy = _defaultPolicy;
	} 
	else {
		this.defaultPolicy = new exports.Chain(function(req, res) {
	        return true;
	    });
	}
};


/*
ProxyConfiguration.policies.push(Object.spawn(Chain, {
    match: function(req, res) {
       return (req.headers.host.indexOf("www.spiegel.de") >= 0);
    }
})
.before(function(req, res, proxy) {
        console.log("Found spiegel.de");
})
.after(function(req, res, proxy) {
    console.log("Response: " + res);
}));
*/

exports.ConfigurableProxy = function(httpProxyInstance, proxyPolicyConfiguration) {
	this.httpProxy = httpProxyInstance;
	this.proxyPolicyConfiguration = proxyPolicyConfiguration;

	this.proxyRequestHandler = function(req, res, proxy) {
		var buffer = proxy.buffer(req);
		var usedPolicy = this.proxyPolicyConfiguration.defaultPolicy;
		var policy_request = Object.spawn(exports.ProxyPolicyRequest, {
		    host: req.headers.host
		});

		for (var i = 0, m = this.proxyPolicyConfiguration.policies.length; i < m; i++) {
		    if (policy.match(req, res, proxy)) {
		        usedPolicy = policy;
		        break;
		    }
		};
		    
		usedPolicy.process(req, res, policy_request);
		proxy.proxyRequest(req, res, policy_request);
		usedPolicy.nextStage().process(req, res, policy_request).reset();
	};

	this.start = function(port) {
		this.httpProxy.createServer(proxyRequestHandler).listen(port);
	};
}

