
const SUPABASE_URL = "https://uvvfoicbcsybobgpohwl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xkW4hDhjHWmbYrbfrXjo6Q_bH8BGoBq";

window.supabaseReady = (async function () {
    try {
        if (SUPABASE_URL.startsWith("PASTE_") || SUPABASE_ANON_KEY.startsWith("PASTE_")) {
            throw new Error("Supabase configuration is incomplete. Edit js/supabase-config.js.");
        }

        const { createClient } = window.supabase;
        window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Silent anonymous session: no login page is shown.
        const { data, error } = await window.supabaseClient.auth.signInAnonymously();
        if (error) throw error;

        console.log("Supabase connected. Anonymous session started.");
        return data;
    } catch (error) {
        console.error("Supabase initialization failed:", error);
        throw error;
    }
})();
