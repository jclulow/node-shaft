/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 */

var net = require('net');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var assert = require('assert');


var MAGIC = 'SHAFT';
var MAGICLEN = MAGIC.length;
var HDRLEN = 4; /* 2 lots of uint16_t */

var MSGTYPE_RESERVED_MIN = 0xf000;
var MSGTYPE_MAGIC = MSGTYPE_RESERVED_MIN + 1;

function
Shaft(conn)
{
	var self = this;
	EventEmitter.call(self);

	self._conn = conn;
	self._data = new Buffer(0);
	self._shutdown = false;
	self._seenmagic = false;

	self._conn.on('data', function(ch) {
		self._ingest(ch);
		self._process();
	});
	self._conn.once('end', function() {
		if (!self._shutdown)
			self.end();
	});

	/*
	 * Identify the strength of our character immediately.
	 */
	self._send_magic();
}
util.inherits(Shaft, EventEmitter);

Shaft.prototype._send_magic = function
shaft_send_magic()
{
	var buf = new Buffer(MAGIC, 'ascii');
	this._send_common(MSGTYPE_MAGIC, buf);
}

Shaft.prototype._send_common = function
shaft_send_common(type, buf)
{
	assert.ok(!this._shutdown);
	assert.ok(Buffer.isBuffer(buf), 'buf must be a buffer');
	assert.ok(buf.length <= 0xffff, 'cannot send Shaft payloads longer ' +
	    'than 65535 bytes');

	var hdr = new Buffer(HDRLEN);
	hdr.writeUInt16BE(type, 0);
	hdr.writeUInt16BE(buf.length, 2);

	this._conn.write(hdr);
	this._conn.write(buf);
}

Shaft.prototype.send = function
shaft_send(type, buf)
{
	assert.ok(type >= 0 && type < MSGTYPE_RESERVED_MIN, 'type must be ' +
	    'less than ' + MSGTYPE_RESERVED_MIN);

	return (this._send_common(type, buf));
}

Shaft.prototype.end = function
shaft_end()
{
	if (!this._shutdown) {
		this._shutdown = true;
		this._conn.end();
		this.emit('end');
	}
}

Shaft.prototype._ingest = function
shaft_ingest(buf)
{
	/*
	 * Pull buffer up:
	 */
	if (this._data.length > 0) {
		var _tmp = new Buffer(buf.length + this._data.length);
		this._data.copy(_tmp, 0);
		buf.copy(_tmp, this._data.length);
		this._data = _tmp;
	} else {
		this._data = buf;
	}
}

Shaft.prototype._process = function
shaft_process()
{
	for (;;) {
		/*
		 * Wait for at least one message header:
		 */
		if (this._data.length < HDRLEN)
			break;

		var msgtype = this._data.readUInt16BE(0);
		var msglen = this._data.readUInt16BE(2);

		/*
		 * Do we have at least one complete message?
		 */
		if (this._data.length < msglen + HDRLEN)
			break;

		/*
		 * If so, slice it out:
		 */
		var msgbuf = this._data.slice(HDRLEN, msglen + HDRLEN);
		this._data = this._data.slice(msglen + HDRLEN);

		switch (msgtype) {
		case MSGTYPE_MAGIC:
			if (msgbuf.length !== MAGICLEN ||
			    msgbuf.toString('ascii') !== MAGIC) {
				this.emit('fail', 'client magic not ok');
				this.end();
				return;
			} else {
				this._seenmagic = true;
			}
			break;
		default:
			if (!this._seenmagic) {
				this.emit('fail', 'client did not send magic');
				this.end();
				return;
			}
			this.emit('message', msgtype, msgbuf);
			msgbuf = null;
			break;
		}
	}
}


module.exports = {
	Shaft: Shaft
};

/* vim: set sts=8 ts=8 sw=8 noet: */
