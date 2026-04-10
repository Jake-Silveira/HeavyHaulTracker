// Dispatch Dashboard Logic
// Displays move cards with KPI header and status badges

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Supabase client
    const SUPABASE_URL = window.__ENV__.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // DOM elements
    const loginSection = document.getElementById('loginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const movesGrid = document.getElementById('movesGrid');
    const activeMovesEl = document.getElementById('activeMoves');
    const pendingPermitsEl = document.getElementById('pendingPermits');
    const movesReadyEl = document.getElementById('movesReady');
    const atRiskMovesEl = document.getElementById('atRiskMoves');

    // Check if user is already logged in
    checkLoginStatus();

    // Login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                loginError.textContent = 'Invalid email or password';
                return;
            }

            loginError.textContent = '';
            loginSection.style.display = 'none';
            adminDashboard.style.display = 'flex';

            loadMoves();
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'An error occurred during login';
        }
    });

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            try {
                await supabaseClient.auth.signOut();
                loginSection.style.display = 'block';
                adminDashboard.style.display = 'none';
                document.getElementById('email').value = '';
                document.getElementById('password').value = '';
                loginError.textContent = '';
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // Check login status
    async function checkLoginStatus() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();

            if (session) {
                loginSection.style.display = 'none';
                adminDashboard.style.display = 'flex';
                loadMoves();
            } else {
                loginSection.style.display = 'block';
                adminDashboard.style.display = 'none';
            }
        } catch (error) {
            console.error('Check login status error:', error);
            loginSection.style.display = 'block';
            adminDashboard.style.display = 'none';
        }
    }

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            loginSection.style.display = 'block';
            adminDashboard.style.display = 'none';
        } else if (event === 'SIGNED_IN' && session) {
            loginSection.style.display = 'none';
            adminDashboard.style.display = 'flex';
            loadMoves();
        }
    });

    // Supabase Realtime: Listen for status changes on moves table
    const movesChannel = supabaseClient
        .channel('moves-status-changes')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'moves'
            },
            (payload) => {
                // Only reload if status changed
                const newStatus = payload.new.overall_status;
                const oldStatus = payload.old.overall_status;
                if (newStatus !== oldStatus) {
                    console.log(`✅ Move #${payload.new.id} status changed: ${oldStatus} → ${newStatus}`);
                    loadMoves(); // Reload to refresh the grid
                }
            }
        )
        .subscribe();

    // Load moves from Supabase
    async function loadMoves() {
        try {
            const { data: moves, error } = await supabaseClient
                .from('moves')
                .select('*, documents(*)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase error:', error);
                movesGrid.innerHTML = `<div class="error-message">Error loading moves: ${error.message}</div>`;
                return;
            }

            // Render KPI
            renderKPI(moves || []);

            // Render moves grid
            displayMoves(moves || []);
        } catch (error) {
            console.error('Load moves error:', error);
            movesGrid.innerHTML = `<div class="error-message">Error loading moves: ${error.message}</div>`;
        }
    }

    // Render KPI strip
    function renderKPI(moves) {
        const activeMoves = moves.filter(m => m.overall_status !== 'complete').length;
        const pendingPermits = moves.filter(m => m.permit_status === 'pending').length;
        const movesReady = moves.filter(m => m.overall_status === 'ready').length;
        const atRisk = moves.filter(m => {
            if (!m.delivery_date) return false;
            const deliveryDate = new Date(m.delivery_date);
            const threeDaysFromNow = new Date(Date.now() + 3 * 86400000);
            return deliveryDate < threeDaysFromNow && m.overall_status !== 'complete';
        }).length;

        if (activeMovesEl) activeMovesEl.textContent = activeMoves;
        if (pendingPermitsEl) pendingPermitsEl.textContent = pendingPermits;
        if (movesReadyEl) movesReadyEl.textContent = movesReady;
        if (atRiskMovesEl) atRiskMovesEl.textContent = atRisk;
    }

    // Display moves in grid
    function displayMoves(moves) {
        if (!moves || moves.length === 0) {
            movesGrid.innerHTML = '<div class="empty-state">No moves found. <a href="/">Create a new move</a></div>';
            return;
        }

        let html = '';
        moves.forEach(move => {
            const statusBadge = getStatusBadge(move.overall_status);
            const permitBadge = getPermitBadge(move.permit_status);
            const escortBadge = getEscortBadge(move.escort_status);
            
            // Get document progress
            const docs = move.documents;
            const docProgress = docs && docs.length > 0 ? calculateDocProgress(docs[0]) : 0;
            const docChecklist = renderDocChecklist(docs && docs.length > 0 ? docs[0] : null);

            html += `
                <div class="move-card">
                    <div class="move-header">
                        <div class="move-id">Load #${move.id}</div>
                        ${statusBadge}
                    </div>
                    <div class="move-route">
                        <span class="route-origin">${escapeHtml(move.origin)}</span>
                        <span class="route-arrow">→</span>
                        <span class="route-dest">${escapeHtml(move.destination)}</span>
                    </div>
                    <div class="move-details">
                        <div class="detail-row">
                            <span class="detail-label">Customer:</span>
                            <span class="detail-value">${escapeHtml(move.customer_name)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Dimensions:</span>
                            <span class="detail-value">${move.width}' × ${move.height}' × ${move.weight.toLocaleString()} lbs</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">States:</span>
                            <span class="detail-value">${move.states_crossed} state${move.states_crossed > 1 ? 's' : ''}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Delivery:</span>
                            <span class="detail-value">${formatDate(move.delivery_date)}</span>
                        </div>
                    </div>
                    <div class="move-badges">
                        <div class="badge-row">
                            <span class="badge-label">Permits:</span>
                            ${permitBadge}
                        </div>
                        <div class="badge-row">
                            <span class="badge-label">Escort:</span>
                            ${escortBadge}
                        </div>
                    </div>
                    <div class="move-documents">
                        <h4>Documents</h4>
                        ${docChecklist}
                        <div class="doc-progress-bar">
                            <div class="doc-progress-fill" style="width: ${docProgress}%"></div>
                        </div>
                        <div class="doc-progress-text">${docProgress}% Complete</div>
                    </div>
                </div>
            `;
        });

        movesGrid.innerHTML = html;
    }

    // Calculate document progress
    function calculateDocProgress(doc) {
        if (!doc) return 0;
        const fields = ['insurance_cert', 'rateconfirmation', 'bill_of_lading', 'escort_confirmation', 'route_plan'];
        const completed = fields.filter(f => doc[f]).length;
        return Math.round((completed / fields.length) * 100);
    }

    // Render document checklist
    function renderDocChecklist(doc) {
        if (!doc) {
            return `
                <div class="doc-item incomplete">Insurance Certificate</div>
                <div class="doc-item incomplete">Rate Confirmation</div>
                <div class="doc-item incomplete">Bill of Lading</div>
                <div class="doc-item incomplete">Escort Confirmation</div>
                <div class="doc-item incomplete">Route Plan</div>
            `;
        }

        return `
            <div class="doc-item ${doc.insurance_cert ? 'complete' : 'incomplete'}">${doc.insurance_cert ? '✓' : '○'} Insurance Certificate</div>
            <div class="doc-item ${doc.rateconfirmation ? 'complete' : 'incomplete'}">${doc.rateconfirmation ? '✓' : '○'} Rate Confirmation</div>
            <div class="doc-item ${doc.bill_of_lading ? 'complete' : 'incomplete'}">${doc.bill_of_lading ? '✓' : '○'} Bill of Lading</div>
            <div class="doc-item ${doc.escort_confirmation ? 'complete' : 'incomplete'}">${doc.escort_confirmation ? '✓' : '○'} Escort Confirmation</div>
            <div class="doc-item ${doc.route_plan ? 'complete' : 'incomplete'}">${doc.route_plan ? '✓' : '○'} Route Plan</div>
        `;
    }

    // Get status badge
    function getStatusBadge(status) {
        const badges = {
            'intake': '<span class="badge badge-intake">Intake</span>',
            'permits': '<span class="badge badge-permits">Permits</span>',
            'ready': '<span class="badge badge-ready">Ready</span>',
            'in_transit': '<span class="badge badge-transit">In Transit</span>',
            'complete': '<span class="badge badge-complete">Complete</span>'
        };
        return badges[status] || '<span class="badge badge-secondary">Unknown</span>';
    }

    // Get permit badge
    function getPermitBadge(status) {
        const badges = {
            'pending': '<span class="badge badge-pending">Pending</span>',
            'approved': '<span class="badge badge-success">Approved</span>',
            'expiring': '<span class="badge badge-warning">Expiring</span>',
            'not_required': '<span class="badge badge-secondary">Not Required</span>'
        };
        return badges[status] || '<span class="badge badge-secondary">Unknown</span>';
    }

    // Get escort badge
    function getEscortBadge(status) {
        const badges = {
            'not_scheduled': '<span class="badge badge-warning">Not Scheduled</span>',
            'scheduled': '<span class="badge badge-pending">Scheduled</span>',
            'confirmed': '<span class="badge badge-success">Confirmed</span>'
        };
        return badges[status] || '<span class="badge badge-secondary">Unknown</span>';
    }

    // Format date
    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
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
