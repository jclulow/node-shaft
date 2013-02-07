# node-shaft

Who's the framed, binary networking protocol that's so simple you could
implement it in just about any language?

_node-shaft!_

You're damn right.

## Protocol Overview

Messages are sent over a reliable byte stream (e.g. TCP).  The protocol is a
stream of frames.  All integer types are big endian.  Each frame looks like
this:

```
        |========|==========|==============================|
        | offset | type     | field                        |
        |========|==========|==============================|
        |      0 | uint16_t | message_type                 |
        |--------|----------|------------------------------|
        |      2 | uint16_t | message_length               |
        |        |          | (not including the header)   |
        |--------|----------|------------------------------|
        |      4 | byte[]   | message_payload              |
        |        |          | (arbitrary contents allowed, |
        |        |          |  length specified as         |
        |        |          |  message_length)             |
        |--------|----------|------------------------------|
```

### Reserved Message Types

Message IDs from `0xf000` up to `0xffff` are reserved for use by the protocol
implementation.  Consumers may send messages of any other type.

## License

MIT.
