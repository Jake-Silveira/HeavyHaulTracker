// Permit Tracker Logic
// Displays state permits for each move with expiration warnings

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Supabase client
    const SUPABASE_URL = window.__ENV__.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // DOM elements
    const permitsTableBody = document.getElementById('permitsTableBody');
    const statusFilter = document.getElementById('statusFilter');
    const logoutBtn = document.getElementById('logoutBtn');

    // Check authentication
    checkAuth();

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = '/admin';
        }
    });

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = '/admin';
        });
    }

    // Filter handler
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            loadPermits(statusFilter.value);
        });
    }

    // Check authentication status
    async function checkAuth() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            // Not authenticated, redirect to admin login
            window.location.href = '/admin';
            return;
        }

        // Load permits
        loadPermits('all');
    }

    // Supabase Realtime: Listen for moves changes
    const movesChannel = supabaseClient
        .channel('permits-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'moves'
            },
            () => {
                // Reload when any move changes
                loadPermits(statusFilter?.value || 'all');
            }
        )
        .subscribe();

    // Load permits from Supabase
    async function loadPermits(filter = 'all') {
        try {
            const { data: moves, error } = await supabaseClient
                .from('moves')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading moves:', error);
                permitsTableBody.innerHTML = `<tr><td colspan="6" class="error-message">Error loading permits: ${error.message}</td></tr>`;
                return;
            }

            // Filter moves based on status
            let filteredMoves = moves || [];
            
            if (filter === 'pending') {
                filteredMoves = filteredMoves.filter(m => m.permit_status === 'pending');
            } else if (filter === 'approved') {
                filteredMoves = filteredMoves.filter(m => m.permit_status === 'approved');
            } else if (filter === 'expiring') {
                filteredMoves = filteredMoves.filter(m => {
                    if (!m.delivery_date) return false;
                    return checkExpiringSoon(m.delivery_date, 3);
                });
            }

            displayPermits(filteredMoves);
        } catch (error) {
            console.error('Load permits error:', error);
            permitsTableBody.innerHTML = `<tr><td colspan="6" class="error-message">Error loading permits: ${error.message}</td></tr>`;
        }
    }

    // Display permits in table
    function displayPermits(moves) {
        if (!moves || moves.length === 0) {
            permitsTableBody.innerHTML = '<tr><td colspan="6">No permits found</td></tr>';
            return;
        }

        let rows = '';
        moves.forEach(move => {
            const isExpiring = move.delivery_date && checkExpiringSoon(move.delivery_date, 3);
            const permitBadge = getPermitBadge(move.permit_status);
            const expirationDate = move.delivery_date ? formatDate(move.delivery_date) : 'N/A';
            const warningBadge = isExpiring ? '<span class="badge badge-warning">Expiring Soon</span>' : '';

            rows += `
                <tr>
                    <td><strong>#${move.id}</strong></td>
                    <td>${escapeHtml(move.origin)} → ${escapeHtml(move.destination)}</td>
                    <td>${move.states_crossed} state${move.states_crossed > 1 ? 's' : ''}</td>
                    <td>${permitBadge}</td>
                    <td>${expirationDate}</td>
                    <td>${warningBadge}</td>
                </tr>
            `;
        });

        permitsTableBody.innerHTML = rows;
    }

    // Check if delivery date is within N days
    function checkExpiringSoon(deliveryDate, days = 3) {
        const threshold = new Date(Date.now() + days * 86400000);
        return new Date(deliveryDate) < threshold;
    }

    // Get permit status badge
    function getPermitBadge(status) {
        const badges = {
            'pending': '<span class="badge badge-pending">Pending</span>',
            'approved': '<span class="badge badge-success">Approved</span>',
            'expiring': '<span class="badge badge-warning">Expiring</span>'
        };
        return badges[status] || '<span class="badge badge-secondary">Unknown</span>';
    }

    // Format date
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    // Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
