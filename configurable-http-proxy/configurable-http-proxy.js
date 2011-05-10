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

exports.Constants.INTERCEPTOR_STATUS = {
	HEADER_MODIFIED: 1,
	CONTENT_MODIFIED: 2,
}

exports.Constants.INTERCEPTOR_OPTIONS = {
	MAKE_OUTGOING_REQUEST: 1,
	IGNORE_FURTHER_INTERCEPTORS: 2,
	IGNORE_NEXT_BEFORE_INTERCEPTORS: 4,
	IGNORE_NEXT_AFTER_INTERCEPTORS: 8
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
        	var curStage = 	this.currentStage(), 
				cancelProcessingStage = exports.Constants.INTERCEPTOR_OPTIONS["IGNORE_NEXT_" + curStage.toUpperCase() + "_INTERCEPTORS"];

		for (i = 0, m = this[curStage + "Interceptors"].length; i < m; i++) {
			            
			var action = this[curStage + "Interceptors"][i];
			
			action(req, res, policy_req, curStage);
          		policy_req.interceptors_executed.push(action);

            		if (policy_req.options.has(cancelProcessingStage)) {
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
	this.status  = new exports.BitField();
	this.options = new exports.BitField();
	this.options.set(exports.Constants.INTERCEPTOR_OPTIONS.MAKE_OUTGOING_REQUEST);
	this.interceptors_executed = [];
};

exports.ProxyPolicyRequest.prototype = {
};

exports.BitField = function() {
	this.field = 0;
};

exports.BitField.prototype = {
	has: function(_flag) {
		return this.field & _flag;
	},

	set: function(_flag) {
		this.field |= _flag;
	}
};

exports.ProxyConfiguration = function(_defaultPolicy) {
	this.policies = [];

	if (typeof(_defaultPolicy) == 'object') {
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
l = function(s) {
console.log(s);
}
exports.ConfigurableProxy = function(proxyPolicyConfiguration) {
	// make this context available in proxyRequestHandler
	var self = this;
	this.proxyPolicyConfiguration = proxyPolicyConfiguration;
	this.proxyInstance = null;

	this.proxyRequestHandler = function(req, res, proxy) {
		var buffer = proxy.buffer(req);
//l(req)
		var usedPolicy = self.proxyPolicyConfiguration.defaultPolicy;
		var policy_request = new exports.ProxyPolicyRequest();
		policy_request.host = req.headers.host;
		for (var i = 0, m = self.proxyPolicyConfiguration.policies.length; i < m; i++) {
		    if (policy.match(req, res, proxy)) {
		        usedPolicy = policy;
		        break;
		    }
		}
		usedPolicy.process(req, res, policy_request);
		
		// performance: if already this option is defined, ignore next stage
		if (!policy_request.options.has(exports.Constants.INTERCEPTOR_OPTIONS.IGNORE_NEXT_AFTER_INTERCEPTORS)) {
			self.proxyInstance.on('end', function() {
				usedPolicy.nextStage().process(req, res, policy_request).reset();
			});
		}
		
		// Pass request to proxy backend
		if (policy_request.options.has(exports.Constants.INTERCEPTOR_OPTIONS.MAKE_OUTGOING_REQUEST)) {
			proxy.proxyRequest(req, res, policy_request);

		}

	};

	this.start = function(port) {
		(self.proxyInstance = httpProxy.createServer(this.proxyRequestHandler)).listen(port);
	};
	
	this.close = function() {
		self.proxyInstance.close();
	};
};
