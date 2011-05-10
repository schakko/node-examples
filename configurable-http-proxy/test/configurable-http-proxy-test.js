var 	vows = require('vows'),
	assert = require('assert'),
	helpers = require('./helpers'),
	request = require('request');
var cfgProxyServer = require('../configurable-http-proxy.js');
var	Chain = cfgProxyServer.Chain,
	ProxyPolicyRequest = cfgProxyServer.ProxyPolicyRequest,
	Constants = cfgProxyServer.Constants,
	ProxyConfiguration = cfgProxyServer.ProxyConfiguration,
	runner = new helpers.TestRunner('http');

vows.describe('Configurable HTTP Proxy').addBatch({
	'A chain': {
		topic: new(Chain),
		'when added a non-function to before-action': {
			'results in an Exception': function(chain) {
				assert.throws(function() { chain.before("fail"); }, Error);
			}
		},
		'when added a non-function to after-action': {
			'results in an Exception': function(chain) {
				assert.throws(function() { chain.after("fail"); }, Error);
			}
		},
		'when added a valid function to before()': {
			topic: function(chain) {
				chain.before(function() { return "before"; });
				return chain;
			},

			'results in an existing function on stack': function(chain) {
				assert.equal(chain.beforeInterceptors.length, 1);
				assert.equal(chain.beforeInterceptors[0](), "before");
			}
		},
		'when added a valid function after()': {
			topic: function(chain) {
				chain.after(function() { return "after"; });
				return chain;
			},
			'results in an existing function on stack': function(chain) {
				assert.equal(chain.afterInterceptors.length, 1);
				assert.equal(chain.afterInterceptors[0](), "after");
			}
		},
		'when currentStage is first called': {
			topic: function(chain) {
				return chain;
			},
			'it returns `before`': function(chain) {
				assert.equal(chain.currentStage(), 'before');
			}
		},
		'when nextStage is called': {
			'currentStage returns at first `after`': function(chain) {
				assert.equal(chain.nextStage().currentStage(), 'after');
			},
			'currentStage throws exception after second call': function(chain) {
				assert.throws(function() {chain.nextStage();}, Error);
			}
		},
		'when chain is processed': {
			'it must end if IGNORE_NEXT_BEFORE_INTERCEPTORS is defined': function(chain) {
				chain.clear();
				chain.reset();
				var first = function(req, res, pr, cur) {
					assert.equal(req, "req"); 
					assert.equal(res, "res");
					assert.equal(pr.interceptors_executed.length, 0);
					assert.equal(cur, "before");
				};
				var second = function(req, res, pr) {
					assert.equal(pr.interceptors_executed[0], first);
					pr.status.set(Constants.INTERCEPTOR_STATUS.HEADER_MODIFIED); 
					pr.options.set(Constants.INTERCEPTOR_OPTIONS.IGNORE_NEXT_BEFORE_INTERCEPTORS);	
				};
				var third = function() { throw Error("Third method not allowed!"); };

				chain.before(first).before(second).before(third);
				chain.after(function() { throw Error("after stage is not called!"); });

				var pr = new ProxyPolicyRequest();

				chain.process("req", "res", pr);

				assert.equal(pr.interceptors_executed.length, 2);
				assert.equal(pr.interceptors_executed[1], second);
				assert.equal(pr.status.has(Constants.INTERCEPTOR_STATUS.HEADER_MODIFIED), true);
			},
		}
	},
	'A proxy configuration': {
		topic: new(ProxyConfiguration),
		 'has a default policy': function(topic) {
			assert.equal(topic.policies.length, 0);
			assert.equal(topic.defaultPolicy.match(), true);
		},
	}
})
.addBatch({
	'A configurable proxy': {
		topic: function() {
			runner.startTargetServer(8300, 'configurable proxy', this.callback);
		},
		'with before interceptor for blocking adverts by URL': {
			topic: function(targetServer) {
				var ppc = new ProxyConfiguration();
				var chain = new Chain(function(req, res) {
					if (req.url.indexof("adverts.com")) {
						return true;
					}

					return false;
				});
			
				chain.before(function(req, res, policy_req) {
					// block content, cause chain matched already adverts.com
					res.writeHead(999);
					res.end("ADVERT");
					policy_req.options.set(Constants.INTERCEPTOR_OPTIONS.IGNORE_NEXT_BEFORE_INTERCEPTORS);
				}).after(function(req, res, policy_req) {
					throw Error("after interceptor irregulary executed");
				});

				var ppc = new ProxyConfiguration(chain);
				var proxy = new cfgProxyServer.ConfigurableProxy(ppc);

				proxy.start(8310);
				runner.pushServer(proxy);
				return proxy;
			},
			'must block adverts': {
				topic: function(proxy, targetServer) {
					request({
						method: 'GET',
						uri: 'http://adverts.com:8300',
						proxy: 'http://localhost:8310',
						headers: {
							host: 'unknown.com',
						}
					}, this.callback);
				},
				"with HTTP response body `ADVERTS` and status code 999": function(err, res, body) {
					assert.equal('ADVERT', body);
					assert.equal(999, res.statusCode);
				},
			}
		},
		'must change the method type from GET to POST': function(targetServer) {
		},
		'must change the content of the server': function(targetServer) {
		},
		'must change the HTTP status code': function(targetServer) {
		},
	}
}).
addBatch({
  "When the tests are over": {
    topic: function () {
	return runner.closeServers();
    },
    "the servers should clean up": function () {
      assert.isTrue(true);
    }
  }
}).export(module);
