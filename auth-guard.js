// Auth Guard - Protects pages that require authentication
// Include this script on any page that should require login

(function() {
    const SUPABASE_URL = window.__ENV__.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Page to redirect to if not authenticated
    const LOGIN_PAGE = '/admin';
    
    // Current page path
    const currentPath = window.location.pathname;

    // Check authentication on page load
    async function checkAuth() {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            // Not authenticated - redirect to login
            // Save current page so we can redirect back after login
            sessionStorage.setItem('redirectAfterLogin', currentPath);
            window.location.href = LOGIN_PAGE;
            return false;
        }

        // Authenticated
        return true;
    }

    // Run auth check immediately
    checkAuth().then(isAuthenticated => {
        if (isAuthenticated) {
            console.log('✅ Auth guard: User authenticated');
        }
    });

    // Listen for logout events
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            window.location.href = LOGIN_PAGE;
        }
    });

    // Expose supabase client for other scripts
    window.supabaseClient = supabaseClient;

})();
