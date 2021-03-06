'use strict';

var test = require('tape');
var setTimeout = require('timers').setTimeout;

var UDPServer = require('./lib/udp-server.js');
var StatsdClient = require('../statsd.js');

var PORT = 8125;

test('can write gauge to client', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            host: 'localhost',
            port: PORT,
            packetQueue: { flush: 10 }
        });

        client.gauge('foo', 'bar');
        server.once('message', function (msg) {
            assert.equal(msg.toString(), 'foo:bar|g');

            server.close();
            client.close();
            assert.end();
        });
    });
});

test('respects isDisabled', function t(assert) {
    var isDisabledBool = false;
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            host: 'localhost',
            port: PORT,
            packetQueue: { flush: 10 },
            isDisabled: function isDisabled() {
                return isDisabledBool;
            }
        });

        server.once('message', onMessage);
        client.counter('foo', 1);

        function onMessage(msg) {
            assert.equal(msg.toString(), 'foo:1|c\n');

            isDisabledBool = true;
            server.on('message', failure);
            client.counter('foo', 1);

            setTimeout(next, 100);

            function failure() {
                assert.ok(false, 'unexpected message');
            }

            function next() {
                isDisabledBool = false;
                server.removeListener('message', failure);

                server.once('message', onMessage2);
                client.counter('foo', 1);
            }

            function onMessage2(msg) {
                assert.ok(String(msg));

                end();
            }
        }

        function end() {
            client.close();
            server.close();
            assert.end();
        }
    });
})

test('can write timing to client', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            host: 'localhost',
            port: PORT,
            packetQueue: { flush: 10 }
        });

        client.counter('foo', 1);
        server.once('message', function (msg) {
            assert.equal(msg.toString(), 'foo:1|c\n');

            server.close();
            client.close();
            assert.end();
        });
    });
});

test('can write with prefix', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            prefix: 'bar',
            packetQueue: { flush: 10 }
        });

        client.timing('foo', 42);
        server.once('message', function (msg) {
            assert.equal(msg.toString(), 'bar.foo:42|ms\n');

            server.close();
            client.close();
            assert.end();
        });
    });
})

test('can write with prefix trailing dot', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            prefix: 'bar.',
            packetQueue: { flush: 10 }
        });

        client.timing('foo', 42);
        server.once('message', function (msg) {
            assert.equal(msg.toString(), 'bar.foo:42|ms\n');

            server.close();
            client.close();
            assert.end();
        });
    });
});

test('can write with child prefix', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            prefix: 'bar.',
            packetQueue: { flush: 10 }
        });

        client = client.getChildClient('baz');

        client.timing('foo', 42);
        server.once('message', function (msg) {
            assert.equal(msg.toString(), 'bar.baz.foo:42|ms\n');

            server.close();
            client.close();
            assert.end();
        });
    });
});


test('can write counter to client', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient();

        client.timing('foo', 42);
        client._ephemeralSocket._queue._sendPacket();
        server.once('message', function (msg) {
            assert.equal(msg.toString(), 'foo:42|ms\n');

            server.close();
            client.close();
            assert.end();
        });
    });
});

test('client.counter()', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var sock = new StatsdClient({
            host: 'localhost',
            port: PORT,
            packetQueue: { flush: 10 }
        });

        server.once('message', onMessage);
        sock.counter('hello', 10);

        function onMessage(msg) {
            var str = String(msg);
            assert.equal(str, 'hello:10|c\n');

            sock.close();
            server.close();
            assert.end();
        }
    });
});

test('client.increment()', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var sock = new StatsdClient({
            host: 'localhost',
            port: PORT,
            packetQueue: { flush: 10 }
        });

        server.once('message', onMessage);
        sock.increment('hello');

        function onMessage(msg) {
            var str = String(msg);
            assert.equal(str, 'hello:1|c\n');

            sock.close();
            server.close();
            assert.end();
        }
    });
});

test('client.decrement()', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var sock = new StatsdClient({
            host: 'localhost',
            port: PORT,
            packetQueue: { flush: 10 }
        });

        server.once('message', onMessage);
        sock.decrement('hello');

        function onMessage(msg) {
            var str = String(msg);
            assert.equal(str, 'hello:-1|c\n');

            sock.close();
            server.close();
            assert.end();
        }
    });
});

