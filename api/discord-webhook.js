// Vercel Serverless Function: Discord Webhook Notification
// This keeps your Discord webhook URL secure (never exposed to browser)

module.exports = async function handler(req, res) {
  // Allow CORS for preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    if (!discordWebhookUrl) {
      console.log('Discord webhook URL not configured, skipping');
      return res.status(200).json({ message: 'Discord webhook not configured' });
    }

    const { name, email, workflow, submissionId, timestamp } = req.body;

    if (!name || !email || !workflow) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`Sending Discord notification for: ${name} (${email})`);

    // Format the Discord message
    const discordMessage = {
      embeds: [{
        title: '🆕 New Workflow Intake Form Submission',
        color: 3447003,
        fields: [
          { name: '👤 Name', value: name.substring(0, 100), inline: true },
          { name: '📧 Email', value: email.substring(0, 100), inline: true },
          { name: '📝 Workflow', value: workflow.substring(0, 1000) + (workflow.length > 1000 ? '...' : '') },
          { name: '🕐 Submitted At', value: timestamp || new Date().toISOString(), inline: true },
          { name: '🆔 Submission ID', value: submissionId?.toString() || 'N/A', inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    };

    // Send to Discord webhook using native fetch
    const response = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordMessage)
    });

    console.log(`Discord response: ${response.status}`);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Discord webhook error:', error);
    
    // Always return 200 so form submission isn't blocked
    return res.status(200).json({ message: 'Notification skipped', error: error.message });
  }
}
