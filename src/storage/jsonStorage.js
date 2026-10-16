const fs = require('fs').promises;
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../config/supabase');

class JsonStorage {
    constructor(tableName) {
        this.tableName = tableName;
        this.filePath = path.join(__dirname, '../../data', `${tableName}.json`);
        this.lock = Promise.resolve();
    }

    async _read() {
        try {
            const data = await fs.readFile(this.filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async _write(data) {
        await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    async getAll() {
        if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
                const { data, error } = await client.from(this.tableName).select('*');
                if (error) {
                    console.error(`[Supabase Storage Error] getAll on ${this.tableName}:`, error.message);
                    throw error;
                }
                return data || [];
            }
        }
        return this.lock.then(async () => {
            return await this._read();
        });
    }

    async getById(id) {
        if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
                const { data, error } = await client.from(this.tableName).select('*').eq('id', id).maybeSingle();
                if (error) {
                    console.error(`[Supabase Storage Error] getById on ${this.tableName}:`, error.message);
                    throw error;
                }
                return data || null;
            }
        }
        const items = await this.getAll();
        return items.find(item => item.id === id);
    }

    async find(predicate) {
        const items = await this.getAll();
        return items.find(predicate);
    }

    async add(item) {
        if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
                const newItem = {
                    ...item,
                    id: item.id || (Date.now().toString() + Math.random().toString(36).substring(7))
                };
                let currentItem = { ...newItem };
                let { data, error } = await client.from(this.tableName).insert([currentItem]).select().single();
                
                while (error && error.message) {
                    const match = error.message.match(/Could not find the '(\w+)' column/);
                    if (match && match[1] && currentItem[match[1]] !== undefined) {
                        delete currentItem[match[1]];
                        const retry = await client.from(this.tableName).insert([currentItem]).select().single();
                        if (!retry.error) {
                            return { ...newItem, ...retry.data };
                        }
                        error = retry.error;
                    } else {
                        break;
                    }
                }

                if (error) {
                    console.error(`[Supabase Storage Error] add on ${this.tableName}:`, error.message);
                    throw error;
                }
                return { ...newItem, ...(data || {}) };
            }
        }
        return new Promise((resolve, reject) => {
            this.lock = this.lock.then(async () => {
                try {
                    const items = await this._read();
                    const newItem = { ...item, id: item.id || (Date.now().toString() + Math.random().toString(36).substring(7)) };
                    items.push(newItem);
                    await this._write(items);
                    resolve(newItem);
                } catch (e) {
                    reject(e);
                }
            }).catch(reject);
        });
    }

    async update(id, updates) {
        if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
                let currentUpdates = { ...updates };
                let { data, error } = await client.from(this.tableName).update(currentUpdates).eq('id', id).select().maybeSingle();
                
                while (error && error.message) {
                    const match = error.message.match(/Could not find the '(\w+)' column/);
                    if (match && match[1] && currentUpdates[match[1]] !== undefined) {
                        delete currentUpdates[match[1]];
                        const retry = await client.from(this.tableName).update(currentUpdates).eq('id', id).select().maybeSingle();
                        if (!retry.error) {
                            return retry.data || null;
                        }
                        error = retry.error;
                    } else {
                        break;
                    }
                }

                if (error) {
                    console.error(`[Supabase Storage Error] update on ${this.tableName}:`, error.message);
                    throw error;
                }
                return data || null;
            }
        }
        return new Promise((resolve, reject) => {
            this.lock = this.lock.then(async () => {
                try {
                    const items = await this._read();
                    const index = items.findIndex(item => item.id === id);
                    if (index === -1) {
                        return resolve(null);
                    }
                    items[index] = { ...items[index], ...updates };
                    await this._write(items);
                    resolve(items[index]);
                } catch (e) {
                    reject(e);
                }
            }).catch(reject);
        });
    }

    async delete(id) {
        if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
                const { error } = await client.from(this.tableName).delete().eq('id', id);
                if (error) {
                    console.error(`[Supabase Storage Error] delete on ${this.tableName}:`, error.message);
                    throw error;
                }
                return true;
            }
        }
        return new Promise((resolve, reject) => {
            this.lock = this.lock.then(async () => {
                try {
                    const items = await this._read();
                    const newItems = items.filter(item => item.id !== id);
                    await this._write(newItems);
                    resolve(true);
                } catch (e) {
                    reject(e);
                }
            }).catch(reject);
        });
    }
}

module.exports = JsonStorage;