test('client.gauge()', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var sock = new StatsdClient({
            host: 'localhost',
            port: PORT,
            packetQueue: { flush: 10 }
        });

        server.once('message', onMessage);
        sock.gauge('hello', 10);

        function onMessage(msg) {
            var str = String(msg);
            assert.equal(str, 'hello:10|g');

            sock.close();
            server.close();
            assert.end();
        }
    });
});

test('client.immediateCounter()', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var sock = new StatsdClient({
            host: 'localhost',
            port: PORT
        });

        var messageSent = false;
        server.once('message', onMessage);
        sock.immediateCounter('hello', 10, function onCompleteSending() {
            messageSent = true;
        });

        function onMessage(msg) {
            var str = String(msg);
            assert.equal(str, 'hello:10|c');
            assert.equal(messageSent, true);
            sock.close();
            server.close();
            assert.end();
        }
    });
});

test('client.immediateIncrement()', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var sock = new StatsdClient({
            host: 'localhost',
            port: PORT
        });

        var messageSent = false;
        server.once('message', onMessage);
        sock.immediateIncrement('hello', null, function onCompleteSending() {
            messageSent = true;
        });

        function onMessage(msg) {
            var str = String(msg);
            assert.equal(str, 'hello:1|c');
            assert.equal(messageSent, true);
            sock.close();
            server.close();
            assert.end();
        }
    });
});

test('client.immediateDecrement()', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var sock = new StatsdClient({
            host: 'localhost',
            port: PORT
        });

        var messageSent = false;
        server.once('message', onMessage);
        sock.immediateDecrement('hello', null, function onCompleteSending() {
            messageSent = true;
        });

        function onMessage(msg) {
            var str = String(msg);
            assert.equal(str, 'hello:-1|c');
            assert.equal(messageSent, true);
            sock.close();
            server.close();
            assert.end();
        }
    });
});

test('client.immediateGauge()', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var sock = new StatsdClient({
            host: 'localhost',
            port: PORT
        });

        var messageSent = false;
        server.once('message', onMessage);
        sock.immediateGauge('hello', 10, function onCompleteSending() {
            messageSent = true;
        });

        function onMessage(msg) {
            var str = String(msg);
            assert.equal(str, 'hello:10|g');
            assert.equal(messageSent, true);

            sock.close();
            server.close();
            assert.end();
        }
    });
})

test('client.immediateTiming() with Date', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            prefix: 'bar'
        });

        var messageSent = false;
        client.immediateTiming('foo', new Date(), function onCompleteSending() {
            messageSent = true;
        });
        server.once('message', function onMessage(msg) {
            var msgStr = msg.toString();
            assert.ok(msgStr === 'bar.foo:0|ms' ||
                msgStr === 'bar.foo:1|ms');
            assert.equal(messageSent, true);

            server.close();
            client.close();
            assert.end();
        });
    });
})


test('can write with DNS resolver', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            dnsResolver: {},
            packetQueue: { flush: 10 }
        });

        client.timing('foo', 42);
        server.once('message', function (msg) {
            assert.equal(msg.toString(), 'foo:42|ms\n');

            server.close();
            client.close();
            assert.end();
        });
    });
});

test('dnsResolver only resolves once', function t(assert) {
    var counter = 0;

    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            dnsResolver: {
                dns: {
                    lookup: function (hostname, cb) {
                        counter++;
                        process.nextTick(function onTick() {
                            cb(null, '127.0.0.1');
                        });
                    }
                }
            },
            packetQueue: { flush: 10 }
        });

        var client1 = client.getChildClient('p1');
        var client2 = client.getChildClient('p2');

        setTimeout(function fini() {

            client1.timing('foo', 42);
            client2.timing('foo', 43);
            server.once('message', function (msg) {
                assert.equal(
                    msg.toString(),
                    'p1.foo:42|ms\np2.foo:43|ms\n'
                );
                assert.equal(counter, 1);

                server.close();
                client.close();
                assert.end();
            });
        }, 50);
    });
});

test('client.timing() with Date', function t(assert) {
    var server = UDPServer({ port: PORT }, function onBound() {
        var client = new StatsdClient({
            prefix: 'bar',
            packetQueue: { flush: 10 }
        });

        client.timing('foo', new Date());
        server.once('message', function (msg) {
            var msgStr = msg.toString();
            assert.ok(msgStr === 'bar.foo:0|ms\n' ||
                msgStr === 'bar.foo:1|ms\n');

            server.close();
            client.close();
            assert.end();
        });
    });
})
