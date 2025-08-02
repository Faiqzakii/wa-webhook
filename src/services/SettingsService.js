const { getDatabase } = require('../config/database');

class SettingsService {
    /**
     * Get all settings as key-value pairs
     */
    static async getSettings() {
        try {
            const supabase = getDatabase();
            const { data, error } = await supabase
                .from('settings')
                .select('*');

            if (error) throw error;

            return data.reduce((acc, row) => {
                acc[row.key] = row.value;
                return acc;
            }, {});
        } catch (error) {
            console.error('Error fetching settings:', error);
            throw error;
        }
    }

    /**
     * Update a setting value
     */
    static async updateSetting(key, value) {
        try {
            const supabase = getDatabase();
            const { data, error } = await supabase
                .from('settings')
                .update({ value })
                .eq('key', key)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating setting:', error);
            throw error;
        }
    }

    /**
     * Get all auto-reply rules
     */
    static async getAutoReplies() {
        try {
            const supabase = getDatabase();
            const { data, error } = await supabase
                .from('auto_replies')
                .select('*')
                .order('keyword', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching auto-replies:', error);
            throw error;
        }
    }

    /**
     * Add a new auto-reply rule
     */
    static async addAutoReply(keyword, reply) {
        try {
            const supabase = getDatabase();
            const { data, error } = await supabase
                .from('auto_replies')
                .insert({ keyword, reply, enabled: true })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error adding auto-reply:', error);
            throw error;
        }
    }

    /**
     * Delete an auto-reply rule
     */
    static async deleteAutoReply(id) {
        try {
            const supabase = getDatabase();
            const { error } = await supabase
                .from('auto_replies')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting auto-reply:', error);
            throw error;
        }
    }

    /**
     * Toggle auto-reply rule enabled status
     */
    static async toggleAutoReply(id) {
        try {
            const supabase = getDatabase();
            
            // Get current status
            const { data: rule, error: fetchError } = await supabase
                .from('auto_replies')
                .select('enabled')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            // Toggle status
            const { data, error } = await supabase
                .from('auto_replies')
                .update({ enabled: !rule.enabled })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error toggling auto-reply:', error);
            throw error;
        }
    }
}

module.exports = SettingsService;