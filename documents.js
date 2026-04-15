// Document Control Panel Logic
// Manages document checklists for each move with progress tracking

document.addEventListener('DOMContentLoaded', function() {
    // Use the shared Supabase client from auth-guard
    const supabaseClient = window.supabaseClient;

    // DOM elements
    const documentsGrid = document.getElementById('documentsGrid');
    const moveFilter = document.getElementById('moveFilter');
    const logoutBtn = document.getElementById('logoutBtn');

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = '/admin';
        }
    });

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            stopPolling();
            await supabaseClient.auth.signOut();
            window.location.href = '/admin';
        });
    }

    // Filter handler
    if (moveFilter) {
        moveFilter.addEventListener('change', () => {
            loadDocuments(moveFilter.value);
        });
    }

    // Polling: Refresh documents every 30 seconds (not 10)
    let pollingInterval;
    let allMoves = [];

    function startPolling() {
        pollingInterval = setInterval(() => {
            loadDocuments(moveFilter?.value || 'all');
        }, 30000);
    }

    function stopPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
    }

    // Load moves and documents on page load
    loadMovesAndDocuments();

    // Start polling AFTER initial load completes
    setTimeout(startPolling, 2000);

    // Load moves and their documents
    async function loadMovesAndDocuments() {
        try {
            // Load all moves ONCE, then reuse for filtering
            const { data: moves, error: movesError } = await supabaseClient
                .from('moves')
                .select('*')
                .order('created_at', { ascending: false });

            if (movesError) {
                console.error('Error loading moves:', movesError);
                documentsGrid.innerHTML = `<div class="error-message">Error loading moves: ${movesError.message}</div>`;
                return;
            }

            allMoves = moves || [];

            // Populate filter dropdown
            populateMoveFilter(allMoves);

            // Load documents for these moves
            const { data: documents, error: docsError } = await supabaseClient
                .from('documents')
                .select('*');

            if (docsError) {
                console.error('Error loading documents:', docsError);
            }

            displayDocuments(allMoves, documents || []);
        } catch (error) {
            console.error('Load error:', error);
            documentsGrid.innerHTML = `<div class="error-message">Error loading documents: ${error.message}</div>`;
        }
    }

    // Populate move filter dropdown
    function populateMoveFilter(moves) {
        if (!moveFilter) return;

        moveFilter.innerHTML = '<option value="all">All Moves</option>';

        moves.forEach(move => {
            const option = document.createElement('option');
            option.value = move.id;
            option.textContent = `#${move.id} - ${move.customer_name}`;
            moveFilter.appendChild(option);
        });
    }

    // Load documents for moves (client-side filtering only - no extra fetch)
    function loadDocuments(filter = 'all') {
        // Don't re-fetch moves; use cached data
        if (allMoves.length === 0) {
            loadMovesAndDocuments();
            return;
        }

        let filteredMoves = allMoves;
        if (filter !== 'all') {
            filteredMoves = allMoves.filter(m => m.id === parseInt(filter));
        }

        // Fetch only documents (moves are cached)
        supabaseClient
            .from('documents')
            .select('*')
            .then(({ data: documents, error }) => {
                if (error) {
                    console.error('Error loading documents:', error);
                    return;
                }
                displayDocuments(filteredMoves, documents || []);
            });
    }

    // Display document cards
    function displayDocuments(moves, documents) {
        if (!moves || moves.length === 0) {
            documentsGrid.innerHTML = '<div class="empty-state">No moves found</div>';
            return;
        }

        let html = '';
        moves.forEach(move => {
            // Find or create document record for this move
            let doc = documents.find(d => d.move_id === move.id);
            
            // If no document exists, create a default one
            if (!doc) {
                doc = {
                    move_id: move.id,
                    insurance_cert: false,
                    rateconfirmation: false,
                    bill_of_lading: false,
                    escort_confirmation: false,
                    route_plan: false
                };
            }

            const progress = calculateDocumentProgress(doc);
            const progressBar = renderProgressBar(progress);

            html += `
                <div class="document-card" data-move-id="${move.id}">
                    <div class="card-header">
                        <h3>Move #${move.id}</h3>
                        <span class="card-subtitle">${escapeHtml(move.customer_name)}</span>
                    </div>
                    <div class="card-route">
                        ${escapeHtml(move.origin)} → ${escapeHtml(move.destination)}
                    </div>
                    ${progressBar}
                    <div class="document-checklist">
                        <label class="check-item">
                            <input type="checkbox" 
                                   data-doc-field="insurance_cert" 
                                   data-move-id="${move.id}"
                                   ${doc.insurance_cert ? 'checked' : ''}
                                   onchange="toggleDocumentField(${doc.id || null}, ${move.id}, 'insurance_cert', this.checked)">
                            <span class="checkmark"></span>
                            Insurance Certificate
                        </label>
                        <label class="check-item">
                            <input type="checkbox" 
                                   data-doc-field="rateconfirmation" 
                                   data-move-id="${move.id}"
                                   ${doc.rateconfirmation ? 'checked' : ''}
                                   onchange="toggleDocumentField(${doc.id || null}, ${move.id}, 'rateconfirmation', this.checked)">
                            <span class="checkmark"></span>
                            Rate Confirmation
                        </label>
                        <label class="check-item">
                            <input type="checkbox" 
                                   data-doc-field="bill_of_lading" 
                                   data-move-id="${move.id}"
                                   ${doc.bill_of_lading ? 'checked' : ''}
                                   onchange="toggleDocumentField(${doc.id || null}, ${move.id}, 'bill_of_lading', this.checked)">
                            <span class="checkmark"></span>
                            Bill of Lading
                        </label>
                        <label class="check-item">
                            <input type="checkbox" 
                                   data-doc-field="escort_confirmation" 
                                   data-move-id="${move.id}"
                                   ${doc.escort_confirmation ? 'checked' : ''}
                                   onchange="toggleDocumentField(${doc.id || null}, ${move.id}, 'escort_confirmation', this.checked)">
                            <span class="checkmark"></span>
                            Escort Confirmation
                        </label>
                        <label class="check-item">
                            <input type="checkbox" 
                                   data-doc-field="route_plan" 
                                   data-move-id="${move.id}"
                                   ${doc.route_plan ? 'checked' : ''}
                                   onchange="toggleDocumentField(${doc.id || null}, ${move.id}, 'route_plan', this.checked)">
                            <span class="checkmark"></span>
                            Route Plan
                        </label>
                    </div>
                </div>
            `;
        });

        documentsGrid.innerHTML = html;
    }

    // Calculate document progress percentage
    function calculateDocumentProgress(doc) {
        const fields = ['insurance_cert', 'rateconfirmation', 'bill_of_lading', 'escort_confirmation', 'route_plan'];
        const completed = fields.filter(field => doc[field]).length;
        return Math.round((completed / fields.length) * 100);
    }

    // Render progress bar
    function renderProgressBar(progress) {
        let progressClass = 'progress-low';
        if (progress >= 100) progressClass = 'progress-complete';
        else if (progress >= 60) progressClass = 'progress-medium';
        else if (progress >= 30) progressClass = 'progress-low';

        return `
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill ${progressClass}" style="width: ${progress}%"></div>
                </div>
                <div class="progress-text">${progress}% Complete</div>
            </div>
        `;
    }

    // Toggle document field (global function for inline onchange)
    window.toggleDocumentField = async function(docId, moveId, field, value) {
        try {
            if (docId) {
                // Update existing document
                const { data, error } = await supabaseClient
                    .from('documents')
                    .update({ [field]: value })
                    .eq('id', docId)
                    .select();

                if (error) throw error;

                // Check if move is ready for dispatch
                await checkMoveReady(moveId);
            } else {
                // Create new document record
                const { data, error } = await supabaseClient
                    .from('documents')
                    .insert([{
                        move_id: moveId,
                        [field]: value
                    }])
                    .select();

                if (error) throw error;

                // Reload to get the new doc ID
                loadDocuments(moveFilter?.value || 'all');
            }
        } catch (error) {
            console.error('Error updating document:', error);
            alert('Error updating document. Please try again.');
        }
    };

    // Check if move is ready for dispatch (all docs complete)
    async function checkMoveReady(moveId) {
        try {
            const { data: doc, error } = await supabaseClient
                .from('documents')
                .select('*')
                .eq('move_id', moveId)
                .single();

            if (error || !doc) return;

            const allComplete = doc.insurance_cert &&
                               doc.rateconfirmation &&
                               doc.bill_of_lading &&
                               doc.escort_confirmation &&
                               doc.route_plan;

            if (allComplete) {
                const { data, error: updateError } = await supabaseClient
                    .from('moves')
                    .update({ overall_status: 'ready' })
                    .eq('id', moveId)
                    .select();

                if (updateError) {
                    console.error('Error updating move status:', updateError);
                } else {
                    console.log('✅ Move #' + moveId + ' auto-updated to "Ready for Dispatch"');
                    showNotification('🎉 All documents complete! Move #' + moveId + ' is now Ready for Dispatch');
                }
            }
        } catch (error) {
            console.error('Error checking move readiness:', error);
        }
    }

    // Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show brief notification toast
    function showNotification(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: #c6f6d5;
            color: #22543d;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-weight: 600;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // Add slideIn animation
    const style = document.createElement('style');
    style.textContent = `@keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
    document.head.appendChild(style);
});
