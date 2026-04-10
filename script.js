// Move Intake Form Logic
// Handles form submission with auto-calculation for escort and permit requirements

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Supabase client
    const SUPABASE_URL = window.__ENV__.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.__ENV__.SUPABASE_ANON_KEY;
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // DOM elements
    const form = document.getElementById('intakeForm');
    const submitBtn = document.getElementById('submitBtn');
    const messageDiv = document.getElementById('message');
    const widthInput = document.getElementById('width');
    const statesCrossedInput = document.getElementById('statesCrossed');
    const escortRequiredEl = document.getElementById('escortRequired');
    const permitStatusEl = document.getElementById('permitStatus');

    // Auto-calculate escort requirement
    const ESCORT_THRESHOLD = 12; // feet

    function checkEscortRequired(width) {
        return width > ESCORT_THRESHOLD ? 'Yes' : 'No';
    }

    function checkPermitStatus(statesCrossed) {
        return statesCrossed > 1 ? 'Pending' : 'Not Required';
    }

    function updateAutoCalculations() {
        const width = parseFloat(widthInput?.value) || 0;
        const statesCrossed = parseInt(statesCrossedInput?.value) || 1;

        const escortRequired = checkEscortRequired(width);
        const permitStatus = checkPermitStatus(statesCrossed);

        if (escortRequiredEl) {
            escortRequiredEl.textContent = escortRequired;
            escortRequiredEl.className = escortRequired === 'Yes' ? 'calc-value highlight-warning' : 'calc-value';
        }

        if (permitStatusEl) {
            permitStatusEl.textContent = permitStatus;
            permitStatusEl.className = permitStatus === 'Pending' ? 'calc-value highlight-warning' : 'calc-value';
        }
    }

    // Listen for input changes to update calculations
    if (widthInput) {
        widthInput.addEventListener('input', updateAutoCalculations);
    }
    if (statesCrossedInput) {
        statesCrossedInput.addEventListener('input', updateAutoCalculations);
    }

    // Initial calculation
    updateAutoCalculations();

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Get form values
            const customerName = document.getElementById('customerName')?.value.trim();
            const origin = document.getElementById('origin')?.value.trim();
            const destination = document.getElementById('destination')?.value.trim();
            const width = parseFloat(document.getElementById('width')?.value);
            const height = parseFloat(document.getElementById('height')?.value);
            const weight = parseFloat(document.getElementById('weight')?.value);
            const statesCrossed = parseInt(document.getElementById('statesCrossed')?.value);
            const deliveryDate = document.getElementById('deliveryDate')?.value;

            // Validate inputs
            if (!customerName || !origin || !destination || !width || !height || !weight || !statesCrossed || !deliveryDate) {
                showMessage('Please fill in all required fields.', 'error');
                return;
            }

            // Sanitize inputs
            const sanitizedName = sanitizeInput(customerName);
            const sanitizedOrigin = sanitizeInput(origin);
            const sanitizedDestination = sanitizeInput(destination);

            // Disable submit button
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            showMessage('Submitting move information...', 'loading');

            try {
                // Calculate auto-fields
                const escortRequired = checkEscortRequired(width);
                const permitStatus = checkPermitStatus(statesCrossed);

                // Insert into Supabase
                const { data, error } = await supabaseClient
                    .from('moves')
                    .insert([{
                        customer_name: sanitizedName,
                        origin: sanitizedOrigin,
                        destination: sanitizedDestination,
                        width: width,
                        height: height,
                        weight: weight,
                        states_crossed: statesCrossed,
                        delivery_date: deliveryDate,
                        permit_status: permitStatus.toLowerCase().replace(' ', '_'),
                        escort_status: escortRequired === 'Yes' ? 'not_scheduled' : 'confirmed',
                        overall_status: 'intake'
                    }])
                    .select();

                if (error) {
                    throw error;
                }

                // Create document record for this move
                const moveId = data[0].id;
                await supabaseClient
                    .from('documents')
                    .insert([{
                        move_id: moveId,
                        insurance_cert: false,
                        rateconfirmation: false,
                        bill_of_lading: false,
                        escort_confirmation: false,
                        route_plan: false
                    }]);

                // Show success
                showMessage('Move submitted successfully!', 'success');
                form.reset();
                updateAutoCalculations();

                // Reset button
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Move';
                }, 2000);

            } catch (error) {
                console.error('Submission error:', error);
                showMessage(`Error submitting move: ${error.message}`, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Move';
            }
        });
    }

    // Input sanitization
    function sanitizeInput(input) {
        if (!input) return '';
        let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        return sanitized.trim();
    }

    // Show message
    function showMessage(text, type) {
        if (!messageDiv) return;
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;

        if (type !== 'success') {
            setTimeout(() => {
                messageDiv.textContent = '';
                messageDiv.className = 'message';
            }, 5000);
        }
    }

    // Supabase connectivity check
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            const { error } = await supabaseClient
                .from('moves')
                .select('id', { count: 'exact', head: true });

            if (error) {
                console.warn('⚠️ Supabase connection check failed:', error.message);
            } else {
                console.log('✅ Supabase connection verified');
            }
        } catch (error) {
            console.warn('⚠️ Could not verify Supabase connection:', error.message);
        }
    });
});
