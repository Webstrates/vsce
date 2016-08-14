//http://stackoverflow.com/questions/15877362/declare-and-initialize-a-dictionary-in-typescript

interface IDictionary<K, V> {
    add(key: K, value: V): void;
    remove(key: K): void;
    get(key: K): V;
    containsKey(key: K): boolean;
    keys(): K[];
    values(): V[];
    clear(): void;
}

class Dictionary<K, V> implements IDictionary<K, V> {

    _keys: K[] = [];
    _values: V[] = [];

    constructor(init: { key: K; value: V; }[] = []) {
      init.forEach(item => {
        this.add(item.key, item.value);
      });
    }

    add(key: K, value: V) {
        this._keys.push(key);
        this._values.push(value);
    }

    remove(key: K) {
        var index = this._keys.indexOf(key, 0);
        this._keys.splice(index, 1);
        this._values.splice(index, 1);
    }

    get(key: K) {
        var index = this._keys.indexOf(key, 0);
        if (index < 0) {
            return undefined;
        }
        return this._values[index];
    }

    keys(): K[] {
        return this._keys;
    }

    values(): V[] {
        return this._values;
    }

    containsKey(key: K) {
      return this._keys.indexOf(key, 0) > -1;
    }

    clear() {
        this._keys.length = 0;
        this._values.length = 0;
    }
}

export { Dictionary }