// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - jest.polyfills.js
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion

// jsdom's globalThis doesn't provide the fetch-API primitives MSW's node
// interceptors depend on (Response, Request, Headers, ReadableStream, ...).
// This must run via jest's `setupFiles` (before the test framework and
// setupFilesAfterEnv), per MSW's documented fix for jsdom test environments.
const { TextDecoder, TextEncoder } = require('node:util')
const { ReadableStream, WritableStream, TransformStream } = require('node:stream/web')
const { performance } = require('node:perf_hooks')
// Captured directly rather than relying on the ambient global: jsdom's
// globalThis doesn't define setImmediate, so a bare reference inside the
// shim classes below would fail once jsdom takes over globalThis.
const { setImmediate } = require('node:timers')

// node:worker_threads' MessageChannel/BroadcastChannel are backed by real
// native handles that never auto-unref, so once they're defined globally,
// react-dom's scheduler (which opts into MessageChannel when it exists) and
// MSW's server life-cycle emitter (which opens a BroadcastChannel on
// `server.listen()`) both keep the Jest process alive after tests finish.
// These lightweight in-process shims give both the API surface they need
// without holding any real handle - tests only ever run single-process, so
// no genuine cross-thread messaging is required.
class ShimMessagePort {
  constructor() {
    this._peer = null
    this.onmessage = null
    this._listeners = []
  }
  postMessage(data) {
    const peer = this._peer
    if (!peer) return
    setImmediate(() => {
      const event = { data }
      if (typeof peer.onmessage === 'function') peer.onmessage(event)
      for (const listener of peer._listeners) listener(event)
    })
  }
  addEventListener(type, listener) {
    if (type === 'message') this._listeners.push(listener)
  }
  removeEventListener(type, listener) {
    if (type !== 'message') return
    const index = this._listeners.indexOf(listener)
    if (index !== -1) this._listeners.splice(index, 1)
  }
  start() {}
  close() {
    this._peer = null
  }
}

class ShimMessageChannel {
  constructor() {
    this.port1 = new ShimMessagePort()
    this.port2 = new ShimMessagePort()
    this.port1._peer = this.port2
    this.port2._peer = this.port1
  }
}

class ShimBroadcastChannel {
  constructor(name) {
    this.name = name
    this.onmessage = null
    this._listeners = []
  }
  // No cross-instance delivery: MSW only uses this to coordinate multiple
  // runtimes (e.g. a worker thread and the main thread), which a
  // single-process Jest run never has.
  postMessage() {}
  addEventListener(type, listener) {
    if (type === 'message') this._listeners.push(listener)
  }
  removeEventListener(type, listener) {
    if (type !== 'message') return
    const index = this._listeners.indexOf(listener)
    if (index !== -1) this._listeners.splice(index, 1)
  }
  close() {}
}

Object.defineProperties(globalThis, {
  TextDecoder: { value: TextDecoder, writable: true, configurable: true },
  TextEncoder: { value: TextEncoder, writable: true, configurable: true },
  ReadableStream: { value: ReadableStream, writable: true, configurable: true },
  WritableStream: { value: WritableStream, writable: true, configurable: true },
  TransformStream: { value: TransformStream, writable: true, configurable: true },
  // jest.useFakeTimers() needs to patch this itself; jsdom's own
  // `performance` is otherwise fine, so just make ours replaceable.
  performance: { value: performance, writable: true, configurable: true },
  MessageChannel: { value: ShimMessageChannel, writable: true, configurable: true },
  MessagePort: { value: ShimMessagePort, writable: true, configurable: true },
  BroadcastChannel: { value: ShimBroadcastChannel, writable: true, configurable: true },
})

const { Blob, File } = require('node:buffer')
const { fetch, Headers, FormData, Request, Response } = require('undici')

// MSW's interceptors monkey-patch Request/Response/Headers/fetch when the
// server starts listening, so these must stay configurable/writable.
Object.defineProperties(globalThis, {
  fetch: { value: fetch, writable: true, configurable: true },
  Blob: { value: Blob, writable: true, configurable: true },
  File: { value: File, writable: true, configurable: true },
  Headers: { value: Headers, writable: true, configurable: true },
  FormData: { value: FormData, writable: true, configurable: true },
  Request: { value: Request, writable: true, configurable: true },
  Response: { value: Response, writable: true, configurable: true },
})
