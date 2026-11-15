const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { getSupabaseClient, isSupabaseConfigured } = require('../config/supabase');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

// Fast in-memory cache with short TTL (5 seconds) to eliminate redundant Supabase round-trips
const tableCache = new Map();
const CACHE_TTL_MS = 5000;

function getCachedData(tableName) {
    const entry = tableCache.get(tableName);
    if (entry && (Date.now() - entry.timestamp) < CACHE_TTL_MS) {
        return entry.data;
    }
    return null;
}

function setCachedData(tableName, data) {
    tableCache.set(tableName, {
        data,
        timestamp: Date.now()
    });
}

function invalidateCache(tableName) {
    tableCache.delete(tableName);
}

class JsonStorage {
    constructor(tableName) {
        this.tableName = tableName;
        this.filePath = path.join(__dirname, '../../data', `${tableName}.json`);
        this.lock = Promise.resolve();
    }

    async _read() {
        try {
            if (isServerless) {
                const tmpPath = path.join(os.tmpdir(), `${this.tableName}.json`);
                try {
                    const tmpData = await fs.readFile(tmpPath, 'utf8');
                    return JSON.parse(tmpData);
                } catch (e) {
                    // Fall back to bundled data file
                }
            }
            const data = await fs.readFile(this.filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            return [];
        }
    }

    async _write(data) {
        try {
            const targetPath = isServerless ? path.join(os.tmpdir(), `${this.tableName}.json`) : this.filePath;
            await fs.writeFile(targetPath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            console.warn(`[JsonStorage Warning] Failed to write local JSON backup for ${this.tableName}:`, error.message);
        }
    }

    async getAll() {
        const cached = getCachedData(this.tableName);
        if (cached) {
            return cached;
        }

        if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
                try {
                    const { data, error } = await client.from(this.tableName).select('*');
                    if (error) {
                        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('relation') || error.code === '42P01')) {
                            // Table not yet created in Supabase schema: smoothly fallback to local JSON
                            return this.lock.then(async () => {
                                const result = await this._read();
                                setCachedData(this.tableName, result);
                                return result;
                            });
                        }
                        console.error(`[Supabase Storage Error] getAll on ${this.tableName}:`, error.message);
                        throw error;
                    }
                    // Merge local JSON extra columns (e.g. coins, upiOtp) with Supabase data
                    const localData = await this._read().catch(() => []);
                    const localMap = new Map(localData.map(i => [i.id, i]));
                    const merged = (data || []).map(item => ({ ...item, ...(localMap.get(item.id) || {}) }));
                    setCachedData(this.tableName, merged);
                    return merged;
                } catch (err) {
                    if (err.message && (err.message.includes('Could not find the table') || err.message.includes('relation') || err.code === '42P01')) {
                        return this.lock.then(async () => {
                            const result = await this._read();
                            setCachedData(this.tableName, result);
                            return result;
                        });
                    }
                    throw err;
                }
            }
        }
        return this.lock.then(async () => {
            const result = await this._read();
            setCachedData(this.tableName, result);
            return result;
        });
    }

    async getById(id) {
        if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
                try {
                    const { data, error } = await client.from(this.tableName).select('*').eq('id', id).maybeSingle();
                    if (error) {
                        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('relation') || error.code === '42P01')) {
                            const items = await this.getAll();
                            return items.find(item => item.id === id) || null;
                        }
                        console.error(`[Supabase Storage Error] getById on ${this.tableName}:`, error.message);
                        throw error;
                    }
                    const localData = await this._read().catch(() => []);
                    const localItem = localData.find(i => i.id === id) || {};
                    return data ? { ...data, ...localItem } : (localItem.id ? localItem : null);
                } catch (err) {
                    if (err.message && (err.message.includes('Could not find the table') || err.message.includes('relation') || err.code === '42P01')) {
                        const items = await this.getAll();
                        return items.find(item => item.id === id) || null;
                    }
                    throw err;
                }
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
                    if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.code === '42P01') {
                        // Table doesn't exist on Supabase, fall through to local JSON
                        break;
                    }
                    const match = error.message.match(/Could not find the ['"](\w+)['"] column/i) ||
                                  error.message.match(/column ['"](\w+)['"] of relation/i) ||
                                  error.message.match(/column ['"](\w+)['"] does not exist/i);
                    if (match && match[1] && currentItem[match[1]] !== undefined) {
                        delete currentItem[match[1]];
                        const retry = await client.from(this.tableName).insert([currentItem]).select().single();
                        if (!retry.error) {
                            await this.lock.then(async () => {
                                const items = await this._read();
                                items.push(newItem);
                                await this._write(items);
                            });
                            invalidateCache(this.tableName);
                            return { ...newItem, ...retry.data };
                        }
                        error = retry.error;
                    } else {
                        break;
                    }
                }

                if (error) {
                    if (error.message && (error.message.includes('Could not find the table') || error.message.includes('relation') || error.code === '42P01')) {
                        // Fall back to local JSON
                    } else {
                        console.error(`[Supabase Storage Error] add on ${this.tableName}:`, error.message);
                        throw error;
                    }
                } else {
                    await this.lock.then(async () => {
                        const items = await this._read();
                        items.push({ ...newItem, ...(data || {}) });
                        await this._write(items);
                    });
                    invalidateCache(this.tableName);
                    return { ...newItem, ...(data || {}) };
                }
            }
        }
        return new Promise((resolve, reject) => {
            this.lock = this.lock.then(async () => {
                try {
                    const items = await this._read();
                    const newItem = { ...item, id: item.id || (Date.now().toString() + Math.random().toString(36).substring(7)) };
                    items.push(newItem);
                    await this._write(items);
                    invalidateCache(this.tableName);
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
                    if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.code === '42P01') {
                        break;
                    }
                    const match = error.message.match(/Could not find the ['"](\w+)['"] column/i) ||
                                  error.message.match(/column ['"](\w+)['"] of relation/i) ||
                                  error.message.match(/column ['"](\w+)['"] does not exist/i);
                    if (match && match[1] && currentUpdates[match[1]] !== undefined) {
                        delete currentUpdates[match[1]];
                        if (Object.keys(currentUpdates).length === 0) {
                            let mergedResult = { ...updates };
                            await this.lock.then(async () => {
                                const items = await this._read();
                                const index = items.findIndex(item => item.id === id);
                                if (index !== -1) {
                                    items[index] = { ...items[index], ...updates };
                                    mergedResult = items[index];
                                } else {
                                    const newItem = { id, ...updates };
                                    items.push(newItem);
                                    mergedResult = newItem;
                                }
                                await this._write(items);
                            });
                            invalidateCache(this.tableName);
                            return mergedResult;
                        }
                        const retry = await client.from(this.tableName).update(currentUpdates).eq('id', id).select().maybeSingle();
                        if (!retry.error) {
                            let mergedResult = { ...(retry.data || {}), ...updates };
                            await this.lock.then(async () => {
                                const items = await this._read();
                                const index = items.findIndex(item => item.id === id);
                                if (index !== -1) {
                                    items[index] = { ...items[index], ...(retry.data || {}), ...updates };
                                    mergedResult = items[index];
                                } else {
                                    const newItem = { id, ...(retry.data || {}), ...updates };
                                    items.push(newItem);
                                    mergedResult = newItem;
                                }
                                await this._write(items);
                            });
                            invalidateCache(this.tableName);
                            return mergedResult;
                        }
                        error = retry.error;
                    } else {
                        break;
                    }
                }

                if (error) {
                    // Fall back to updating local JSON so application state and extra columns are never lost
                    let mergedResult = { ...updates };
                    await this.lock.then(async () => {
                        const items = await this._read();
                        const index = items.findIndex(item => item.id === id);
                        if (index !== -1) {
                            items[index] = { ...items[index], ...updates };
                            mergedResult = items[index];
                        } else {
                            const newItem = { id, ...updates };
                            items.push(newItem);
                            mergedResult = newItem;
                        }
                        await this._write(items);
                    });
                    invalidateCache(this.tableName);
                    return mergedResult;
                } else {
                    let mergedResult = { ...(data || {}), ...updates };
                    await this.lock.then(async () => {
                        const items = await this._read();
                        const index = items.findIndex(item => item.id === id);
                        if (index !== -1) {
                            items[index] = { ...items[index], ...(data || {}), ...updates };
                            mergedResult = items[index];
                        } else {
                            const newItem = { id, ...(data || {}), ...updates };
                            items.push(newItem);
                            mergedResult = newItem;
                        }
                        await this._write(items);
                    });
                    invalidateCache(this.tableName);
                    return mergedResult;
                }
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
                    invalidateCache(this.tableName);
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
                try {
                    let { error } = await client.from(this.tableName).delete().eq('id', id);
                    if (error) {
                        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('relation') || error.code === '42P01')) {
                            // Table not on Supabase, proceed to local JSON delete below
                        } else {
                            // Retry once on transient network glitch
                            const retry = await client.from(this.tableName).delete().eq('id', id);
                            if (retry.error) {
                                console.error(`[Supabase Storage Error] delete on ${this.tableName}:`, error.message);
                                throw error;
                            }
                        }
                    }
                } catch (err) {
                    if (err.message && (err.message.includes('Could not find the table') || err.message.includes('relation') || err.code === '42P01')) {
                        // Table not on Supabase, proceed to local JSON delete below
                    } else {
                        console.error(`[Supabase Storage Error] delete on ${this.tableName}:`, err.message);
                        throw err;
                    }
                }
            }
        }
        return new Promise((resolve, reject) => {
            this.lock = this.lock.then(async () => {
                try {
                    const items = await this._read();
                    const newItems = items.filter(item => item.id !== id);
                    await this._write(newItems);
                    invalidateCache(this.tableName);
                    resolve(true);
                } catch (e) {
                    reject(e);
                }
            }).catch(reject);
        });
    }
}

module.exports = JsonStorage;
