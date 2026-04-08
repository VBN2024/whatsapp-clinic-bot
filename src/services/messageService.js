const axios = require('axios');

class MessageService {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    }

    async sendMessage(to, message) {
        const url = `https://graph.facebook.com/v13.0/${this.phoneNumberId}/messages`;
        const body = {
            messaging_product: 'whatsapp',
            to: to,
            text: { body: message }
        };

        try {
            const response = await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error sending message:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
}

module.exports = new MessageService();