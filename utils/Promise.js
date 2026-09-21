export class Promise {
    static PENDING = {};
    static FULFILLED = {};
    static REJECTED = {};

    constructor(callback) {
        this.fulfilledHandlers = [];
        this.rejectedHandlers = [];
        this.state = Promise.PENDING;
        this.fulfill = this.makeResolver(Promise.FULFILLED);
        this.reject = this.makeResolver(Promise.REJECTED);
        callback(this.fulfill, this.reject);
    }

    then(onFulfilled, onRejected) {
        const next = new Promise((fulfill, reject) => {
            const addHandler = (handler, handlers, forward) => {
                if (typeof handler !== 'function') return handlers.push(forward);
                handlers.push((result) => {
                    try {
                        resolve(next, handler(result), fulfill, reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            };

            addHandler(onFulfilled, this.fulfilledHandlers, fulfill);
            addHandler(onRejected, this.rejectedHandlers, reject);
            if (this.state !== Promise.PENDING) setTimeout(this.dispatchHandlers, 0);
        });

        return next;
    }

    catch(onRejected) {
        return this.then(null, onRejected);
    }

    makeResolver(state) {
        return (value) => {
            if (this.state !== Promise.PENDING) return;
            this.state = state;
            this.dispatchHandlers = makeDispatcher(state === Promise.FULFILLED ? this.fulfilledHandlers : this.rejectedHandlers, value);
            setTimeout(this.dispatchHandlers, 0);
        };
    }

    static all(promises) {
        return new Promise((fulfill, reject) => {
            if (!promises.length) return fulfill([]);
            const results = [];
            let pending = promises.length;
            promises.forEach((promise, index) => {
                Promise.resolve(promise).then((value) => {
                    results[index] = value;
                    if (!--pending) fulfill(results);
                }, reject);
            });
        });
    }

    static race(promises) {
        return new Promise((fulfill, reject) => promises.forEach((promise) => Promise.resolve(promise).then(fulfill, reject)));
    }

    static resolve(value) {
        if (value instanceof Promise) return value;
        return new Promise((fulfill) => fulfill(value));
    }

    static reject(reason) {
        return new Promise((fulfill, reject) => reject(reason));
    }
}

function makeDispatcher(handlers, result) {
    return () => {
        let handler;
        while ((handler = handlers.shift())) handler(result);
    };
}

function resolve(promise, value, fulfill, reject) {
    if (value === promise) return reject(new TypeError("A promise's fulfillment handler cannot return the same promise"));
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return fulfill(value);

    let then;
    try {
        then = value.then;
    } catch (error) {
        return reject(error);
    }
    if (typeof then !== 'function') return fulfill(value);

    let called = false;
    try {
        then.call(
            value,
            (result) => {
                if (called) return;
                called = true;
                resolve(promise, result, fulfill, reject);
            },
            (error) => {
                if (called) return;
                called = true;
                reject(error);
            }
        );
    } catch (error) {
        if (!called) reject(error);
    }
}

export default Promise;
