const internalMixin = Mixin;
const internalAt = At;

class MixinStorage {
    constructor() {
        this._storage = new Map();
    }
    set(key, value) {
        this._storage.set(key, value);
    }
    get(key, defaultValue = null) {
        return this._storage.has(key) ? this._storage.get(key) : defaultValue;
    }
    exists(key) {
        return this._storage.has(key);
    }
    delete(key) {
        return this._storage.delete(key);
    }
    clear() {
        this._storage.clear();
    }
}

const managerInstance = new MixinStorage();

export function attachMixin(mixin, name, callback) {
    try {
        mixin.attach(callback);
    } catch (e) {
        console.error(`Failed to attach ${name}: ${e}`);
    }
}

class MixinEngine {
    constructor(className) {
        this.className = className;
        this.realMixin = new internalMixin(this.className);
        this.lastInjection = null;
    }

    _processConfig(config) {
        const { at, slice, ...others } = config;
        const result = { ...others };
        if (at) result.at = at instanceof internalAt ? at : new internalAt(at);
        if (slice) result.slice = slice instanceof Slice ? slice : new Slice(slice);
        return result;
    }

    // Standard code injection at a specific point (e.g., HEAD, RETURN, INVOKE)
    inject(config) {
        this.lastInjection = this.realMixin.inject(this._processConfig(config));
        return this;
    }

    // Intercepts a method call and replaces it with your own logic
    redirect(config) {
        this.lastInjection = this.realMixin.redirect(this._processConfig(config));
        return this;
    }

    // Modifies a single argument being passed into a method
    modifyArg(config) {
        this.lastInjection = this.realMixin.modifyArg(this._processConfig(config));
        return this;
    }

    // Modifies multiple arguments at once using an Args bundle
    modifyArgs(config) {
        this.lastInjection = this.realMixin.modifyArgs(this._processConfig(config));
        return this;
    }

    // Changes the value of a local variable within the method body
    modifyVariable(config) {
        this.lastInjection = this.realMixin.modifyVariable(this._processConfig(config));
        return this;
    }

    // Replaces a constant value (like a string or number) with a different one
    modifyConstant(config) {
        const { constant, ...others } = config;
        const constObj = constant instanceof Constant ? constant : new Constant(constant);
        this.lastInjection = this.realMixin.modifyConstant({ ...this._processConfig(others), constant: constObj });
        return this;
    }

    // Intercepts and changes the value a method is about to return
    modifyReturnValue(config) {
        this.lastInjection = this.lastInjection = this.realMixin.modifyReturnValue(this._processConfig(config));
        return this;
    }

    // Modifies the result of an expression (like a math operation or boolean check)
    modifyExpressionValue(config) {
        this.lastInjection = this.realMixin.modifyExpressionValue(this._processConfig(config));
        return this;
    }

    // Changes the object instance (the receiver) on which a method is being called
    modifyReceiver(config) {
        this.lastInjection = this.realMixin.modifyReceiver(this._processConfig(config));
        return this;
    }

    // Surrounds a method call or operation, allowing you to run code before and after
    wrapOperation(config) {
        this.lastInjection = this.realMixin.wrapOperation(this._processConfig(config));
        return this;
    }

    // Wraps an operation with a conditional check to decide if it should execute
    wrapWithCondition(config) {
        this.lastInjection = this.realMixin.wrapWithCondition(this._processConfig(config));
        return this;
    }

    // Widens access to a private or protected field; set 'mutable' true to allow editing
    field(name, mutable = true) {
        this.realMixin.widenField(name, mutable);
        return this;
    }

    // Widens access to a private or protected method so it can be called externally
    method(name) {
        this.realMixin.widenMethod(name, true);
        return this;
    }

    public(name) {
        if (name.includes('(')) return this.method(name);
        return this.field(name);
    }

    put(name, value) {
        managerInstance.set(name, value);
        return this;
    }

    hook(callback) {
        if (!this.lastInjection) return this;
        this.lastInjection.attach((...args) => callback(managerInstance, ...args));
        return this;
    }
}

export function Mixin(className) {
    return new MixinEngine(className);
}

Mixin.set = (key, val) => managerInstance.set(key, val);
Mixin.get = (key, def) => managerInstance.get(key, def);
Mixin.exists = (key) => managerInstance.exists(key);
Mixin.delete = (key) => managerInstance.delete(key);
Mixin.clear = () => managerInstance.clear();
