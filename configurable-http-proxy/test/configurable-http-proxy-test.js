var 	vows = require('vows'),
	assert = require('assert');

var cfgProxyServer = require('../configurable-http-proxy.js');
var	Chain = cfgProxyServer.Chain,
	ProxyPolicyRequest = cfgProxyServer.ProxyPolicyRequest,
	Constants = cfgProxyServer.Constants,
	ProxyConfiguration = cfgProxyServer.ProxyConfiguration;

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
			'it must end if IGNORE_FURTHER_CHAINS is defined': function(chain) {
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
					pr.flags = Constants.INTERCEPTOR_FLAGS.HEADER_MODIFIED; 
					return Constants.INTERCEPTOR_OPTIONS.IGNORE_FURTHER_INTERCEPTORS;
				};
				var third = function() { throw Error("Third method not allowed!"); };

				chain.before(first).before(second).before(third);
				chain.after(function() { throw Error("after stage is not called!"); });

				var pr = new ProxyPolicyRequest();

				chain.process("req", "res", pr);

				assert.equal(pr.interceptors_executed.length, 2);
				assert.equal(pr.interceptors_executed[1], second);
				assert.equal(pr.flags, Constants.INTERCEPTOR_FLAGS.HEADER_MODIFIED);
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
		'must change the request': function(server) {
		},
		'must change the response': function(server) {
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
